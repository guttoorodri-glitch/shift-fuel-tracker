import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CalendarRange,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actions,
  fmtQty,
  formatBR,
  monthStartISO,
  productBalance,
  productDailyTotals,
  productSalesByProduct,
  productSold,
  shiftISO,
  todayISO,
  useAppState,
  weekStartISO,
  type Product,
} from "@/lib/store";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Venda de Produtos — Controle de Estoque do Posto 10" },
      {
        name: "description",
        content:
          "Cadastre produtos da loja de conveniência, lance as vendas por turno, registre reposições e acompanhe o saldo de estoque com gráficos comparativos.",
      },
      { property: "og:title", content: "Venda de Produtos — Controle de Estoque do Posto 10" },
      {
        property: "og:description",
        content:
          "Controle diário de vendas de produtos por turno, reposições e saldo de estoque atualizado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProdutosPage,
});

const PALETTE = ["#e0b428", "#e2632c", "#3fa06a", "#3b82c4", "#a855f7", "#ef4444"];

function ProdutosPage() {
  const state = useAppState();
  const today = todayISO();
  const [tab, setTab] = useState<"vendas" | "estoque" | "relatorio">("vendas");

  return (
    <AppShell title="Produtos" subtitle="Vendas, estoque e reposição">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            ["vendas", "Vendas"],
            ["estoque", "Estoque"],
            ["relatorio", "Relatório"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "vendas" ? <VendasTab today={today} /> : null}
      {tab === "estoque" ? <EstoqueTab today={today} /> : null}
      {tab === "relatorio" ? <RelatorioTab today={today} /> : null}

      {state.products.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
          Cadastre seus produtos na aba <strong>Estoque</strong> para começar a lançar as
          vendas por turno.
        </p>
      ) : null}
    </AppShell>
  );
}

/* ---------------- Vendas por turno ---------------- */

function VendasTab({ today }: { today: string }) {
  const state = useAppState();
  const [date, setDate] = useState(today);
  const shifts = Array.from({ length: state.shifts }, (_, i) => i + 1);

  return (
    <>
      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <Label className="text-xs text-muted-foreground">Dia do lançamento</Label>
        <Input
          className="mt-1"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {formatBR(date)} — {state.shifts} turno(s) cadastrado(s)
        </p>
      </section>

      {shifts.map((shift) => (
        <section key={shift} className="mb-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-display text-lg text-foreground">Turno {shift}</h2>
          {state.products.map((p, i) => (
            <QtyRow
              key={p.id}
              label={`${i + 1}. ${p.name}`}
              color={p.color}
              unit={p.unit}
              value={state.productSales[date]?.[shift]?.[p.id]}
              onSave={(v) => actions.setProductSale(date, shift, p.id, v)}
            />
          ))}
          {state.products.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum produto cadastrado.</p>
          ) : null}
        </section>
      ))}

      {state.products.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg text-foreground">Saldo em estoque</h2>
          {state.products.map((p, i) => {
            const balance = productBalance(state, p.id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0"
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {i + 1}. {p.name}
                </span>
                <span
                  className={`font-display text-lg tabular-nums ${
                    balance <= 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {fmtQty(balance)} {p.unit}
                </span>
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}

function QtyRow({
  label,
  color,
  unit,
  value,
  onSave,
}: {
  label: string;
  color: string;
  unit: string;
  value: number | undefined;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(value === undefined);
  const [draft, setDraft] = useState(value !== undefined ? String(value) : "");

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || draft.trim() === "") return;
    onSave(parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            inputMode="decimal"
            value={draft}
            placeholder="Qtd"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="h-9 w-24 text-right"
          />
          <Button size="sm" className="h-9" onClick={commit}>
            OK
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="font-display text-lg tabular-nums text-foreground">
            {value !== undefined ? `${fmtQty(value)} ${unit}` : "—"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-muted-foreground"
            aria-label={`Editar ${label}`}
            onClick={() => {
              setDraft(value !== undefined ? String(value) : "");
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Estoque e reposição ---------------- */

function EstoqueTab({ today }: { today: string }) {
  const state = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Boxes className="size-4 text-primary" />
          <h2 className="font-display text-lg text-foreground">Produtos cadastrados</h2>
        </div>

        <div className="space-y-2">
          {state.products.map((p, i) =>
            editing === p.id ? (
              <ProductEditor
                key={p.id}
                index={i}
                product={p}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md font-display text-sm text-black"
                  style={{ backgroundColor: p.color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Saldo: {fmtQty(productBalance(state, p.id))} {p.unit} · inicial{" "}
                    {fmtQty(p.initialStock)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => setEditing(p.id)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 text-destructive"
                  aria-label={`Excluir ${p.name}`}
                  onClick={() => actions.removeProduct(p.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ),
          )}
        </div>

        {creating ? (
          <div className="mt-3">
            <ProductEditor index={state.products.length} onDone={() => setCreating(false)} />
          </div>
        ) : (
          <Button variant="outline" className="mt-3 w-full" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Cadastrar produto
          </Button>
        )}
      </section>

      <RestockSection today={today} />
    </>
  );
}

function ProductEditor({
  product,
  index,
  onDone,
}: {
  product?: Product;
  index: number;
  onDone: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "un");
  const [color, setColor] = useState(product?.color ?? PALETTE[index % PALETTE.length]!);
  const [stock, setStock] = useState(String(product?.initialStock ?? ""));

  const save = () => {
    const parsed = Number(stock.replace(",", ".")) || 0;
    if (!name.trim()) return;
    if (product) {
      actions.updateProduct(product.id, {
        name: name.trim(),
        unit: unit.trim() || "un",
        color,
        initialStock: parsed,
      });
    } else {
      actions.addProduct({
        name: name.trim(),
        unit: unit.trim() || "un",
        color,
        initialStock: parsed,
      });
    }
    onDone();
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-muted/50 p-3">
      <div>
        <Label className="text-xs text-muted-foreground">Produto {index + 1}</Label>
        <Input
          className="mt-1"
          value={name}
          placeholder="Ex.: Água 500ml"
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Unidade</Label>
          <Input
            className="mt-1"
            value={unit}
            placeholder="un / cx / kg"
            onChange={(e) => setUnit(e.target.value)}
            maxLength={8}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Estoque atual</Label>
          <Input
            className="mt-1"
            inputMode="decimal"
            value={stock}
            placeholder="0"
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Cor</Label>
        <div className="mt-1 flex items-center gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => setColor(c)}
              className={`size-7 rounded-full border-2 ${
                color === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save}>
          Salvar
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function RestockSection({ today }: { today: string }) {
  const state = useAppState();
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState("");

  const selected = productId || state.products[0]?.id || "";

  const add = () => {
    const parsed = Number(qty.replace(",", "."));
    if (!selected || !Number.isFinite(parsed) || parsed <= 0) return;
    actions.addRestock({ productId: selected, date, qty: parsed });
    setQty("");
  };

  const list = [...state.restocks].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <PackagePlus className="size-4 text-primary" />
        <h2 className="font-display text-lg text-foreground">Reposição de produto</h2>
      </div>

      {state.products.length === 0 ? (
        <p className="text-xs text-muted-foreground">Cadastre um produto primeiro.</p>
      ) : (
        <>
          <Label className="text-xs text-muted-foreground">Produto</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={selected}
            onChange={(e) => setProductId(e.target.value)}
          >
            {state.products.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.name}
              </option>
            ))}
          </select>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input
                className="mt-1"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quantidade</Label>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={qty}
                placeholder="0"
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-3 w-full" onClick={add}>
            <Plus className="size-4" /> Lançar reposição
          </Button>

          {list.length > 0 ? (
            <div className="mt-4 space-y-1">
              {list.map((r) => {
                const p = state.products.find((x) => x.id === r.productId);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 border-b border-border/60 py-2 text-sm last:border-0"
                  >
                    <span className="flex-1 truncate text-foreground">
                      {formatBR(r.date)} — {p?.name ?? "Produto removido"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      +{fmtQty(r.qty)} {p?.unit ?? ""}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      aria-label="Excluir reposição"
                      onClick={() => actions.removeRestock(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ---------------- Relatório ---------------- */

function RelatorioTab({ today }: { today: string }) {
  const state = useAppState();
  const [from, setFrom] = useState(monthStartISO(today));
  const [to, setTo] = useState(today);

  const totalDia = useMemo(
    () => state.products.reduce((a, p) => a + productSold(state, p.id, today, today), 0),
    [state, today],
  );
  const totalSemana = useMemo(
    () =>
      state.products.reduce(
        (a, p) => a + productSold(state, p.id, weekStartISO(today), today),
        0,
      ),
    [state, today],
  );
  const totalMes = useMemo(
    () =>
      state.products.reduce(
        (a, p) => a + productSold(state, p.id, monthStartISO(today), today),
        0,
      ),
    [state, today],
  );

  const byProduct = useMemo(() => {
    const totals = productSalesByProduct(state, from, to);
    return state.products.map((p, i) => ({
      name: `${i + 1}. ${p.name}`,
      short: `${i + 1}. ${p.name.length > 10 ? `${p.name.slice(0, 9)}…` : p.name}`,
      color: p.color,
      qtd: totals[p.id] ?? 0,
    }));
  }, [state, from, to]);

  const byDay = useMemo(
    () =>
      productDailyTotals(state, from, to).map((d) => ({
        ...d,
        label: `${d.date.slice(8)}/${d.date.slice(5, 7)}`,
      })),
    [state, from, to],
  );

  const rangeTotal = byProduct.reduce((a, b) => a + b.qtd, 0);

  const presets: { label: string; apply: () => void }[] = [
    { label: "Hoje", apply: () => (setFrom(today), setTo(today)) },
    { label: "Semana", apply: () => (setFrom(weekStartISO(today)), setTo(today)) },
    { label: "Mês atual", apply: () => (setFrom(monthStartISO(today)), setTo(today)) },
    { label: "30 dias", apply: () => (setFrom(shiftISO(today, -29)), setTo(today)) },
  ];

  const tooltipStyle = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
    fontSize: 12,
  };

  return (
    <>
      <section className="mb-5 grid grid-cols-3 gap-2">
        <Card label="Dia" value={totalDia} />
        <Card label="Semana" value={totalSemana} />
        <Card label="Mês" value={totalMes} />
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="size-4 text-primary" />
          <h2 className="font-display text-lg text-foreground">Filtrar período</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              className="mt-1"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              className="mt-1"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant="outline" onClick={p.apply}>
              {p.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Total no período:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {fmtQty(rangeTotal)}
          </span>
        </p>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h2 className="font-display text-lg text-foreground">Comparativo por produto</h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byProduct} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="short"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <Tooltip formatter={(v: number) => fmtQty(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                {byProduct.map((p) => (
                  <Cell key={p.name} fill={p.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">Vendas por dia</h2>
        {byDay.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma venda registrada no período.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <Tooltip formatter={(v: number) => fmtQty(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="font-display text-2xl tabular-nums text-primary">{fmtQty(value)}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
