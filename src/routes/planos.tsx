import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/planos")({
  head: () => ({ meta: [{ title: "Planos — Posto 10" }] }),
  component: PlansPage,
});

const plans = [
  {
    id: "MENSAL",
    name: "MENSAL POSTO 10",
    price: "R$ 129,90/MÊS",
    detail: "VALOR FIXO DESDE O PRIMEIRO MÊS",
    description:
      "SEM FIDELIDADE, CANCELE QUANDO QUISER. ACESSO PARA PROPRIETÁRIO + GERENTE + FRENTISTA + TROCADOR DE ÓLEO.",
    action: "ASSINAR MENSAL",
  },
  {
    id: "ANUAL",
    name: "ANUAL POSTO 10 - 2 MESES GRÁTIS",
    price: "R$ 1.299,00/ANO",
    detail: "EQUIVALE A R$ 108,25/MÊS",
    description: "12 MESES DE ACESSO, 2 MESES GRÁTIS, SEM COBRANÇA MENSAL.",
    action: "ASSINAR ANUAL",
  },
] as const;

function PlansPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="font-display text-3xl text-amber-300">
          POSTO 10
        </a>
        <p className="mt-8 text-sm font-bold tracking-[0.2em] text-amber-300">PLANOS</p>
        <h1 className="mt-2 font-display text-5xl">ESCOLHA SEU PLANO</h1>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="flex flex-col rounded-2xl border border-white/15 bg-slate-900 p-6"
            >
              <h2 className="min-h-16 font-display text-2xl text-amber-300">{plan.name}</h2>
              <p className="mt-4 text-2xl font-extrabold">{plan.price}</p>
              <p className="mt-1 font-bold text-amber-200">{plan.detail}</p>
              <p className="mt-5 flex-1 leading-relaxed text-slate-300">{plan.description}</p>
              <a
                href={`/cadastro?plano=${plan.id}`}
                className="mt-6 rounded-xl bg-amber-500 px-5 py-3 text-center font-bold text-slate-950 hover:bg-amber-400"
              >
                {plan.action}
              </a>
            </article>
          ))}
        </div>
        <a href="/" className="mt-8 inline-block text-sm font-semibold text-slate-300 underline">
          VOLTAR AO INÍCIO
        </a>
      </div>
    </main>
  );
}
