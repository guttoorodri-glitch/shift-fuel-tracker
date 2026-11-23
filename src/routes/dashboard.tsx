import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import html2canvas from "html2canvas";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  Fuel,
  Package,
  Share2,
  Truck,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO, useAppState } from "@/lib/store";
import {
  aggregateDashboard,
  comparePercent,
  formatDashboardDate,
  formatDashboardNumber,
  getComparisonRange,
  getPeriodRange,
  isValidDashboardRange,
  type DashboardPeriod,
  type DateRange,
} from "@/lib/powerbi-dashboard";
import { useFiscalDocuments } from "@/lib/fiscalizacao";
import { calculateTankAutonomy, formatAutonomy, formatTankLiters } from "@/lib/tank-autonomy";
import {
  formatDivergencePercent,
  getDivergenceRecords,
  subscribeToDivergenceChanges,
  type TankDivergence,
} from "@/lib/divergence";

type CompareOption =
  | "MÊS ANTERIOR"
  | "MESMO MÊS ANO ANTERIOR"
  | "TRIMESTRE ANTERIOR"
  | "SEMESTRE ANTERIOR"
  | "ANO ANTERIOR"
  | "NÃO COMPARAR";
type SortKey = "date" | "weekday" | "liters" | "mixUnits" | "oilChanges" | "received" | "change";

const PERIODS: DashboardPeriod[] = [
  "MÊS ATUAL",
  "ÚLTIMO MÊS",
  "TRIMESTRE",
  "SEMESTRE",
  "ANO",
  "PERSONALIZADO",
];
const COMPARISONS: CompareOption[] = [
  "MÊS ANTERIOR",
  "MESMO MÊS ANO ANTERIOR",
  "TRIMESTRE ANTERIOR",
  "SEMESTRE ANTERIOR",
  "ANO ANTERIOR",
  "NÃO COMPARAR",
];
const CHART_COLORS = ["#b7791f", "#3182CE", "#38A169", "#D69E2E", "#805AD5", "#718096"];
const FILTER_KEY = "dashboard_filtro";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "DASHBOARD GERENCIAL — POSTO 10" },
      { name: "description", content: "VISÃO GERENCIAL DE VENDAS, RECEBIMENTOS E OPERAÇÃO." },
    ],
  }),
  component: DashboardPage,
});

function shortDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function PercentChange({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <p className="mt-2 text-xs font-semibold text-slate-500">SEM BASE DE COMPARAÇÃO</p>;
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={`mt-2 flex items-center gap-1 text-xs font-bold ${positive ? "text-green-700" : "text-red-700"}`}
    >
      <Icon className="size-4" />
      {positive ? "+" : ""}
      {formatDashboardNumber(value, 1)}% VS {label}
    </p>
  );
}

function DashboardPage() {
  const app = useAppState();
  const { documents } = useFiscalDocuments();
  const rootRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("MÊS ATUAL");
  const [comparison, setComparison] = useState<CompareOption>("MÊS ANTERIOR");
  const initialRange = getPeriodRange("MÊS ATUAL");
  const [customRange, setCustomRange] = useState<DateRange>(initialRange);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAscending, setSortAscending] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [divergenceRecords, setDivergenceRecords] = useState<TankDivergence[]>([]);

  useEffect(() => {
    const refresh = () => setDivergenceRecords(getDivergenceRecords());
    try {
      refresh();
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL CARREGAR O HISTÓRICO DE DIVERGÊNCIAS.", error);
    }
    return subscribeToDivergenceChanges(() => {
      try {
        refresh();
      } catch (error) {
        console.error("NÃO FOI POSSÍVEL ATUALIZAR O HISTÓRICO DE DIVERGÊNCIAS.", error);
      }
    });
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          period?: DashboardPeriod;
          comparison?: CompareOption;
          customRange?: DateRange;
        };
        if (saved.period && PERIODS.includes(saved.period)) setPeriod(saved.period);
        if (saved.comparison && COMPARISONS.includes(saved.comparison))
          setComparison(saved.comparison);
        if (
          saved.customRange?.from &&
          saved.customRange.to &&
          saved.customRange.from <= saved.customRange.to
        ) {
          setCustomRange(saved.customRange);
        }
      }
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL RESTAURAR OS FILTROS DO DASHBOARD.", error);
    } finally {
      setFiltersReady(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    try {
      window.localStorage.setItem(FILTER_KEY, JSON.stringify({ period, comparison, customRange }));
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL SALVAR OS FILTROS DO DASHBOARD.", error);
    }
  }, [period, comparison, customRange, filtersReady]);

  const currentRange = useMemo(
    () => (period === "PERSONALIZADO" ? customRange : getPeriodRange(period)),
    [period, customRange],
  );
  const currentFrom = currentRange.from;
  const currentTo = currentRange.to;
  const validRange = isValidDashboardRange(currentRange);
  const current = useMemo<ReturnType<typeof aggregateDashboard>>(
    () =>
      validRange
        ? aggregateDashboard(app, { from: currentFrom, to: currentTo })
        : {
            days: [],
            totals: {
              liters: 0,
              mixUnits: 0,
              oilChanges: 0,
              received: 0,
              deliveries: 0,
              fuelLiters: {},
            },
            products: [],
          },
    [app, currentFrom, currentTo, validRange],
  );
  const comparisonRange = useMemo(
    () =>
      validRange ? getComparisonRange({ from: currentFrom, to: currentTo }, comparison) : null,
    [currentFrom, currentTo, comparison, validRange],
  );
  const comparisonFrom = comparisonRange?.from;
  const comparisonTo = comparisonRange?.to;
  const compared = useMemo(
    () =>
      comparisonFrom && comparisonTo
        ? aggregateDashboard(app, { from: comparisonFrom, to: comparisonTo })
        : null,
    [app, comparisonFrom, comparisonTo],
  );
  const litersChange = compared
    ? comparePercent(current.totals.liters, compared.totals.liters)
    : null;
  const mixChange = compared
    ? comparePercent(current.totals.mixUnits, compared.totals.mixUnits)
    : null;
  const oilChange = compared
    ? comparePercent(current.totals.oilChanges, compared.totals.oilChanges)
    : null;
  const tableRows = useMemo(() => {
    const rows = current.days.map((day, index) => {
      const previous = index > 0 ? (current.days[index - 1]?.liters ?? 0) : null;
      const change =
        previous === null
          ? null
          : previous === 0
            ? day.liters > 0
              ? null
              : 0
            : ((day.liters - previous) / previous) * 100;
      return { ...day, change };
    });
    const direction = sortAscending ? 1 : -1;
    rows.sort((a, b) => {
      const aValue = sortKey === "change" ? (a.change ?? Number.NEGATIVE_INFINITY) : a[sortKey];
      const bValue = sortKey === "change" ? (b.change ?? Number.NEGATIVE_INFINITY) : b[sortKey];
      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }
      const numericA = typeof aValue === "number" ? aValue : 0;
      const numericB = typeof bValue === "number" ? bValue : 0;
      return (numericA < numericB ? -1 : numericA > numericB ? 1 : 0) * direction;
    });
    return rows;
  }, [current.days, sortAscending, sortKey]);

  const dailyChart = current.days.map((day, index) => ({
    day: day.date.slice(8, 10),
    date: day.date,
    current: day.liters,
    comparison: compared?.days[index]?.liters,
    received: day.received,
  }));
  const pieData = useMemo(() => {
    const top = current.products.slice(0, 5);
    const others = current.products.slice(5).reduce((total, item) => total + item.quantity, 0);
    return [...top, ...(others > 0 ? [{ id: "outros", name: "OUTROS", quantity: others }] : [])];
  }, [current.products]);
  const fuelChart = app.tanks.map((tank) => ({
    name: tank.name.toLocaleUpperCase("pt-BR"),
    atual: current.totals.fuelLiters[tank.id] ?? 0,
    comparacao: compared?.totals.fuelLiters[tank.id] ?? 0,
    color: tank.color,
  }));
  const weekdayChart = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((weekday) => ({
    weekday,
    liters: current.days
      .filter((day) => day.weekday === weekday)
      .reduce((sum, day) => sum + day.liters, 0),
  }));
  const bestWeekday = weekdayChart.reduce((best, day) => (day.liters > best.liters ? day : best), {
    weekday: "",
    liters: 0,
  });
  const gasolineTankIds = app.tanks
    .filter((tank) => tank.name.toLocaleUpperCase("pt-BR").includes("GASOLINA"))
    .map((tank) => tank.id);
  const gasolineCurrent = gasolineTankIds.reduce(
    (sum, tankId) => sum + (current.totals.fuelLiters[tankId] ?? 0),
    0,
  );
  const gasolinePrevious = gasolineTankIds.reduce(
    (sum, tankId) => sum + (compared?.totals.fuelLiters[tankId] ?? 0),
    0,
  );
  const gasolineChange = compared ? comparePercent(gasolineCurrent, gasolinePrevious) : null;
  const strongestFuel = fuelChart
    .map((fuel) => ({
      ...fuel,
      change: compared ? comparePercent(fuel.atual, fuel.comparacao) : null,
    }))
    .filter((fuel) => fuel.change !== null)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const alertMessage =
    gasolineChange !== null && gasolineChange < -10
      ? `ATENÇÃO: VENDAS DE GASOLINA CAÍRAM ${formatDashboardNumber(Math.abs(gasolineChange), 1)}% VS PERÍODO DE COMPARAÇÃO.`
      : strongestFuel?.change !== null && strongestFuel && (strongestFuel.change ?? 0) > 15
        ? `DESTAQUE: ${strongestFuel.name} SUBIU ${formatDashboardNumber(strongestFuel.change ?? 0, 1)}% VS PERÍODO DE COMPARAÇÃO!`
        : "";
  const documentsDue = documents.filter(
    (document) =>
      document.dataVencimento >= currentRange.from && document.dataVencimento <= currentRange.to,
  ).length;
  const tankAlerts = calculateTankAutonomy(app, todayISO()).filter(
    (entry) => entry.percent !== undefined && entry.percent <= 25,
  );
  const ownerPhone = app.company?.phone?.replace(/\D/g, "") ?? "";
  const tankAlertWhatsApp =
    ownerPhone.length >= 10
      ? `https://wa.me/${ownerPhone.startsWith("55") ? ownerPhone : `55${ownerPhone}`}?text=${encodeURIComponent(
          `ALERTA 25% - ${tankAlerts.map(({ index, tank }) => `TANQUE ${String(index + 1).padStart(2, "0")} ${tank.name.toLocaleUpperCase("pt-BR")}`).join("; ")}`,
        )}`
      : null;
  const latestDivergences = useMemo(() => {
    const latestByTank = new Map<string, TankDivergence>();
    for (const record of divergenceRecords) {
      const currentRecord = latestByTank.get(record.tankId);
      if (!currentRecord || currentRecord.date < record.date) {
        latestByTank.set(record.tankId, record);
      }
    }
    return [...latestByTank.values()].sort((a, b) => a.tankId.localeCompare(b.tankId));
  }, [divergenceRecords]);
  const divergenceChartData = useMemo(() => {
    const end = new Date(`${todayISO()}T12:00:00`);
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(end);
      date.setDate(date.getDate() - (6 - index));
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });
    return dates.map((date) => {
      const point: Record<string, string | number | undefined> = { date: shortDate(date) };
      for (const tank of app.tanks) {
        point[tank.id] = divergenceRecords.find(
          (record) => record.date === date && record.tankId === tank.id,
        )?.diffPercent;
      }
      return point;
    });
  }, [app.tanks, divergenceRecords]);

  const periodDescription = `EXIBINDO: ${formatDashboardDate(currentRange.from)} A ${formatDashboardDate(currentRange.to)}${
    comparisonRange
      ? ` VS ${formatDashboardDate(comparisonRange.from)} A ${formatDashboardDate(comparisonRange.to)}`
      : ""
  }`;
  const todaySales = aggregateDashboard(app, {
    from: todayISO(),
    to: todayISO(),
  });

  const updatePeriod = (nextPeriod: DashboardPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "PERSONALIZADO") setCustomRange(getPeriodRange(nextPeriod));
  };

  const exportPdf = async () => {
    if (!rootRef.current) return;
    setExporting(true);
    setExportError("");
    try {
      const canvas = await html2canvas(rootRef.current, {
        scale: 2,
        backgroundColor: "#1A202C",
        useCORS: true,
        logging: false,
        onclone: (clonedDocument) => {
          const tableContainer = clonedDocument.getElementById("dashboard-table-container");
          if (tableContainer) {
            tableContainer.style.maxHeight = "none";
            tableContainer.style.overflow = "visible";
          }
        },
      });
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const image = canvas.toDataURL("image/png");
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      const generatedAt = new Date().toLocaleString("pt-BR");
      let offset = 0;
      while (offset < imageHeight) {
        if (offset > 0) pdf.addPage();
        pdf.setFontSize(15);
        pdf.setTextColor(183, 121, 31);
        pdf.text("POSTO 10 - DASHBOARD GERENCIAL", 12, 12);
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(periodDescription, 12, 18, { maxWidth: pageWidth - 24 });
        pdf.addImage(image, "PNG", 0, 22 - offset, pageWidth, imageHeight);
        pdf.setFontSize(34);
        pdf.setTextColor(228, 228, 228);
        pdf.text("POSTO 10", pageWidth / 2, pageHeight / 2, {
          align: "center",
          angle: -30,
        });
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text(`POSTO 10 · ${generatedAt}`, 12, pageHeight - 7);
        offset += pageHeight - 22;
      }
      pdf.save(`DASHBOARD-POSTO-10-${currentRange.from}-${currentRange.to}.pdf`);
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL GERAR O PDF DO DASHBOARD.", error);
      setExportError("NÃO FOI POSSÍVEL GERAR O PDF. TENTE NOVAMENTE.");
    } finally {
      setExporting(false);
    }
  };

  const shareWhatsApp = () => {
    const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
      new Date(`${currentRange.to}T12:00:00`),
    );
    const litersSummary = `${formatDashboardNumber(current.totals.liters)} L VENDIDOS`;
    const variation =
      litersChange === null
        ? ""
        : ` (${litersChange >= 0 ? "+" : ""}${formatDashboardNumber(litersChange, 1)}% VS COMPARAÇÃO)`;
    const text = `POSTO 10 - RESUMO ${monthName.toLocaleUpperCase("pt-BR")}: ${litersSummary}${variation}, ${formatDashboardNumber(current.totals.mixUnits)} MIX, ${formatDashboardNumber(current.totals.oilChanges)} TROCAS.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const selectSort = (key: SortKey) => {
    if (sortKey === key) setSortAscending((currentValue) => !currentValue);
    else {
      setSortKey(key);
      setSortAscending(true);
    }
  };

  const card = (
    title: string,
    value: string,
    subtitle: string,
    icon: typeof Fuel,
    variation: number | null,
  ) => {
    const Icon = icon;
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-slate-500">{title}</p>
            <p className="mt-2 font-display text-3xl tabular-nums text-slate-900">{value}</p>
          </div>
          <span className="rounded-lg bg-[#b7791f]/10 p-2 text-[#b7791f]">
            <Icon className="size-6" />
          </span>
        </div>
        <PercentChange value={variation} label={comparison} />
        <p className="mt-1 text-[10px] font-semibold text-slate-500">{subtitle}</p>
      </article>
    );
  };

  const chartCard = (title: string, children: ReactNode, className = "") => (
    <section className={`rounded-xl border border-slate-700 bg-white p-4 shadow-lg ${className}`}>
      <h2 className="mb-3 text-sm font-extrabold tracking-wide text-slate-900">{title}</h2>
      {children}
    </section>
  );

  return (
    <AppShell title="DASHBOARD GERENCIAL" subtitle="VISÃO GERENCIAL MENSAL - POSTO 10">
      <div className="min-h-screen rounded-xl bg-[#1A202C] p-3 text-slate-100 sm:p-5">
        <div ref={rootRef} id="powerbi-dashboard" className="space-y-4 rounded-lg bg-[#1A202C] p-1">
          <section className="rounded-xl border border-[#b7791f] bg-white p-5 shadow-lg">
            <p className="text-xs font-extrabold tracking-wider text-[#8a5817]">
              TOTAL VENDIDO HOJE — {formatDashboardDate(todayISO())}
            </p>
            <p className="mt-1 font-display text-4xl font-black tabular-nums text-slate-900">
              {formatDashboardNumber(todaySales.totals.liters)} L
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
              {app.tanks.map((tank) => (
                <span key={tank.id}>
                  {tank.name.toLocaleUpperCase("pt-BR")}:{" "}
                  {formatDashboardNumber(todaySales.totals.fuelLiters[tank.id] ?? 0)} L
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-[#2D3748] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="size-5 text-[#d6a64f]" />
              <h2 className="text-sm font-extrabold">FILTROS DO DASHBOARD</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((item) => (
                <Button
                  key={item}
                  variant={period === item ? "default" : "outline"}
                  className={
                    period === item
                      ? "bg-[#b7791f] text-white hover:bg-[#9a6419]"
                      : "border-slate-500 bg-transparent text-white hover:bg-slate-700"
                  }
                  onClick={() => updatePeriod(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            {period === "PERSONALIZADO" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">
                  DATA INÍCIO
                  <Input
                    className="mt-1 bg-white text-slate-900"
                    type="date"
                    value={customRange.from}
                    max={customRange.to}
                    onChange={(event) =>
                      setCustomRange((range) => ({ ...range, from: event.target.value }))
                    }
                  />
                </label>
                <label className="text-xs font-bold">
                  DATA FIM
                  <Input
                    className="mt-1 bg-white text-slate-900"
                    type="date"
                    value={customRange.to}
                    min={customRange.from}
                    onChange={(event) =>
                      setCustomRange((range) => ({ ...range, to: event.target.value }))
                    }
                  />
                </label>
              </div>
            ) : null}
            <label className="mt-3 block max-w-sm text-xs font-bold">
              COMPARAR COM
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={comparison}
                onChange={(event) => setComparison(event.target.value as CompareOption)}
              >
                {COMPARISONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <p className="mt-4 text-sm font-extrabold text-[#f6d990]">{periodDescription}</p>
            {!validRange ? (
              <p role="alert" className="mt-2 text-sm font-bold text-red-200">
                INFORME UM PERÍODO VÁLIDO. A DATA DE INÍCIO DEVE SER ANTERIOR OU IGUAL À DATA FIM.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-red-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <AlertTriangle className="size-5 text-red-600" />
                ALERTA DE ESTOQUE — TANQUES ATÉ 25%
              </h2>
              <Link
                to="/"
                className="text-xs font-bold text-[#8a5817] underline underline-offset-2"
              >
                VER MEDIÇÕES
              </Link>
            </div>
            {tankAlerts.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tankAlerts.map((entry) => (
                  <article
                    key={entry.tank.id}
                    className="rounded-lg border border-red-200 bg-red-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-extrabold text-red-900">
                        TANQUE {String(entry.index + 1).padStart(2, "0")} —{" "}
                        {entry.tank.name.toLocaleUpperCase("pt-BR")}
                      </p>
                      <span className="text-xs font-black text-red-700">
                        {entry.percent?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-red-100">
                      <div
                        className="h-full rounded-full bg-red-600"
                        style={{ width: `${Math.min(100, Math.max(0, entry.percent ?? 0))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      ESTOQUE:{" "}
                      {entry.stock === undefined ? "SEM MEDIÇÃO" : formatTankLiters(entry.stock)}
                      {" / "}CAPACIDADE: {formatTankLiters(entry.tank.capacity)}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">
                      AUTONOMIA: {formatAutonomy(entry.autonomyHours)}
                    </p>
                    {entry.suggestedOrder !== undefined ? (
                      <p className="mt-1 text-xs font-bold text-[#8a5817]">
                        SUGESTÃO DE PEDIDO: {formatTankLiters(entry.suggestedOrder)}
                      </p>
                    ) : null}
                    <Link
                      to="/recebimento"
                      className="mt-3 inline-flex rounded-md bg-[#b7791f] px-3 py-2 text-[10px] font-extrabold text-white"
                    >
                      PEDIR COMBUSTÍVEL
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-600">
                NENHUM TANQUE ESTÁ EM 25% OU MENOS DA CAPACIDADE.
              </p>
            )}
            {tankAlerts.length > 0 && tankAlertWhatsApp ? (
              <a
                href={tankAlertWhatsApp}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs font-bold text-green-800"
              >
                COMPARTILHAR ALERTA PELO WHATSAPP CADASTRADO
              </a>
            ) : null}
          </section>

          <section className="rounded-xl border border-amber-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <AlertTriangle className="size-5 text-[#b7791f]" />
                DIVERGÊNCIA — TEÓRICO VS FÍSICO
              </h2>
              <Link
                to="/"
                className="text-xs font-bold text-[#8a5817] underline underline-offset-2"
              >
                LANÇAR MEDIÇÃO DA RÉGUA
              </Link>
            </div>
            {latestDivergences.length > 0 ? (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500">
                      <th className="p-2">TANQUE</th>
                      <th className="p-2">TEÓRICO</th>
                      <th className="p-2">FÍSICO</th>
                      <th className="p-2">DIFERENÇA</th>
                      <th className="p-2">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestDivergences.map((record) => {
                      const tankIndex = app.tanks.findIndex((tank) => tank.id === record.tankId);
                      const tank = app.tanks[tankIndex];
                      return (
                        <tr key={record.tankId} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 font-bold text-slate-800">
                            TANQUE {String(tankIndex + 1).padStart(2, "0")} — {tank?.name}
                          </td>
                          <td className="p-2 tabular-nums">
                            {formatTankLiters(record.theoretical)}
                          </td>
                          <td className="p-2 tabular-nums">{formatTankLiters(record.physical)}</td>
                          <td className="p-2 tabular-nums">
                            {formatTankLiters(record.diffLiters)} (
                            {formatDivergencePercent(record.diffPercent)})
                          </td>
                          <td
                            className={`p-2 font-extrabold ${
                              record.status === "CRITICA"
                                ? "animate-pulse text-red-600"
                                : record.status === "DIVERGENCIA"
                                  ? "text-amber-700"
                                  : "text-[#b7791f]"
                            }`}
                          >
                            {record.status === "CRITICA"
                              ? `POSSÍVEL RALO / VAZAMENTO — ${record.consecutiveDays} DIAS`
                              : record.status === "DIVERGENCIA"
                                ? "DIVERGÊNCIA ACIMA DA TOLERÂNCIA"
                                : "DENTRO DA TOLERÂNCIA"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mb-4 text-xs font-semibold text-slate-600">
                AINDA NÃO HÁ MEDIÇÕES FÍSICAS REGISTRADAS PARA COMPARAÇÃO.
              </p>
            )}
            <h3 className="mb-2 text-xs font-extrabold text-slate-800">
              TENDÊNCIA DA DIVERGÊNCIA — ÚLTIMOS 7 DIAS
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={divergenceChartData} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis unit="%" tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, tankId: string) => [
                      formatDivergencePercent(value),
                      app.tanks.find((tank) => tank.id === tankId)?.name ?? tankId,
                    ]}
                  />
                  <Legend
                    formatter={(tankId: string) =>
                      app.tanks.find((tank) => tank.id === tankId)?.name ?? tankId
                    }
                  />
                  {app.tanks.map((tank) => (
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

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {card(
              "TOTAL LITROS VENDIDOS",
              `${formatDashboardNumber(current.totals.liters)} L`,
              comparison === "NÃO COMPARAR" ? "NO PERÍODO SELECIONADO" : `VS ${comparison}`,
              Fuel,
              litersChange,
            )}
            {card(
              "TOTAL MIX (UNIDADES VENDIDAS)",
              `${formatDashboardNumber(current.totals.mixUnits)} UNID.`,
              "QUANTIDADE DE PRODUTOS DA LOJA REGISTRADA",
              Package,
              mixChange,
            )}
            {card(
              "TROCAS DE ÓLEO",
              `${formatDashboardNumber(current.totals.oilChanges)} TROCAS`,
              "SERVIÇOS REGISTRADOS NO PERÍODO",
              Wrench,
              oilChange,
            )}
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-wide text-slate-500">
                    RECEBIMENTOS DE COMBUSTÍVEL
                  </p>
                  <p className="mt-2 font-display text-3xl tabular-nums text-slate-900">
                    {formatDashboardNumber(current.totals.received)} L
                  </p>
                </div>
                <span className="rounded-lg bg-[#b7791f]/10 p-2 text-[#b7791f]">
                  <Truck className="size-6" />
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-600">
                {formatDashboardNumber(current.totals.deliveries)} DESCARGAS
              </p>
              <p className="mt-1 text-[10px] font-semibold text-slate-500">
                NO PERÍODO SELECIONADO
              </p>
            </article>
          </section>

          {alertMessage ? (
            <section className="flex gap-3 rounded-xl border border-yellow-300 bg-yellow-100 p-4 text-sm font-extrabold text-yellow-950">
              <AlertTriangle className="size-5 shrink-0" />
              {alertMessage}
            </section>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-2">
            {chartCard(
              "VENDAS POR DIA - LITROS",
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChartShell data={dailyChart} comparison={comparison !== "NÃO COMPARAR"} />
                </ResponsiveContainer>
              </div>,
            )}
            {chartCard(
              "MIX - TOP 5 PRODUTOS",
              pieData.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="quantity"
                        nameKey="name"
                        cx="50%"
                        cy="48%"
                        outerRadius={90}
                        label
                      >
                        {pieData.map((item, index) => (
                          <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${formatDashboardNumber(value)} UNID.`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart />
              ),
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {chartCard(
              "VOLUME POR COMBUSTÍVEL",
              fuelChart.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fuelChart} margin={{ left: 0, right: 12, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        angle={-18}
                        textAnchor="end"
                        interval={0}
                        height={55}
                        tick={{ fontSize: 9 }}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => `${formatDashboardNumber(value)} L`} />
                      <Bar
                        dataKey="atual"
                        name="PERÍODO ATUAL"
                        fill="#b7791f"
                        radius={[4, 4, 0, 0]}
                      />
                      {compared ? (
                        <Bar
                          dataKey="comparacao"
                          name="COMPARAÇÃO"
                          fill="#A0AEC0"
                          radius={[4, 4, 0, 0]}
                        />
                      ) : null}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart />
              ),
            )}
            {chartCard(
              "QUAL DIA VENDE MAIS?",
              <>
                <p className="mb-2 text-xs font-extrabold text-[#8a5817]">
                  {bestWeekday.liters > 0
                    ? `${bestWeekday.weekday} É O DIA QUE MAIS VENDE`
                    : "SEM VENDAS REGISTRADAS NO PERÍODO"}
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayChart} layout="vertical" margin={{ left: 8, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="weekday" width={42} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => `${formatDashboardNumber(value)} L`} />
                      <Bar
                        dataKey="liters"
                        name="LITROS VENDIDOS"
                        fill="#b7791f"
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>,
            )}
          </section>

          {chartCard(
            "ENTRADA VS SAÍDA DE COMBUSTÍVEL - LITROS",
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ left: 4, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date
                        ? formatDashboardDate(payload[0].payload.date)
                        : ""
                    }
                    formatter={(value: number) => `${formatDashboardNumber(value)} L`}
                  />
                  <Area
                    type="monotone"
                    dataKey="received"
                    name="RECEBIMENTOS"
                    stackId="volume"
                    stroke="#3182CE"
                    fill="#3182CE"
                    fillOpacity={0.45}
                  />
                  <Area
                    type="monotone"
                    dataKey="current"
                    name="VENDAS"
                    stackId="volume"
                    stroke="#b7791f"
                    fill="#b7791f"
                    fillOpacity={0.45}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>,
          )}

          <section className="rounded-xl border border-slate-700 bg-white p-4 text-slate-900 shadow-lg">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold">DETALHAMENTO DIA A DIA</h2>
              <Link to="/fiscalizacao" className="text-xs font-bold text-[#8a5817] underline">
                DOCUMENTOS COM VENCIMENTO NO PERÍODO: {documentsDue} · VER FISCALIZAÇÃO
              </Link>
            </div>
            <div
              id="dashboard-table-container"
              className="max-h-[34rem] overflow-auto rounded-lg border border-slate-200"
            >
              <table className="w-full min-w-[840px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    {(
                      [
                        ["date", "DATA"],
                        ["weekday", "DIA SEMANA"],
                        ["liters", "TOTAL LITROS VENDIDOS"],
                        ["mixUnits", "TOTAL MIX"],
                        ["oilChanges", "TROCAS ÓLEO"],
                        ["received", "RECEBIMENTOS"],
                        ["change", "VARIAÇÃO VS DIA ANTERIOR"],
                      ] as const
                    ).map(([key, title]) => (
                      <th key={key} className="whitespace-nowrap border-b border-slate-300 p-2">
                        <button
                          type="button"
                          className="font-extrabold"
                          onClick={() => selectSort(key)}
                        >
                          {title} {sortKey === key ? (sortAscending ? "↑" : "↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((day) => (
                    <tr key={day.date} className="odd:bg-white even:bg-slate-50">
                      <td className="whitespace-nowrap p-2">{formatDashboardDate(day.date)}</td>
                      <td className="p-2">{day.weekday}</td>
                      <td className="p-2">{formatDashboardNumber(day.liters)} L</td>
                      <td className="p-2">{formatDashboardNumber(day.mixUnits)}</td>
                      <td className="p-2">{day.oilChanges}</td>
                      <td className="p-2">{formatDashboardNumber(day.received)} L</td>
                      <td className="p-2">
                        {day.change === null
                          ? "—"
                          : `${day.change >= 0 ? "+" : ""}${formatDashboardNumber(day.change, 1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-amber-50 font-extrabold">
                  <tr>
                    <td className="p-2" colSpan={2}>
                      TOTAL DO PERÍODO
                    </td>
                    <td className="p-2">{formatDashboardNumber(current.totals.liters)} L</td>
                    <td className="p-2">{formatDashboardNumber(current.totals.mixUnits)}</td>
                    <td className="p-2">{formatDashboardNumber(current.totals.oilChanges)}</td>
                    <td className="p-2">{formatDashboardNumber(current.totals.received)} L</td>
                    <td className="p-2">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          <p className="text-center text-[10px] font-semibold text-slate-400">
            DADOS AGREGADOS DO ARMAZENAMENTO LOCAL DO APLICATIVO · POSTO 10
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={exporting || !validRange}
            className="bg-[#b7791f] text-white hover:bg-[#9a6419]"
            onClick={() => void exportPdf()}
          >
            <Download className="size-4" />
            {exporting ? "GERANDO PDF..." : "GERAR RELATÓRIO PDF POWER BI"}
          </Button>
          <Button
            variant="outline"
            className="border-slate-500 bg-transparent text-white hover:bg-slate-700"
            onClick={shareWhatsApp}
          >
            <Share2 className="size-4" /> COMPARTILHAR NO WHATSAPP
          </Button>
          {exportError ? (
            <p role="alert" className="w-full text-sm text-red-300">
              {exportError}
            </p>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function LineChartShell({
  data,
  comparison,
}: {
  data: Array<{
    day: string;
    date: string;
    current: number;
    comparison?: number | undefined;
  }>;
  comparison: boolean;
}) {
  return (
    <LineChart data={data} margin={{ left: 4, right: 12 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="day" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip
        labelFormatter={(_, payload) =>
          payload?.[0]?.payload?.date ? shortDate(payload[0].payload.date) : ""
        }
        formatter={(value: number) => `${formatDashboardNumber(value)} L`}
      />
      <Line
        type="monotone"
        dataKey="current"
        name="PERÍODO ATUAL"
        stroke="#b7791f"
        strokeWidth={2}
        dot={false}
      />
      {comparison ? (
        <Line
          type="monotone"
          dataKey="comparison"
          name="PERÍODO DE COMPARAÇÃO"
          stroke="#A0AEC0"
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      ) : null}
    </LineChart>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center text-center text-sm font-semibold text-slate-500">
      SEM VENDAS DE PRODUTOS REGISTRADAS NO PERÍODO.
    </div>
  );
}
