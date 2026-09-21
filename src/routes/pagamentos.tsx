import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PixPagamento } from "@/hooks/subscription-ui";
import { PLAN_PRICES, type SubscriptionPlan, useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: "PAGAMENTOS — Posto 10" },
      { name: "description", content: "Pagamento e renovação da assinatura do aplicativo." },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const subscription = useSubscription();
  const [plan, setPlan] = useState<SubscriptionPlan>(subscription.subscriptionPlan);

  const plans: Array<{ id: SubscriptionPlan; title: string; description: string }> = [
    { id: "troca-oleo", title: "TROCA DE ÓLEO", description: "Libera PAGAMENTOS e TROCA DE ÓLEO." },
    {
      id: "frentista",
      title: "FRENTISTA",
      description: "Libera medidas, relatórios de combustível, produtos e recebimento.",
    },
    {
      id: "gerente",
      title: "GERENTE",
      description: "Libera todas as abas e o aplicativo completo.",
    },
  ];

  return (
    <AppShell title="PAGAMENTOS" subtitle="Assinatura e renovação">
      <section className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Pagamento via PIX</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          A assinatura libera o aplicativo por 30 dias. Após realizar o pagamento, confirme no botão
          abaixo para liberar ou renovar o acesso.
        </p>
        <div className="grid gap-2">
          {plans.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlan(item.id)}
              className={`rounded-xl border p-3 text-left ${plan === item.id ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <strong className="text-foreground">
                {item.title} · R${PLAN_PRICES[item.id]}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
        <PixPagamento
          price={PLAN_PRICES[plan]}
          onJaPaguei={() => subscription.renewSubscription(plan)}
        />
        <p className="text-center text-xs text-muted-foreground">
          Status atual:{" "}
          <strong className="text-foreground">
            {subscription.isAdmin ? "Administrador" : subscription.subscriptionStatus}
          </strong>
        </p>
        <Button variant="ghost" className="w-full" onClick={() => void subscription.logout()}>
          Sair
        </Button>
      </section>
    </AppShell>
  );
}
