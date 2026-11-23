import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSubscription } from "@/hooks/useSubscription";
import { savePendingCheckout } from "@/lib/saas-checkout";
import type { BillingPlan, PaidOwnerSignup } from "@/lib/local-auth";

export const Route = createFileRoute("/cadastro")({
  validateSearch: z.object({ plano: z.string().optional() }),
  head: () => ({ meta: [{ title: "Cadastro — Posto 10" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { plano: rawPlan } = Route.useSearch();
  const requestedPlan = rawPlan?.toLocaleUpperCase("pt-BR");
  const plan: BillingPlan =
    requestedPlan === "MENSAL" || requestedPlan === "ANUAL" ? requestedPlan : "TRIAL_48H";
  const subscription = useSubscription();
  const [signup, setSignup] = useState<PaidOwnerSignup>({
    postoNome: "",
    nome: "",
    email: "",
    telefone: "",
    cnpj: "",
    senha: "",
    plano: plan === "ANUAL" ? "ANUAL" : "MENSAL",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (plan === "TRIAL_48H") {
      if (
        !subscription.registerVisitor({
          nome: signup.nome,
          email: signup.email,
          senha: signup.senha,
        })
      ) {
        setError(subscription.authError ?? "NÃO FOI POSSÍVEL INICIAR O TESTE.");
        return;
      }
      window.location.assign("/");
      return;
    }
    if (
      !signup.postoNome.trim() ||
      !signup.telefone.trim() ||
      signup.cnpj.replace(/\D/g, "").length !== 14
    ) {
      setError("INFORME NOME DO POSTO, TELEFONE E CNPJ COM 14 DÍGITOS.");
      return;
    }
    try {
      savePendingCheckout(signup);
      window.location.assign("/checkout");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "NÃO FOI POSSÍVEL AVANÇAR AO PAGAMENTO.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
        <a href="/" className="font-display text-3xl text-amber-300">
          POSTO 10
        </a>
        <h1 className="mt-5 font-display text-3xl">
          {plan === "TRIAL_48H" ? "COMECE SEU TESTE GRÁTIS" : "CADASTRO DO POSTO"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          {plan === "TRIAL_48H"
            ? "ACESSO GRATUITO POR 48 HORAS."
            : `PLANO ${plan}. OS DADOS SERÃO USADOS PARA CONFIGURAR SUA CONTA.`}
        </p>
        <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          {plan !== "TRIAL_48H" ? (
            <>
              <Input
                aria-label="Nome do posto"
                placeholder="NOME DO POSTO"
                value={signup.postoNome}
                onChange={(event) => setSignup({ ...signup, postoNome: event.target.value })}
                required
              />
            </>
          ) : null}
          <Input
            aria-label="Nome do proprietário"
            placeholder="NOME DO PROPRIETÁRIO"
            value={signup.nome}
            onChange={(event) => setSignup({ ...signup, nome: event.target.value })}
            required
          />
          <Input
            aria-label="E-mail"
            type="email"
            placeholder="E-MAIL"
            value={signup.email}
            onChange={(event) => setSignup({ ...signup, email: event.target.value })}
            required
          />
          {plan !== "TRIAL_48H" ? (
            <>
              <Input
                aria-label="Telefone"
                type="tel"
                placeholder="TELEFONE"
                value={signup.telefone}
                onChange={(event) => setSignup({ ...signup, telefone: event.target.value })}
                required
              />
              <Input
                aria-label="CNPJ"
                placeholder="CNPJ (14 DÍGITOS)"
                value={signup.cnpj}
                onChange={(event) => setSignup({ ...signup, cnpj: event.target.value })}
                required
              />
            </>
          ) : null}
          <Input
            aria-label="Senha"
            type="password"
            placeholder="SENHA (MÍNIMO 6 CARACTERES)"
            value={signup.senha}
            onChange={(event) => setSignup({ ...signup, senha: event.target.value })}
            minLength={6}
            required
          />
          <div className="sm:col-span-2">
            <Button className="w-full" type="submit">
              {plan === "TRIAL_48H" ? "CRIAR CONTA E INICIAR TESTE" : "CONTINUAR PARA PAGAMENTO"}
            </Button>
          </div>
        </form>
        {error ? (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-300">
            {error}
          </p>
        ) : null}
        <a href="/planos" className="mt-5 inline-block text-sm text-slate-300 underline">
          VER PLANOS
        </a>
      </section>
    </main>
  );
}
