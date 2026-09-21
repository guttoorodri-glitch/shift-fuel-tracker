import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/configuracoes-formas-pagamento")({
  component: FormasPagamentoPage,
});

function FormasPagamentoPage() {
  const { formasPagamento = [] } = useAppState();
  const [nome, setNome] = useState("");

  return (
    <AppShell title="Formas de recebimento" subtitle="Cadastro usado no fechamento de caixa">
      <section className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Formas de pagamento</h2>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nome.trim()) return;
            actions.addFormaPagamento(nome);
            setNome("");
          }}
        >
          <Input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: PicPay ou Convênio Empresa X" />
          <Button type="submit" className="shrink-0"><Plus className="size-4" /> Nova Forma</Button>
        </form>
        <div className="divide-y divide-border rounded-lg border border-border">
          {formasPagamento.map((forma) => (
            <div key={forma.id} className="flex items-center justify-between gap-3 p-3">
              <span className={forma.ativo ? "text-sm text-foreground" : "text-sm text-muted-foreground line-through"}>{forma.nome}</span>
              <Button type="button" size="sm" variant={forma.ativo ? "outline" : "default"} onClick={() => actions.toggleFormaPagamento(forma.id)}>
                {forma.ativo ? "Desativar" : "Ativar"}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
