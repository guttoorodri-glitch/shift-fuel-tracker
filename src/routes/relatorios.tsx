import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
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
import { ExportPdfSection } from "@/components/ExportPdfSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dailyTotals,
  fmtL,
  formatBR,
  monthStartISO,
  shiftISO,
  todayISO,
  totalInRange,
  totalsByTank,
  useAppState,
} from "@/lib/store";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatório de Vendas — Posto 10" },
      {
        name: "description",
        content:
          "Total vendido no mês desde o dia 01, filtro por período e gráficos de barras nas cores de cada combustível.",
      },
      { property: "og:title", content: "Relatório de Vendas — Posto 10" },
      {
        property: "og:description",
        content: "Acompanhe o volume vendido por combustível, por dia e por período.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const state = useAppState();
  const [today, setToday] = useState("1970-01-01");
  const [from, setFrom] = useState("1970-01-01");
  const [to, setTo] = useState("1970-01-01");

  useEffect(() => {
    const current = todayISO();
    setToday(current);
    setFrom(monthStartISO(current));
    setTo(current);
  }, []);

  const monthTotal = totalInRange(state, monthStartISO(today), today);
  const rangeTotal = totalInRange(state, from, to);

  const byTank = useMemo(() => {
    const totals = totalsByTank(state, from, to);
    return state.tanks.map((t, i) => ({
      name: `${i + 1}. ${t.name}`,
      short: `${i + 1}. ${t.name.length > 10 ? `${t.name.slice(0, 9)}…` : t.name}`,
      color: t.color,
      litros: totals[t.id] ?? 0,
    }));
  }, [state, from, to]);

  const byDay = useMemo(
    () =>
      dailyTotals(state, from, to).map((d) => ({
        ...d,
        label: d.date.slice(8) + "/" + d.date.slice(5, 7),
      })),
    [state, from, to],
  );

  const presets: { label: string; apply: () => void }[] = [
    { label: "Mês atual", apply: () => (setFrom(monthStartISO(today)), setTo(today)) },
    { label: "7 dias", apply: () => (setFrom(shiftISO(today, -6)), setTo(today)) },
    { label: "30 dias", apply: () => (setFrom(shiftISO(today, -29)), setTo(today)) },
    {
      label: "Mês anterior",
      apply: () => {
        const prevEnd = shiftISO(monthStartISO(today), -1);
        setFrom(monthStartISO(prevEnd));
        setTo(prevEnd);
      },
    },
  ];

  return (
    <AppShell title="Relatório Vendas Combustível" subtitle="Totais, períodos e gráficos">
      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Total do mês (desde {formatBR(monthStartISO(today))})
        </p>
        <p className="font-display text-4xl tabular-nums text-primary">{fmtL(monthTotal)}</p>
      </section>

      <ExportPdfSection />

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
          <span className="font-semibold tabular-nums text-foreground">{fmtL(rangeTotal)}</span>
        </p>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">Vendas por tanque</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byTank} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
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
              <Tooltip
                formatter={(v: number) => fmtL(v)}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="litros" radius={[6, 6, 0, 0]}>
                {byTank.map((t) => (
                  <Cell key={t.name} fill={t.color} />
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
                <Tooltip
                  formatter={(v: number) => fmtL(v)}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </AppShell>
  );
}
