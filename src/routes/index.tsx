import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Fuel, Gauge } from "lucide-react";
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
import { MeasureField } from "@/components/MeasureField";
import { TankGauge } from "@/components/TankGauge";

import { Button } from "@/components/ui/button";
import {
  actions,
  estimatedLevel,
  fmtL,
  formatBR,
  shiftISO,
  todayISO,
  totalSalesOfDay,
  useAppState,
  weekdayBR,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Turnos — Posto 10" },
      {
        name: "description",
        content:
          "Registre a medição dos tanques no início do turno 1 e as vendas de cada turno do posto, com edição de qualquer medida.",
      },
      { property: "og:title", content: "Controle de Turnos — Posto 10" },
      {
        property: "og:description",
        content: "Medições de tanques e vendas por turno na palma da mão.",
      },
    ],
  }),
  component: TurnosPage,
});

function TurnosPage() {
  const state = useAppState();
  const [date, setDate] = useState(todayISO());
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"barras" | "tanque">("barras");

  useEffect(() => {
    setMounted(true);
    setDate(todayISO());
  }, []);
  const shifts = Array.from({ length: state.shifts }, (_, i) => i + 1);

  return (
    <AppShell title="Controle de Turnos" subtitle="Medições e vendas do dia">
      <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-card p-2">
        <Button size="icon" variant="ghost" onClick={() => setDate(shiftISO(date, -1))}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="font-display text-xl text-foreground">{mounted ? formatBR(date) : ""}</p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {mounted ? weekdayBR(date) : ""}
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setDate(shiftISO(date, 1))}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center gap-2">
          <Gauge className="size-4 text-primary" />
          <h2 className="font-display text-lg text-foreground">Medição — início do Turno 1</h2>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Informe a medida de todos os tanques ao abrir o dia.
        </p>
        {state.tanks.map((t, i) => (
          <MeasureField
            key={t.id}
            label={`${i + 1}. ${t.name}`}
            color={t.color}
            value={state.openings[date]?.[t.id]}
            onSave={(v) => actions.setOpening(date, t.id, v)}
          />
        ))}
      </section>

      {shifts.map((shift) => (
        <section key={shift} className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-lg text-foreground">Vendas — Turno {shift}</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {state.attendants
              .filter((a) => a.shift === shift)
              .map((a) => `${a.name} (${a.start}–${a.end})`)
              .join(" · ") || "Nenhum frentista na escala deste turno"}
          </p>
          {state.tanks.map((t, i) => (
            <MeasureField
              key={t.id}
              label={`${i + 1}. ${t.name}`}
              color={t.color}
              placeholder="Litros"
              value={state.sales[date]?.[shift]?.[t.id]}
              onSave={(v) => actions.setSale(date, shift, t.id, v)}
            />
          ))}
        </section>
      ))}

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">Vendas do dia por combustível</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={state.tanks.map((t, i) => ({
                name: `${i + 1}. ${t.name.length > 10 ? `${t.name.slice(0, 9)}…` : t.name}`,
                color: t.color,
                litros: totalSalesOfDay(state, date, t.id),
              }))}
              margin={{ top: 4, right: 4, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
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
                {state.tanks.map((t) => (
                  <Cell key={t.id} fill={t.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-foreground">Estoque e vendas</h2>
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={view === "barras" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setView("barras")}
            >
              <BarChart3 className="mr-1 size-3.5" /> Barras
            </Button>
            <Button
              size="sm"
              variant={view === "tanque" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setView("tanque")}
            >
              <Fuel className="mr-1 size-3.5" /> Tanques
            </Button>
          </div>
        </div>

        {view === "tanque" ? (
          <div className="grid grid-cols-2 gap-3">
            {state.tanks.map((t, i) => {
              const sold = totalSalesOfDay(state, date, t.id);
              const level = estimatedLevel(state, date, t.id);
              const pct = level !== undefined ? Math.min(100, (level / t.capacity) * 100) : 0;
              return (
                <TankGauge
                  key={t.id}
                  index={i}
                  name={t.name}
                  color={t.color}
                  pct={pct}
                  levelLabel={
                    level !== undefined
                      ? `${fmtL(level)} de ${fmtL(t.capacity)}`
                      : `sem medição · ${fmtL(t.capacity)}`
                  }
                  soldLabel={fmtL(sold)}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {state.tanks.map((t, i) => {
              const sold = totalSalesOfDay(state, date, t.id);
              const level = estimatedLevel(state, date, t.id);
              const pct = level !== undefined ? Math.min(100, (level / t.capacity) * 100) : 0;
              return (
                <div key={t.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-foreground">
                      {i + 1}. {t.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      vendido {fmtL(sold)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: t.color }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {level !== undefined
                      ? `Estoque estimado ${fmtL(level)} de ${fmtL(t.capacity)}`
                      : `Sem medição de abertura · capacidade ${fmtL(t.capacity)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </AppShell>
  );
}
