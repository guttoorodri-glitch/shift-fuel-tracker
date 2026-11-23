import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Plus, Save, Share2, Trash2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBlob, sharePdf } from "@/lib/share-pdf";
import { buildFechamentoCaixaPdf, fechamentoCaixaFileName } from "@/lib/fechamento-caixa-pdf";
import { getPersistedRole, useSubscription } from "@/hooks/useSubscription";
import {
  actions,
  formatBR,
  todayISO,
  useAppState,
  uid,
  type Fechamento,
  type FechamentoItem,
} from "@/lib/store";

export const Route = createFileRoute("/fechamento-caixa")({ component: FechamentoCaixaPage });

type FuelEntry = { liters: string; unitPrice: string };
type ProductEntry = { id: string; name: string; value: string };

const money = (value: number, digits = 2) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/[R$\s]/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(trimmed)
      ? trimmed.replace(/\./g, "")
      : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyInput(value: string, digits: number) {
  const parsed = parseAmount(value);
  return parsed === null ? "" : money(parsed, digits);
}

function FechamentoCaixaPage() {
  const state = useAppState();
  const subscription = useSubscription();
  const isManager = (subscription.role ?? getPersistedRole()) === "GERENTE";
  const today = todayISO();
  const shifts = Array.from({ length: state.shifts }, (_, index) => String(index + 1));
  const activeForms = (state.formasPagamento ?? []).filter((form) => form.ativo);
  const [date, setDate] = useState(todayISO());
  const [turno, setTurno] = useState("1");
  const [fuelEntries, setFuelEntries] = useState<Record<string, FuelEntry>>({});
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({});
  const [cashierName, setCashierName] = useState("");
  const [signature, setSignature] = useState("");
  const [newFormName, setNewFormName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const savedClose = (state.fechamentos ?? []).find(
    (closing) => closing.data === date && closing.turno === turno,
  );

  const configuredPrice = (nozzleId: string) => {
    const nozzle = (state.nozzles ?? []).find((item) => item.id === nozzleId);
    const tank = state.tanks.find(
      (item) =>
        item.id === nozzle?.tankId ||
        item.name.toLocaleLowerCase("pt-BR") === nozzle?.fuel.toLocaleLowerCase("pt-BR"),
    );
    return state.precosCombustivel?.find((item) => item.combustivelId === tank?.id)?.preco ?? 0;
  };

  useEffect(() => {
    const fuelItems =
      savedClose?.itens.filter((item) => item.tipo === "combustivel" || item.tipo === "venda") ??
      [];
    const nextFuel: Record<string, FuelEntry> = {};
    for (const nozzle of state.nozzles ?? []) {
      const saved = fuelItems.find((item) => item.bicoId === nozzle.id);
      nextFuel[nozzle.id] = {
        liters: saved?.litros === undefined ? "" : String(saved.litros),
        unitPrice:
          saved?.preco === undefined
            ? configuredPrice(nozzle.id)
              ? money(configuredPrice(nozzle.id), 3)
              : ""
            : money(saved.preco, 3),
      };
    }
    setFuelEntries(nextFuel);
    setProducts(
      (savedClose?.itens ?? [])
        .filter((item) => item.tipo === "produto")
        .map((item) => ({ id: item.id, name: item.produto ?? "", value: money(item.valor) })),
    );
    const nextPayments: Record<string, string> = {};
    for (const form of activeForms) {
      const saved = savedClose?.itens.find(
        (item) => item.tipo === "recebimento" && item.formaId === form.id,
      );
      nextPayments[form.id] = saved ? money(saved.valor) : "0,000";
    }
    setPaymentValues(nextPayments);
    setCashierName(savedClose?.frentistaNome ?? "");
    setSignature(savedClose?.assinatura ?? "");
    setError(null);
    setStatusMessage(null);
  }, [date, turno, savedClose]);

  const fuelTotal = useMemo(
    () =>
      Object.values(fuelEntries).reduce((sum, entry) => {
        const liters = parseAmount(entry.liters) ?? 0;
        const unitPrice = parseAmount(entry.unitPrice) ?? 0;
        return sum + liters * unitPrice;
      }, 0),
    [fuelEntries],
  );
  const productsTotal = useMemo(
    () => products.reduce((sum, entry) => sum + (parseAmount(entry.value) ?? 0), 0),
    [products],
  );
  const totalSales = fuelTotal + productsTotal;
  const totalReceived = activeForms.reduce(
    (sum, form) => sum + (parseAmount(paymentValues[form.id] ?? "") ?? 0),
    0,
  );
  const difference = Math.round((totalReceived - totalSales) * 100) / 100;
  const closingStatus: Fechamento["status"] =
    difference === 0 ? "ok" : difference < 0 ? "faltando" : "sobrando";

  const addProduct = () =>
    setProducts((entries) => [...entries, { id: uid(), name: "", value: "" }]);
  const updateProduct = (id: string, patch: Partial<ProductEntry>) =>
    setProducts((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );

  const addPaymentForm = () => {
    const name = newFormName.trim().toLocaleUpperCase("pt-BR");
    if (!name || activeForms.some((form) => form.nome.toLocaleUpperCase("pt-BR") === name)) return;
    const id = actions.addFormaPagamento(name);
    setPaymentValues((current) => ({ ...current, [id]: "0,000" }));
    setNewFormName("");
  };

  const createClosing = (): Omit<Fechamento, "id"> | null => {
    const missing: string[] = [];
    if (!(state.nozzles ?? []).length) missing.push("Cadastre os bicos no menu Aferição");
    if (!cashierName.trim()) missing.push("Informe o frentista caixa");
    if (!signature.trim()) missing.push("Preencha a assinatura do frentista caixa");
    for (const nozzle of state.nozzles ?? []) {
      const entry = fuelEntries[nozzle.id];
      if (parseAmount(entry?.liters ?? "") === null)
        missing.push(`Litros vendidos do ${nozzle.name}`);
      if (parseAmount(entry?.unitPrice ?? "") === null)
        missing.push(`Preço por litro do ${nozzle.name}`);
    }
    for (const product of products) {
      if (!product.name.trim() || parseAmount(product.value) === null) {
        missing.push("Complete nome e valor de cada produto lançado");
      }
    }
    for (const form of activeForms) {
      if (parseAmount(paymentValues[form.id] ?? "0,000") === null) {
        missing.push(`Informe o valor recebido em ${form.nome}`);
      }
    }
    if (missing.length) {
      setError(
        `Confira o fechamento: ${missing.slice(0, 6).join("; ")}${missing.length > 6 ? `; e mais ${missing.length - 6} item(ns)` : ""}.`,
      );
      return null;
    }

    const items: FechamentoItem[] = [
      ...(state.nozzles ?? []).map((nozzle) => {
        const entry = fuelEntries[nozzle.id] as FuelEntry;
        const liters = parseAmount(entry.liters) ?? 0;
        const price = parseAmount(entry.unitPrice) ?? 0;
        return {
          id: `bico-${nozzle.id}`,
          tipo: "combustivel" as const,
          bicoId: nozzle.id,
          produto: nozzle.name,
          litros: liters,
          preco: price,
          valor: Math.round(liters * price * 100) / 100,
        };
      }),
      ...products.map((product) => ({
        id: product.id,
        tipo: "produto" as const,
        produto: product.name.trim(),
        valor: Math.round((parseAmount(product.value) ?? 0) * 100) / 100,
      })),
      ...activeForms.map((form) => ({
        id: `forma-${form.id}`,
        tipo: "recebimento" as const,
        formaId: form.id,
        formaNome: form.nome,
        valor: Math.round((parseAmount(paymentValues[form.id] ?? "0,000") ?? 0) * 100) / 100,
      })),
    ];
    const roundedSales = Math.round(totalSales * 100) / 100;
    const roundedReceived = Math.round(totalReceived * 100) / 100;
    const differenceValue = Math.round((roundedReceived - roundedSales) * 100) / 100;
    return {
      data: date,
      turno,
      frentistaNome: cashierName.trim(),
      assinatura: signature.trim(),
      totalVendas: roundedSales,
      totalRecebido: roundedReceived,
      diferenca: differenceValue,
      status: differenceValue === 0 ? "ok" : differenceValue < 0 ? "faltando" : "sobrando",
      itens: items,
    };
  };

  const save = () => {
    const closing = createClosing();
    if (!closing) return;
    try {
      actions.addFechamento(closing);
      setError(null);
      setStatusMessage(`Fechamento do turno ${turno} salvo.`);
    } catch {
      setError(
        "Não foi possível salvar o fechamento. Verifique o espaço de armazenamento do aparelho.",
      );
    }
  };

  const exportPdf = async (share: boolean) => {
    const closing = createClosing();
    if (!closing) return;
    setBusy(true);
    setError(null);
    if (share) {
      try {
        actions.addFechamento(closing);
        const existingId = savedClose?.id ?? "preview";
        const blob = buildFechamentoCaixaPdf(state, { ...closing, id: existingId });
        const filename = fechamentoCaixaFileName({ ...closing, id: existingId });
        setStatusMessage(
          await sharePdf(blob, filename, `Fechamento de caixa ${formatBR(date)}, turno ${turno}.`),
        );
      } catch {
        setError("Não foi possível compartilhar. Tente salvar o PDF e anexá-lo no WhatsApp.");
      } finally {
        setBusy(false);
      }
    } else {
      try {
        actions.addFechamento(closing);
        const existingId = savedClose?.id ?? "preview";
        const blob = buildFechamentoCaixaPdf(state, { ...closing, id: existingId });
        const filename = fechamentoCaixaFileName({ ...closing, id: existingId });
        downloadBlob(blob, filename);
        setStatusMessage(`PDF salvo como ${filename}.`);
      } catch {
        setError("Não foi possível gerar ou salvar o PDF do fechamento.");
      } finally {
        setBusy(false);
      }
    }
  };

  const statusClass =
    closingStatus === "faltando"
      ? "bg-red-600 text-white"
      : closingStatus === "sobrando"
        ? "bg-blue-600 text-white"
        : "bg-green-600 text-white";

  return (
    <AppShell title="FECHAMENTO CAIXA" subtitle="Conferência por data e turno">
      <div className="w-full space-y-4 pb-6">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <WalletCards className="size-5 text-primary" />
            <h2 className="font-display text-xl text-foreground">Identificação do fechamento</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={isManager}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Turno</Label>
              <select
                value={turno}
                onChange={(event) => setTurno(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {shifts.map((shift) => (
                  <option key={shift} value={shift}>
                    Turno {shift}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Frentista caixa</Label>
              <Input
                value={cashierName}
                onChange={(event) => setCashierName(event.target.value)}
                className="mt-1"
                placeholder="Nome do responsável pelo caixa"
              />
            </div>
            <div>
              <Label>Assinatura do frentista caixa</Label>
              <Input
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                className="mt-1"
                placeholder="Digite o nome para assinatura no recibo"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h2 className="font-display text-lg text-foreground">Vendas de combustível por bico</h2>
            <p className="text-xs text-muted-foreground">
              Bicos cadastrados em Aferição. Informe litros e preço de venda por litro.
            </p>
          </div>
          {(state.nozzles ?? []).length === 0 ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
              Cadastre os bicos no menu Aferição para iniciar o fechamento.
            </p>
          ) : null}
          {(state.nozzles ?? []).map((nozzle) => {
            const entry = fuelEntries[nozzle.id] ?? {
              liters: "",
              unitPrice: configuredPrice(nozzle.id) ? money(configuredPrice(nozzle.id), 3) : "",
            };
            const tank = state.tanks.find((item) => item.id === nozzle.tankId);
            const rowTotal = (parseAmount(entry.liters) ?? 0) * (parseAmount(entry.unitPrice) ?? 0);
            return (
              <div
                key={nozzle.id}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-end"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{nozzle.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tank?.name ?? nozzle.fuel}
                  </p>
                </div>
                <div>
                  <Label>Litros vendidos</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={entry.liters}
                    onChange={(event) =>
                      setFuelEntries((current) => ({
                        ...current,
                        [nozzle.id]: { ...entry, liters: event.target.value },
                      }))
                    }
                    className="mt-1"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Valor por litro (R$)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={entry.unitPrice}
                    onChange={(event) =>
                      setFuelEntries((current) => ({
                        ...current,
                        [nozzle.id]: { ...entry, unitPrice: event.target.value },
                      }))
                    }
                    onBlur={() =>
                      setFuelEntries((current) => ({
                        ...current,
                        [nozzle.id]: { ...entry, unitPrice: moneyInput(entry.unitPrice, 3) },
                      }))
                    }
                    className="mt-1"
                    placeholder="0,000"
                  />
                </div>
                <div className="text-sm text-foreground">
                  Total do bico:{" "}
                  <strong>
                    {rowTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>
                </div>
              </div>
            );
          })}
          <p className="text-right text-sm font-semibold text-foreground">
            Total combustíveis:{" "}
            {fuelTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-foreground">Mini mercado e produtos</h2>
              <p className="text-xs text-muted-foreground">
                Lance manualmente os valores vendidos no turno.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addProduct}>
              <Plus className="size-4" /> Adicionar produto
            </Button>
          </div>
          {products.map((product) => (
            <div
              key={product.id}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <div>
                <Label>Produto / descrição</Label>
                <Input
                  value={product.name}
                  onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                  className="mt-1"
                  placeholder="Ex.: vendas da conveniência"
                />
              </div>
              <div>
                <Label>Valor vendido (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={product.value}
                  onChange={(event) => updateProduct(product.id, { value: event.target.value })}
                  onBlur={() => updateProduct(product.id, { value: moneyInput(product.value, 2) })}
                  className="mt-1"
                  placeholder="0,00"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remover produto"
                onClick={() =>
                  setProducts((current) => current.filter((item) => item.id !== product.id))
                }
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <p className="text-right text-sm font-semibold text-foreground">
            Total mini mercado e produtos:{" "}
            {productsTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </section>

        <section className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-right">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            TOTAL VENDIDO NO TURNO
          </p>
          <p className="font-display text-2xl tabular-nums text-foreground">
            {totalSales.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h2 className="font-display text-lg text-foreground">Formas de recebimento</h2>
            <p className="text-xs text-muted-foreground">
              Preencha todas as formas ativas. Informe 0,00 quando não houve recebimento.
            </p>
          </div>
          {activeForms.map((form) => (
            <div key={form.id} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-center">
              <Label className="text-sm text-foreground">{form.nome}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={paymentValues[form.id] ?? ""}
                onChange={(event) =>
                  setPaymentValues((current) => ({ ...current, [form.id]: event.target.value }))
                }
                onBlur={() =>
                  setPaymentValues((current) => ({
                    ...current,
                    [form.id]: moneyInput(current[form.id] ?? "", 2),
                  }))
                }
                placeholder="0,00"
                aria-label={`Valor recebido em ${form.nome}`}
              />
            </div>
          ))}
          {!isManager ? (
            <form
              className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                addPaymentForm();
              }}
            >
              <Input
                value={newFormName}
                onChange={(event) => setNewFormName(event.target.value)}
                placeholder="Nova forma de recebimento"
              />
              <Button type="submit" variant="outline" className="shrink-0">
                <Plus className="size-4" /> Adicionar forma
              </Button>
            </form>
          ) : null}
          <p className="text-right text-sm font-semibold text-foreground">
            Total recebido:{" "}
            {totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm text-foreground">
              <p>
                Total vendido no turno:{" "}
                <strong>
                  {totalSales.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </p>
              <p>
                Total recebido:{" "}
                <strong>
                  {totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </p>
            </div>
            <div className={`rounded-md px-4 py-2 text-center text-sm font-bold ${statusClass}`}>
              {closingStatus === "ok"
                ? "CAIXA CONFERIDO"
                : closingStatus === "faltando"
                  ? `FALTA DE CAIXA · ${Math.abs(difference).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                  : `SOBRA DE CAIXA · ${difference.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {statusMessage ? (
            <p role="status" className="text-sm text-muted-foreground">
              {statusMessage}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" onClick={save}>
              <Save className="size-4" /> Salvar fechamento
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void exportPdf(false)}
            >
              <FileDown className="size-4" /> Salvar PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void exportPdf(true)}
            >
              <Share2 className="size-4" /> Compartilhar WhatsApp
            </Button>
          </div>
        </section>

        {(state.fechamentos ?? []).some((closing) => !isManager || closing.data === today) ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-lg text-foreground">Histórico de fechamentos</h2>
            {(state.fechamentos ?? [])
              .filter((closing) => !isManager || closing.data === today)
              .map((closing) => (
                <div
                  key={closing.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <span className="text-foreground">
                    {formatBR(closing.data)} · Turno {closing.turno} ·{" "}
                    {closing.frentistaNome ?? "Caixa"}
                  </span>
                  <span className="font-semibold text-foreground">
                    Vendas{" "}
                    {closing.totalVendas.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}{" "}
                    · Recebido{" "}
                    {closing.totalRecebido.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
