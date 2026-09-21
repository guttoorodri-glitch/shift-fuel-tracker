import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Camera, Plus, Save, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readFechamentoPhoto, type OcrRecebimento, type OcrVenda } from "@/lib/fechamento-ocr";
import { actions, todayISO, useAppState, type FechamentoItem } from "@/lib/store";

export const Route = createFileRoute("/fechamento-caixa")({ component: FechamentoCaixaPage });

type VendaRow = OcrVenda & { id: string };
type RecebimentoRow = OcrRecebimento & { id: string };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numeric = (value: string) => Number(value.replace(",", ".")) || 0;

function FechamentoCaixaPage() {
  const state = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(todayISO());
  const [turno, setTurno] = useState("1");
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [recebimentos, setRecebimentos] = useState<RecebimentoRow[]>([]);
  const activeForms = (state.formasPagamento ?? []).filter((forma) => forma.ativo);
  const prices = state.precosCombustivel ?? [];
  const priceFor = (id: string) => prices.find((item) => item.combustivelId === id)?.preco ?? 0;
  const totalVendas = useMemo(() => vendas.reduce((sum, item) => sum + item.litros * priceFor(state.tanks.find((tank) => tank.name === item.produto)?.id ?? ""), 0), [vendas, prices, state.tanks]);
  const totalRecebido = useMemo(() => recebimentos.reduce((sum, item) => sum + item.valor, 0), [recebimentos]);
  const diferenca = totalRecebido - totalVendas;
  const status = diferenca === 0 ? "ok" : diferenca < 0 ? "faltando" : "sobrando";

  const processPhoto = async (file: File) => {
    setPhotoStatus("Lendo relatório... 0%");
    try {
      const result = await readFechamentoPhoto(file, state.tanks, activeForms, (progress) => setPhotoStatus(`Lendo relatório... ${Math.round(progress * 100)}%`));
      setVendas(result.vendas.map((item, index) => ({ ...item, id: `ocr-venda-${index}` })));
      setRecebimentos(result.recebimentos.map((item, index) => ({ ...item, id: `ocr-recebimento-${index}` })));
      setPhotoStatus(`Leitura concluída. ${result.vendas.length + result.recebimentos.length} linhas encontradas; confira os valores.`);
    } catch {
      setPhotoStatus("Não foi possível ler a foto. Adicione as linhas manualmente.");
    }
  };

  const addVenda = () => setVendas((rows) => [...rows, { id: `venda-${Date.now()}`, produto: state.tanks[0]?.name ?? "", litros: 0, confianca: 1 }]);
  const addRecebimento = () => {
    const forma = activeForms[0];
    if (forma) setRecebimentos((rows) => [...rows, { id: `recebimento-${Date.now()}`, forma_id: forma.id, forma_nome: forma.nome, valor: 0, confianca: 1 }]);
  };
  const save = () => {
    const itens: FechamentoItem[] = [
      ...vendas.map((item) => ({ id: item.id, tipo: "venda" as const, produto: item.produto, litros: item.litros, preco: priceFor(state.tanks.find((tank) => tank.name === item.produto)?.id ?? ""), valor: item.litros * priceFor(state.tanks.find((tank) => tank.name === item.produto)?.id ?? "") })),
      ...recebimentos.map((item) => ({ id: item.id, tipo: "recebimento" as const, formaId: item.forma_id, formaNome: item.forma_nome, valor: item.valor })),
    ];
    actions.addFechamento({ data: date, turno, frentistaId: undefined, totalVendas, totalRecebido, diferenca, status, itens });
    setPhotoStatus("Fechamento salvo no histórico.");
  };

  return (
    <AppShell title="Fechamento de Caixa" subtitle="Conferência por foto e formas de recebimento">
      <div className="w-full space-y-4 pb-28">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2"><WalletCards className="size-5 text-primary" /><h2 className="font-display text-xl text-foreground">Novo fechamento</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">Data<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1" /></label>
            <label className="text-xs text-muted-foreground">Turno<Input value={turno} onChange={(event) => setTurno(event.target.value)} className="mt-1" /></label>
          </div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processPhoto(file); }} />
          <Button className="mt-4 h-14 w-full text-base" onClick={() => inputRef.current?.click()}><Camera className="size-5" /> TIRAR FOTO DO RELATÓRIO</Button>
          {photoStatus ? <p className="mt-3 text-xs text-muted-foreground">{photoStatus}</p> : null}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg text-foreground">Tabela A · Vendas</h2><Button size="sm" variant="outline" onClick={addVenda}><Plus className="size-4" /> Adicionar</Button></div>
          <div className="mt-3 space-y-3">
            {vendas.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr] sm:items-center">
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={item.produto} onChange={(event) => setVendas((rows) => rows.map((row) => row.id === item.id ? { ...row, produto: event.target.value } : row))}>{state.tanks.map((tank) => <option key={tank.id}>{tank.name}</option>)}</select>
              <Input type="number" step="0.01" value={item.litros} onChange={(event) => setVendas((rows) => rows.map((row) => row.id === item.id ? { ...row, litros: numeric(event.target.value) } : row))} placeholder="Litros" />
              <span className="text-sm text-muted-foreground">Preço: {money(priceFor(state.tanks.find((tank) => tank.name === item.produto)?.id ?? ""))}</span>
              <strong className="text-sm text-foreground">Total: {money(item.litros * priceFor(state.tanks.find((tank) => tank.name === item.produto)?.id ?? ""))}</strong>
            </div>)}
            {vendas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma venda. Use a foto ou adicione uma linha.</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg text-foreground">Tabela B · Recebimentos</h2><Button size="sm" variant="outline" onClick={addRecebimento}><Plus className="size-4" /> Adicionar</Button></div>
          <div className="mt-3 space-y-3">
            {recebimentos.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr]">
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={item.forma_id} onChange={(event) => { const forma = activeForms.find((option) => option.id === event.target.value); if (forma) setRecebimentos((rows) => rows.map((row) => row.id === item.id ? { ...row, forma_id: forma.id, forma_nome: forma.nome } : row)); }}>
                {activeForms.map((forma) => <option key={forma.id} value={forma.id}>{forma.nome}</option>)}
              </select>
              <Input type="number" step="0.01" value={item.valor} onChange={(event) => setRecebimentos((rows) => rows.map((row) => row.id === item.id ? { ...row, valor: numeric(event.target.value) } : row))} placeholder="Valor recebido" />
            </div>)}
            {recebimentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum recebimento. Use a foto ou adicione uma linha.</p> : null}
          </div>
          <Button variant="ghost" className="mt-3" onClick={() => window.location.assign("/configuracoes/formas-pagamento")}><Plus className="size-4" /> Adicionar outra forma na hora</Button>
        </section>
      </div>

      <footer className="fixed bottom-0 left-0 z-20 w-full border-t border-border bg-card/95 p-3 shadow-lg backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-foreground"><span>Vendas: <strong>{money(totalVendas)}</strong></span><span>Recebido: <strong>{money(totalRecebido)}</strong></span><span className={status === "ok" ? "font-bold text-green-600" : status === "faltando" ? "font-bold text-red-600" : "font-bold text-amber-600"}>{status === "ok" ? "CAIXA OK ✅" : status === "faltando" ? `FALTANDO ${money(Math.abs(diferenca))}` : `SOBRANDO ${money(diferenca)}`}</span></div>
          <Button onClick={save}><Save className="size-4" /> Salvar Fechamento</Button>
        </div>
      </footer>
    </AppShell>
  );
}
