import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useSubscription } from "@/hooks/useSubscription";
import { saasMonthlyEquivalent, saasPlanPrice } from "@/lib/saas-checkout";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({ meta: [{ title: "Minha assinatura — Posto 10" }] }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const subscription = useSubscription();

  if (subscription.authLoading) return null;
  if (!subscription.isAuthenticated || subscription.role !== "PROPRIETARIO") {
    return <Navigate to="/" replace />;
  }

  const account = subscription.currentAccount;
  const plan = account?.plano === "ANUAL" || account?.plano === "MENSAL" ? account.plano : null;

  return (
    <AppShell title="MINHA ASSINATURA" subtitle="PLANO E PAGAMENTO">
      <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5 text-foreground shadow-sm sm:p-7">
        <h1 className="font-display text-2xl">ASSINATURA DO POSTO</h1>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-sm font-bold text-muted-foreground">POSTO</dt>
            <dd className="mt-1 font-extrabold">{account?.postoNome ?? "POSTO NÃO INFORMADO"}</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-sm font-bold text-muted-foreground">PLANO</dt>
            <dd className="mt-1 font-extrabold">{plan ?? account?.plano ?? "TRIAL 48H"}</dd>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-sm font-bold text-muted-foreground">VALOR</dt>
            <dd className="mt-1 font-extrabold">
              {plan
                ? `R$ ${saasPlanPrice(plan).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${plan === "MENSAL" ? "/MÊS" : "/ANO"}`
                : "SEM COBRANÇA DURANTE O TESTE"}
            </dd>
            {plan === "ANUAL" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                EQUIVALE A R${" "}
                {saasMonthlyEquivalent("ANUAL").toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
                /MÊS
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-muted p-4">
            <dt className="text-sm font-bold text-muted-foreground">STATUS</dt>
            <dd className="mt-1 font-extrabold">
              {account?.billingStatus ?? account?.status ?? "NÃO INFORMADO"}
            </dd>
          </div>
          <div className="rounded-xl bg-muted p-4 sm:col-span-2">
            <dt className="text-sm font-bold text-muted-foreground">PRÓXIMO VENCIMENTO</dt>
            <dd className="mt-1 font-extrabold">
              {account?.dataProximoVencimento
                ? new Date(account.dataProximoVencimento).toLocaleDateString("pt-BR")
                : "NÃO DEFINIDO"}
            </dd>
          </div>
        </dl>
        <p className="mt-5 rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          ALTERAÇÕES E PAGAMENTOS ONLINE AINDA NÃO ESTÃO DISPONÍVEIS. ENTRE EM CONTATO COM O SUPORTE
          PARA ALTERAR OU REGULARIZAR SUA ASSINATURA.
        </p>
        <a
          href="/planos"
          className="mt-5 inline-flex rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950 hover:bg-amber-400"
        >
          VER PLANOS
        </a>
      </section>
    </AppShell>
  );
}
