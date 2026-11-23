import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Fuel } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { MeasureField } from "@/components/MeasureField";
import { TankGauge } from "@/components/TankGauge";
import { calculateDailySalesSummary } from "@/lib/daily-sales-summary";
import { fiscalStatusColor, fiscalStatusLabel, useFiscalDocuments } from "@/lib/fiscalizacao";
import { calculateTankAutonomy, formatAutonomy, formatTankLiters } from "@/lib/tank-autonomy";
import {
  findDivergenceRecord,
  formatDivergencePercent,
  getDivergenceRecords,
  saveDivergenceRecord,
  subscribeToDivergenceChanges,
  type TankDivergence,
} from "@/lib/divergence";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions, fmtL, formatBR, shiftISO, todayISO, useAppState, weekdayBR } from "@/lib/store";
import { useSubscription } from "@/hooks/useSubscription";

const SHIFT_COLORS = ["#7c3aed", "#0f766e", "#be123c", "#1d4ed8", "#854d0e", "#334155"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MEDIDAS / VENDAS DIÁRIAS — Posto 10" },
      {
        name: "description",
        content:
          "Registre a medição dos tanques no início do turno 1 e as vendas de cada turno do posto, com edição de qualquer medida.",
      },
      { property: "og:title", content: "MEDIDAS / VENDAS DIÁRIAS — Posto 10" },
      {
        property: "og:description",
        content: "Medições de tanques e vendas por turno na palma da mão.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const subscription = useSubscription();
  return subscription.isAuthenticated ? <TurnosPage /> : <LandingPage />;
}

function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <a href="/" className="font-display text-3xl tracking-wide text-amber-300">
          POSTO 10
        </a>
        <nav className="flex flex-wrap justify-end gap-2">
          <a
            href="/login"
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white"
          >
            ENTRAR
          </a>
          <a
            href="/cadastro?plano=TRIAL_48H"
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black"
          >
            TESTAR 48H GRÁTIS
          </a>
          <a
            href="/planos"
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white"
          >
            ASSINAR
          </a>
        </nav>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-24">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-amber-300">
            CONTROLE DE OPERAÇÕES PARA POSTOS
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-tight sm:text-6xl">
            CONTROLE SEU POSTO NA PALMA DA MÃO
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Fechamento de caixa, recebimento de combustível, mix de gasolina aditivada, metas e
            equipe. Sem planilha.
          </p>
          <a
            href="/cadastro?plano=TRIAL_48H"
            className="mt-8 inline-flex rounded-xl bg-amber-500 px-6 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-amber-400"
          >
            COMEÇAR TESTE DE 48H GRÁTIS
          </a>
        </div>
        <div className="grid gap-4">
          {[
            ["01", "PROPRIETÁRIO SÓ ACOMPANHA", "A equipe registra. O proprietário visualiza."],
            ["02", "MIX DE COMPRA AUTOMÁTICO", "Acompanhe gasolina comum e aditivada no mês."],
            ["03", "TRAVA DE 48H PARA TESTAR", "Experimente o app antes de assinar."],
          ].map(([number, title, description]) => (
            <article key={number} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-bold text-amber-300">{number}</p>
              <h2 className="mt-2 text-lg font-bold">{title}</h2>
              <p className="mt-1 text-sm text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-slate-400">
        POSTO 10 · CONTROLE DE OPERAÇÕES
      </footer>
    </main>
  );
}

function TurnosPage() {
  const state = useAppState();
  const { documents: fiscalDocuments } = useFiscalDocuments();
  const [date, setDate] = useState(todayISO());
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"barras" | "tanque">("barras");
  const [draftMeasurements, setDraftMeasurements] = useState<Record<string, number | undefined>>(
    {},
  );
  const [draftSales, setDraftSales] = useState<Record<string, number | undefined>>({});
  const [salesPreview, setSalesPreview] = useState<Record<string, number | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [divergenceRecords, setDivergenceRecords] = useState<TankDivergence[]>([]);
  const [physicalDrafts, setPhysicalDrafts] = useState<Record<string, string>>({});
  const [divergenceError, setDivergenceError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setDate(todayISO());
  }, []);
  useEffect(() => {
    const refresh = () => {
      try {
        setDivergenceRecords(getDivergenceRecords());
      } catch {
        setDivergenceError("NÃO FOI POSSÍVEL CARREGAR O HISTÓRICO DE DIVERGÊNCIAS.");
      }
    };
    refresh();
    return subscribeToDivergenceChanges(refresh);
  }, []);
  useEffect(() => {
    setPhysicalDrafts((current) => {
      const next = { ...current };
      for (const tank of state.tanks) {
        const saved = findDivergenceRecord(divergenceRecords, date, tank.id);
        if (saved) next[tank.id] = String(saved.physical);
        else delete next[tank.id];
      }
      return next;
    });
    setDivergenceError(null);
  }, [date, divergenceRecords, state.tanks]);
  const shifts = Array.from({ length: state.shifts }, (_, i) => i + 1);
  useEffect(() => {
    const salesDraft: Record<string, number | undefined> = {};
    const measurementsDraft: Record<string, number | undefined> = {};
    for (let shift = 1; shift <= state.shifts; shift += 1) {
      for (const tank of state.tanks) {
        salesDraft[`${shift}-${tank.id}`] = state.sales[date]?.[shift]?.[tank.id];
        measurementsDraft[`${shift}-${tank.id}`] =
          state.shiftMeasurements?.[date]?.[shift]?.[tank.id];
      }
    }
    setDraftSales(salesDraft);
    setDraftMeasurements(measurementsDraft);
    setSalesPreview({});
    setSaveError(null);
  }, [date, state.sales, state.shiftMeasurements, state.shifts, state.tanks]);

  const saveDailyEntries = () => {
    const missingMeasurements = state.tanks
      .filter((tank) => draftMeasurements[`1-${tank.id}`] === undefined)
      .map((tank) => `Medição manual do Turno 1: ${tank.name}`);
    const missingSales = shifts.flatMap((shift) =>
      state.tanks
        .filter((tank) => draftSales[`${shift}-${tank.id}`] === undefined)
        .map((tank) => `Venda do Turno ${shift}: ${tank.name}`),
    );
    const missing = [...missingMeasurements, ...missingSales];
    if (missing.length) {
      setSaveError(
        `Preencha a medição manual do Turno 1 e as vendas de todos os turnos. Faltando: ${missing.join(", ")}.`,
      );
      return;
    }

    for (const tank of state.tanks) {
      actions.setShiftMeasurement(date, 1, tank.id, draftMeasurements[`1-${tank.id}`] ?? 0);
      let measurement = (draftMeasurements[`1-${tank.id}`] ?? 0) + receivedForTank(tank.id);
      for (const shift of shifts) {
        actions.setSale(date, shift, tank.id, saleForTurn(shift, tank.id));
        if (shift > 1) {
          actions.setShiftMeasurement(date, shift, tank.id, measurement);
        }
        measurement -= saleForTurn(shift, tank.id);
      }
    }
    setSaveError(null);
  };

  const shiftColor = (shift: number) => {
    const fuelColors = new Set(state.tanks.map((tank) => tank.color.toLowerCase()));
    const available = SHIFT_COLORS.filter((color) => !fuelColors.has(color.toLowerCase()));
    return (
      available[(shift - 1) % available.length] ?? SHIFT_COLORS[(shift - 1) % SHIFT_COLORS.length]
    );
  };

  const deliveriesForDate = (state.deliveries ?? []).filter((delivery) => delivery.date === date);
  const tankForDeliveryItem = (tankId: string, fuel: string, itemTankId?: string) => {
    if (itemTankId) return itemTankId === tankId;
    const normalizedFuel = fuel.trim().toLocaleLowerCase("pt-BR");
    const matchingTanks = state.tanks.filter(
      (tank) => tank.name.trim().toLocaleLowerCase("pt-BR") === normalizedFuel,
    );
    return matchingTanks.length === 1 && matchingTanks[0]?.id === tankId;
  };
  const receivedForTank = (tankId: string) =>
    deliveriesForDate.reduce(
      (total, delivery) =>
        total +
        delivery.items.reduce(
          (subtotal, item) =>
            subtotal + (tankForDeliveryItem(tankId, item.fuel, item.tankId) ? item.qty : 0),
          0,
        ),
      0,
    );
  const saleForTurn = (shift: number, tankId: string) => {
    const key = `${shift}-${tankId}`;
    const preview = salesPreview[key];
    return preview !== undefined
      ? (preview ?? 0)
      : (draftSales[key] ?? state.sales[date]?.[shift]?.[tankId] ?? 0);
  };
  const measurementForTurn = (shift: number, tankId: string) => {
    const initial =
      draftMeasurements[`1-${tankId}`] ?? state.shiftMeasurements?.[date]?.[1]?.[tankId];
    if (initial === undefined) return undefined;
    let measurement = initial + receivedForTank(tankId);
    for (let previousShift = 1; previousShift < shift; previousShift += 1) {
      measurement -= saleForTurn(previousShift, tankId);
    }
    return measurement;
  };
  const soldForTank = (tankId: string) =>
    shifts.reduce((total, shift) => total + saleForTurn(shift, tankId), 0);

  const dailySummary = calculateDailySalesSummary(state.tanks, (shift, tankId) => {
    const key = `${shift}-${tankId}`;
    return salesPreview[key] !== undefined
      ? salesPreview[key]
      : (draftSales[key] ?? state.sales[date]?.[shift]?.[tankId] ?? 0);
  });
  const formatSummaryLiters = (liters: number) => `${Math.round(liters).toLocaleString("pt-BR")} L`;
  const formattedMix =
    dailySummary.mixAditivada === null
      ? null
      : dailySummary.mixAditivada.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const urgentFiscalDocuments = fiscalDocuments
    .filter((document) => document.status === "VENCIDO" || document.status === "ROXO_30")
    .slice(0, 3);

  const stockForTank = (tankId: string) => {
    const turnOneMeasurement =
      draftMeasurements[`1-${tankId}`] ?? state.shiftMeasurements?.[date]?.[1]?.[tankId];
    return turnOneMeasurement === undefined
      ? undefined
      : turnOneMeasurement + receivedForTank(tankId) - soldForTank(tankId);
  };
  const hasNegativeMeasurement = state.tanks.some((tank) =>
    shifts.some((shift) => {
      const initial =
        draftMeasurements[`1-${tank.id}`] ?? state.shiftMeasurements?.[date]?.[1]?.[tank.id];
      const measurement =
        shift === 1
          ? initial === undefined
            ? undefined
            : initial + receivedForTank(tank.id)
          : measurementForTurn(shift, tank.id);
      return measurement !== undefined && measurement < 0;
    }),
  );
  const deliverySummary = state.tanks
    .map((tank) => ({ tank, liters: receivedForTank(tank.id) }))
    .filter(({ liters }) => liters > 0);
  const tankAutonomy = calculateTankAutonomy(state, todayISO());
  const theoreticalForTank = (tankId: string) => {
    const initial =
      draftMeasurements[`1-${tankId}`] ?? state.shiftMeasurements?.[date]?.[1]?.[tankId];
    if (initial === undefined) return undefined;
    return (
      initial +
      receivedForTank(tankId) -
      shifts.reduce((sum, shift) => sum + saleForTurn(shift, tankId), 0)
    );
  };
  const savePhysicalMeasurement = (tankId: string) => {
    const tank = state.tanks.find((item) => item.id === tankId);
    const physical = Number((physicalDrafts[tankId] ?? "").replace(",", "."));
    const theoretical = theoreticalForTank(tankId);
    if (!tank || theoretical === undefined || !Number.isFinite(physical) || physical < 0) {
      setDivergenceError("INFORME UMA MEDIÇÃO FÍSICA VÁLIDA E A MEDIÇÃO MANUAL DO TURNO 1.");
      return;
    }
    try {
      saveDivergenceRecord(date, tankId, theoretical, physical, tank.capacity);
      setDivergenceError(null);
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL SALVAR A MEDIÇÃO FÍSICA.", error);
      setDivergenceError("NÃO FOI POSSÍVEL SALVAR A DIVERGÊNCIA. TENTE NOVAMENTE.");
    }
  };
  const divergenceRows = state.tanks.map((tank, index) => {
    const saved = findDivergenceRecord(divergenceRecords, date, tank.id);
    const theoretical = theoreticalForTank(tank.id);
    return { tank, index, saved, theoretical };
  });
  const divergenceChartData = useMemo(() => {
    const todayDate = new Date(`${date}T12:00:00`);
    const dateList = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(todayDate);
      day.setDate(day.getDate() - (6 - index));
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    });
    return dateList.map((chartDate) => {
      const point: Record<string, string | number | undefined> = {
        date: chartDate.slice(8, 10) + "/" + chartDate.slice(5, 7),
      };
      for (const tank of state.tanks) {
        point[tank.id] = findDivergenceRecord(divergenceRecords, chartDate, tank.id)?.diffPercent;
      }
      return point;
    });
  }, [date, divergenceRecords, state.tanks]);

  return (
    <AppShell title="MEDIDAS / VENDAS DIÁRIAS" subtitle="Medições e vendas do dia">
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

      <section className="mb-5 rounded-xl border border-[#b7791f] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <AlertTriangle className="size-5 text-[#b7791f]" /> ALERTA FISCALIZAÇÃO
          </h2>
          <Link
            to="/fiscalizacao"
            className="text-xs font-bold text-[#8a5817] underline underline-offset-2"
          >
            VER TODOS
          </Link>
        </div>
        {urgentFiscalDocuments.length ? (
          <ul className="grid gap-2 sm:grid-cols-3">
            {urgentFiscalDocuments.map((document) => (
              <li
                key={document.id}
                className="rounded-md border-l-4 bg-amber-50 p-2 text-xs"
                style={{ borderLeftColor: fiscalStatusColor(document.status) }}
              >
                <p className="font-bold text-foreground">{document.nomeDocumento}</p>
                <p className="mt-1 text-muted-foreground">{document.orgao}</p>
                <p className="mt-1 font-bold" style={{ color: fiscalStatusColor(document.status) }}>
                  {fiscalStatusLabel(document)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            NENHUM DOCUMENTO VENCIDO OU COM VENCIMENTO NOS PRÓXIMOS 30 DIAS.
          </p>
        )}
      </section>

      <section className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(130px,180px)] overflow-hidden rounded-xl border-2 border-purple-600 bg-white">
        <h2 className="col-span-full border-b border-purple-200 px-3 py-2 text-sm font-bold text-foreground">
          RESUMO DO DIA - TOTALIZADO
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
          {dailySummary.fuels.map((fuel) => (
            <div
              key={fuel.id}
              className="flex min-h-16 flex-col justify-center border-b border-r border-purple-100 px-3 py-2 text-sm font-bold text-foreground"
            >
              <span>{fuel.name}</span>
              <span className="tabular-nums">{formatSummaryLiters(fuel.liters)}</span>
            </div>
          ))}
        </div>
        <div
          className="flex min-h-16 flex-col justify-center border-l border-purple-200 px-3 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: "#dc2626" }}
        >
          <span>TOTAL DO DIA</span>
          <span className="tabular-nums">{formatSummaryLiters(dailySummary.totalGeralLitros)}</span>
          {formattedMix !== null ? <span>Mix {formattedMix}%</span> : null}
        </div>
      </section>

      {shifts.map((shift) => (
        <div key={shift} className="mb-6 space-y-3">
          <section
            className="rounded-xl border-l-4 border border-border bg-card p-4"
            style={{ borderLeftColor: shiftColor(shift) }}
          >
            <h2 className="font-display text-lg" style={{ color: shiftColor(shift) }}>
              Medição — Turno {shift}
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              {shift === 1
                ? "Informe a medição manual inicial. Os recebimentos do dia são somados automaticamente."
                : "Medição calculada automaticamente a partir do saldo anterior e das vendas do turno anterior."}
            </p>
            {state.tanks.map((tank, index) => (
              <MeasureField
                key={tank.id}
                label={`TANQUE ${String(index + 1).padStart(2, "0")} — ${tank.name}`}
                color={shiftColor(shift)}
                placeholder="Litros medidos manualmente"
                value={
                  shift === 1
                    ? draftMeasurements[`1-${tank.id}`]
                    : measurementForTurn(shift, tank.id)
                }
                readOnly={shift > 1}
                onSave={(value) => {
                  setDraftMeasurements((current) => ({ ...current, [`1-${tank.id}`]: value }));
                  setSaveError(null);
                }}
              />
            ))}
            {shift === 1 && deliverySummary.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                SALDO T1 APÓS RECEBIMENTOS:{" "}
                {deliverySummary
                  .map(({ tank, liters }) => {
                    const manual =
                      draftMeasurements[`1-${tank.id}`] ??
                      state.shiftMeasurements?.[date]?.[1]?.[tank.id] ??
                      0;
                    return `${tank.name}: ${fmtL(manual + liters)} (+${fmtL(liters)})`;
                  })
                  .join(" · ")}
              </p>
            ) : null}
          </section>

          <section
            className="rounded-xl border-l-4 border border-border bg-card p-4"
            style={{ borderLeftColor: shiftColor(shift) }}
          >
            <h2 className="font-display text-lg" style={{ color: shiftColor(shift) }}>
              Vendas — Turno {shift}
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              {state.attendants
                .filter((attendant) => attendant.shift === shift)
                .map((attendant) => `${attendant.name} (${attendant.start}–${attendant.end})`)
                .join(" · ") || "Nenhum frentista na escala deste turno"}
            </p>
            {state.tanks.map((tank, index) => (
              <MeasureField
                key={tank.id}
                label={`TANQUE ${String(index + 1).padStart(2, "0")} — ${tank.name}`}
                color={shiftColor(shift)}
                placeholder="Litros vendidos"
                value={draftSales[`${shift}-${tank.id}`]}
                onDraftChange={(value) =>
                  setSalesPreview((current) => {
                    const key = `${shift}-${tank.id}`;
                    if (value === undefined) {
                      const { [key]: _removed, ...remaining } = current;
                      return remaining;
                    }
                    return { ...current, [key]: value };
                  })
                }
                onSave={(value) => {
                  setDraftSales((current) => ({ ...current, [`${shift}-${tank.id}`]: value }));
                  setSaveError(null);
                }}
              />
            ))}
          </section>
        </div>
      ))}

      {deliverySummary.length > 0 ? (
        <section
          role="status"
          className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"
        >
          ⛽ RECEBIMENTO{" "}
          {deliverySummary
            .map(({ tank, liters }) => {
              const manual =
                draftMeasurements[`1-${tank.id}`] ??
                state.shiftMeasurements?.[date]?.[1]?.[tank.id] ??
                0;
              return `${fmtL(liters)} ADICIONADOS AO ${tank.name.toUpperCase()} — T1 ${fmtL(manual + liters)}`;
            })
            .join(" · ")}
          {" — "}MEDIÇÕES RECALCULADAS
        </section>
      ) : null}

      {hasNegativeMeasurement ? (
        <section
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-bold text-destructive"
        >
          <AlertTriangle className="size-5 shrink-0" />
          MEDIÇÃO NEGATIVA — VERIFICAR VENDAS OU RECEBIMENTO
        </section>
      ) : null}

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <Button className="w-full" onClick={saveDailyEntries}>
          Salvar medição e vendas dos turnos
        </Button>
        {saveError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {saveError}
          </p>
        ) : null}
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">Vendas do dia por combustível</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={state.tanks.map((t, i) => ({
                name: `${i + 1}. ${t.name.length > 10 ? `${t.name.slice(0, 9)}…` : t.name}`,
                color: t.color,
                litros: soldForTank(t.id),
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
          <h2 className="font-display text-lg text-foreground">Estoque</h2>
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

        <div className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase text-muted-foreground">
                <th className="p-2">Tanque</th>
                <th className="p-2">Estoque atual</th>
                <th className="p-2">Capacidade</th>
                <th className="p-2">%</th>
                <th className="p-2">Autonomia</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tankAutonomy.map((entry) => {
                const percent = entry.percent;
                const barColor =
                  percent !== undefined && percent <= 25
                    ? "#dc2626"
                    : percent !== undefined && percent <= 50
                      ? "#eab308"
                      : "#16a34a";
                return (
                  <tr key={entry.tank.id} className="border-b border-border/60 last:border-0">
                    <td className="p-2 font-semibold text-foreground">
                      TANQUE {String(entry.index + 1).padStart(2, "0")} — {entry.tank.name}
                    </td>
                    <td className="p-2 tabular-nums">
                      {entry.stock === undefined ? "SEM MEDIÇÃO" : formatTankLiters(entry.stock)}
                    </td>
                    <td className="p-2 tabular-nums">{formatTankLiters(entry.tank.capacity)}</td>
                    <td className="min-w-32 p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, percent ?? 0))}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>
                        <span className="tabular-nums">
                          {percent === undefined
                            ? "—"
                            : `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">{formatAutonomy(entry.autonomyHours)}</td>
                    <td
                      className={`p-2 font-extrabold ${
                        percent !== undefined && percent <= 25
                          ? "text-red-600"
                          : percent !== undefined && percent <= 50
                            ? "text-amber-600"
                            : "text-green-700"
                      }`}
                    >
                      {percent === undefined
                        ? "SEM MEDIÇÃO"
                        : percent <= 25
                          ? "🔴 PEDIR"
                          : percent <= 50
                            ? "🟡 ATENÇÃO"
                            : "OK"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {view === "tanque" ? (
          <div className="grid grid-cols-2 gap-3">
            {state.tanks.map((t, i) => {
              const sold = soldForTank(t.id);
              const level = stockForTank(t.id);
              const pct =
                level !== undefined ? Math.min(100, Math.max(0, (level / t.capacity) * 100)) : 0;
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
              const sold = soldForTank(t.id);
              const level = stockForTank(t.id);
              const pct =
                level !== undefined ? Math.min(100, Math.max(0, (level / t.capacity) * 100)) : 0;
              return (
                <div key={t.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-foreground">
                      {i + 1}. {t.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">vendido {fmtL(sold)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: t.color }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {level !== undefined
                      ? `Estoque calculado ${fmtL(level)} de ${fmtL(t.capacity)} (medição do Turno 1 menos vendas dos turnos)`
                      : `Informe a medição do Turno 1 · capacidade ${fmtL(t.capacity)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3">
          <h2 className="font-display text-lg text-foreground">
            DIVERGÊNCIA — ESTOQUE TEÓRICO VS FÍSICO
          </h2>
          <p className="text-xs text-muted-foreground">
            INFORME A MEDIÇÃO FEITA COM A RÉGUA PARA COMPARAR COM T1 + RECEBIMENTOS − VENDAS.
            TOLERÂNCIA: 0,6% DA CAPACIDADE.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase text-muted-foreground">
                <th className="p-2">Tanque</th>
                <th className="p-2">Teórico</th>
                <th className="p-2">Físico (régua)</th>
                <th className="p-2">Diferença L</th>
                <th className="p-2">Diferença %</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {divergenceRows.map(({ tank, index, saved, theoretical }) => (
                <tr key={tank.id} className="border-b border-border/60 last:border-0">
                  <td className="p-2 font-semibold text-foreground">
                    TANQUE {String(index + 1).padStart(2, "0")} — {tank.name}
                  </td>
                  <td className="p-2 tabular-nums">
                    {theoretical === undefined ? "SEM T1" : formatTankLiters(theoretical)}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Medição física do Tanque ${index + 1}`}
                        className="h-8 w-28"
                        inputMode="decimal"
                        placeholder="Litros"
                        value={physicalDrafts[tank.id] ?? ""}
                        onChange={(event) =>
                          setPhysicalDrafts((current) => ({
                            ...current,
                            [tank.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-[#b7791f] px-2 text-[10px] text-white hover:bg-[#9a6419]"
                        disabled={theoretical === undefined}
                        onClick={() => savePhysicalMeasurement(tank.id)}
                      >
                        SALVAR RÉGUA
                      </Button>
                    </div>
                  </td>
                  <td className="p-2 tabular-nums">
                    {saved
                      ? `${saved.diffLiters > 0 ? "+" : ""}${formatTankLiters(saved.diffLiters)}`
                      : "—"}
                  </td>
                  <td className="p-2 tabular-nums">
                    {saved ? formatDivergencePercent(saved.diffPercent) : "—"}
                  </td>
                  <td
                    className={`p-2 font-bold ${
                      saved?.status === "CRITICA"
                        ? "animate-pulse text-red-600"
                        : saved?.status === "DIVERGENCIA"
                          ? "text-amber-700"
                          : saved?.status === "OK"
                            ? "text-[#b7791f]"
                            : "text-muted-foreground"
                    }`}
                  >
                    {saved?.status === "CRITICA"
                      ? `🚨 POSSÍVEL RALO / VAZAMENTO — ${saved.consecutiveDays} DIAS`
                      : saved?.status === "DIVERGENCIA"
                        ? "DIVERGÊNCIA ACIMA DA TOLERÂNCIA"
                        : saved?.status === "OK"
                          ? "DENTRO DA TOLERÂNCIA — OK"
                          : "AGUARDANDO MEDIÇÃO"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {divergenceError ? (
          <p role="alert" className="mt-2 text-xs font-bold text-destructive">
            {divergenceError}
          </p>
        ) : null}
        <h3 className="mb-2 mt-5 text-sm font-bold text-foreground">
          TENDÊNCIA DA DIVERGÊNCIA — ÚLTIMOS 7 DIAS
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={divergenceChartData}
              margin={{ top: 4, right: 12, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis
                unit="%"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <Tooltip
                formatter={(value: number, tankId: string) => [
                  formatDivergencePercent(value),
                  state.tanks.find((tank) => tank.id === tankId)?.name ?? tankId,
                ]}
              />
              <Legend
                formatter={(tankId: string) =>
                  state.tanks.find((tank) => tank.id === tankId)?.name ?? tankId
                }
              />
              {state.tanks.map((tank) => (
                <Line
                  key={tank.id}
                  type="monotone"
                  dataKey={tank.id}
                  stroke={tank.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </AppShell>
  );
}
