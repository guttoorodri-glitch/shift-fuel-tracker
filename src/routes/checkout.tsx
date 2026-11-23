import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { createPaidDemoAccount } from "@/lib/local-auth";
import { clearPendingCheckout, readPendingCheckout, saasPlanPrice } from "@/lib/saas-checkout";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Pagamento — Posto 10" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const [signup, setSignup] = useState<ReturnType<typeof readPendingCheckout>>(null);
  const [method, setMethod] = useState<"PIX" | "CARTÃO">("PIX");
  const [error, setError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<
    "CARREGANDO" | "DEMO" | "ASAAS_CONFIGURADO" | "INDISPONÍVEL"
  >("CARREGANDO");
  const subscription = useSubscription();
  const price = signup ? saasPlanPrice(signup.plano) : 0;

  useEffect(() => {
    setSignup(readPendingCheckout());
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/asaas/config")
      .then(async (response) => {
        if (!response.ok)
          throw new Error("NÃO FOI POSSÍVEL CONSULTAR A CONFIGURAÇÃO DO PAGAMENTO.");
        const config = (await response.json()) as { mode?: string; checkoutReady?: boolean };
        if (!active) return;
        setPaymentMode(config.mode === "ASAAS_CONFIGURADO" ? "ASAAS_CONFIGURADO" : "DEMO");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setPaymentMode("INDISPONÍVEL");
        setError(caught instanceof Error ? caught.message : "SERVIÇO DE PAGAMENTO INDISPONÍVEL.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!signup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
        <section className="max-w-md rounded-2xl bg-slate-900 p-6 text-center">
          <h1 className="font-display text-3xl">CADASTRO NÃO ENCONTRADO</h1>
          <a href="/planos" className="mt-4 inline-block text-amber-300 underline">
            ESCOLHER UM PLANO
          </a>
        </section>
      </main>
    );
  }

  const simulateApproval = () => {
    try {
      createPaidDemoAccount(signup, method);
      clearPendingCheckout();
      if (!subscription.loginUser(signup.email, signup.senha)) {
        setError(
          subscription.authError ?? "PAGAMENTO SIMULADO, MAS NÃO FOI POSSÍVEL INICIAR A SESSÃO.",
        );
        return;
      }
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "NÃO FOI POSSÍVEL SIMULAR O PAGAMENTO.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
        <a href="/" className="font-display text-3xl text-amber-300">
          POSTO 10
        </a>
        <h1 className="mt-5 font-display text-3xl">FINALIZAR ASSINATURA</h1>
        <div className="mt-5 rounded-xl bg-slate-800 p-4">
          <p className="font-bold">{signup.postoNome}</p>
          <p className="text-sm text-slate-300">
            {signup.plano} · {signup.email}
          </p>
          <p className="mt-3 text-2xl font-extrabold">
            R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-300">
            {signup.plano === "MENSAL"
              ? "VALOR FIXO R$ 129,90/MÊS DESDE O PRIMEIRO MÊS. SEM PROMOÇÃO."
              : "12 MESES DE ACESSO; PAGA 10 MESES E TEM 2 MESES GRÁTIS."}
          </p>
        </div>
        <fieldset className="mt-5 grid grid-cols-2 gap-3">
          {(["PIX", "CARTÃO"] as const).map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-xl border p-4 text-center font-bold ${method === option ? "border-amber-400 bg-amber-400/10" : "border-white/15"}`}
            >
              <input
                className="sr-only"
                type="radio"
                name="payment"
                value={option}
                checked={method === option}
                onChange={() => setMethod(option)}
              />
              {option === "CARTÃO" ? "CARTÃO DE CRÉDITO" : option}
            </label>
          ))}
        </fieldset>
        {paymentMode === "DEMO" && method === "PIX" ? (
          <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 text-center">
            <p className="font-bold text-amber-200">MODO DEMO — QR CODE NÃO PAGÁVEL</p>
            <div className="mx-auto mt-3 inline-block rounded-lg bg-white p-3">
              <QRCodeSVG
                value={`POSTO10-DEMO|${signup.email}|${signup.plano}|${price}`}
                size={150}
              />
            </div>
            <p className="mt-3 text-sm text-slate-200">
              AGUARDANDO PAGAMENTO - LIBERAÇÃO AUTOMÁTICA APÓS CONFIRMAÇÃO
            </p>
            <p className="mt-1 text-xs text-slate-400">
              O ASAAS AINDA NÃO ESTÁ CONFIGURADO. ESTE CÓDIGO É APENAS PARA DEMONSTRAÇÃO.
            </p>
          </div>
        ) : paymentMode === "DEMO" ? (
          <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 text-sm text-slate-200">
            CHECKOUT DE CARTÃO REAL INDISPONÍVEL NO MODO DEMO. NÃO INFORME DADOS DO CARTÃO NESTA
            TELA.
          </p>
        ) : paymentMode === "ASAAS_CONFIGURADO" ? (
          <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 text-sm text-slate-200">
            ASAAS CONFIGURADO, MAS O CHECKOUT REAL ESTÁ BLOQUEADO ATÉ CONECTAR BANCO CENTRAL E
            PROVISIONAMENTO DE CONTAS.
          </p>
        ) : (
          <p className="mt-5 rounded-xl border border-red-400/40 bg-red-400/5 p-4 text-sm text-red-200">
            NÃO FOI POSSÍVEL VALIDAR O MODO DE PAGAMENTO. TENTE NOVAMENTE MAIS TARDE.
          </p>
        )}
        {paymentMode === "DEMO" ? (
          <>
            <Button className="mt-5 w-full" type="button" onClick={simulateApproval}>
              SIMULAR PAGAMENTO APROVADO
            </Button>
            <p className="mt-3 text-center text-xs text-slate-400">
              A SIMULAÇÃO CRIA UMA CONTA LOCAL NESTE NAVEGADOR; NÃO HÁ COBRANÇA REAL.
            </p>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm font-bold text-red-300">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
