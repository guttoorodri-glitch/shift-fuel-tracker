import { createFileRoute } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions, todayISO, useAppState } from "@/lib/store";

export const Route = createFileRoute("/configuracoes-precos")({
  component: PrecosPage,
});

function PrecosPage() {
  const state = useAppState();
  const prices = state.precosCombustivel ?? [];

  return (
    <AppShell title="Preços de combustíveis" subtitle="Preço de venda por litro">
      <section className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Tag className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Preços vigentes</h2>
        </div>
        <p className="text-sm text-muted-foreground">Informe o preço usado no fechamento de caixa. A data de vigência é registrada a cada salvamento.</p>
        <div className="space-y-3">
          {state.tanks.map((combustivel) => {
            const current = prices.find((item) => item.combustivelId === combustivel.id);
            return <PriceRow key={combustivel.id} id={combustivel.id} name={combustivel.name} initial={current?.preco ?? 0} />;
          })}
        </div>
      </section>
    </AppShell>
  );
}

function PriceRow({ id, name, initial }: { id: string; name: string; initial: number }) {
  const value = initial.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <form className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const preco = Number(String(form.get("preco") ?? "0").replace(",", "."));
    actions.updatePrecoCombustivel(id, Number.isFinite(preco) ? preco : 0, todayISO());
  }}>
    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{name}</span>
    <Input name="preco" inputMode="decimal" defaultValue={value} className="sm:w-36" />
    <Button type="submit" size="sm">Salvar</Button>
  </form>;
}
