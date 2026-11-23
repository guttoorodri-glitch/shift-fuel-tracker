import type { AppState } from "@/lib/store";

export type DateRange = { from: string; to: string };
export type DashboardPeriod =
  "MÊS ATUAL" | "ÚLTIMO MÊS" | "TRIMESTRE" | "SEMESTRE" | "ANO" | "PERSONALIZADO";

export type DashboardDay = {
  date: string;
  weekday: string;
  liters: number;
  received: number;
  mixUnits: number;
  oilChanges: number;
  deliveries: number;
  fuelLiters: Record<string, number>;
};

export type DashboardTotals = {
  liters: number;
  mixUnits: number;
  oilChanges: number;
  received: number;
  deliveries: number;
  fuelLiters: Record<string, number>;
};

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseISO(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function clampDate(date: Date, day: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()),
  );
}

function shiftMonth(date: Date, amount: number) {
  const monthStart = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  return clampDate(monthStart, date.getDate());
}

function shiftYear(date: Date, amount: number) {
  const yearStart = new Date(date.getFullYear() + amount, date.getMonth(), 1);
  return clampDate(yearStart, date.getDate());
}

export function isValidDashboardRange(range: DateRange) {
  const validISO = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = parseISO(value);
    return isoDate(date) === value;
  };
  return validISO(range.from) && validISO(range.to) && range.from <= range.to;
}

export function getPeriodRange(period: DashboardPeriod, today = new Date()): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  if (period === "MÊS ATUAL")
    return { from: isoDate(new Date(year, month, 1)), to: isoDate(today) };
  if (period === "ÚLTIMO MÊS") {
    return { from: isoDate(new Date(year, month - 1, 1)), to: isoDate(new Date(year, month, 0)) };
  }
  if (period === "TRIMESTRE") {
    const firstMonth = Math.floor(month / 3) * 3;
    return { from: isoDate(new Date(year, firstMonth, 1)), to: isoDate(today) };
  }
  if (period === "SEMESTRE") {
    const firstMonth = Math.floor(month / 6) * 6;
    return { from: isoDate(new Date(year, firstMonth, 1)), to: isoDate(today) };
  }
  if (period === "ANO") return { from: isoDate(new Date(year, 0, 1)), to: isoDate(today) };
  return { from: isoDate(new Date(year, month, 1)), to: isoDate(today) };
}

export function getComparisonRange(range: DateRange, comparison: string): DateRange | null {
  if (comparison === "NÃO COMPARAR") return null;
  const start = parseISO(range.from);
  const end = parseISO(range.to);
  const periodDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  if (comparison === "MÊS ANTERIOR") {
    const previousStart = shiftMonth(start, -1);
    const previousEnd = shiftMonth(end, -1);
    return { from: isoDate(previousStart), to: isoDate(previousEnd) };
  }
  if (comparison === "MESMO MÊS ANO ANTERIOR" || comparison === "ANO ANTERIOR") {
    const previousStart = shiftYear(start, -1);
    const previousEnd = shiftYear(end, -1);
    return { from: isoDate(previousStart), to: isoDate(previousEnd) };
  }
  if (comparison === "TRIMESTRE ANTERIOR") {
    const previousStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
    const currentQuarterEnd = new Date(
      start.getFullYear(),
      Math.floor(start.getMonth() / 3) * 3 + 3,
      0,
    );
    const previousEnd =
      end.getTime() === currentQuarterEnd.getTime()
        ? new Date(previousStart.getFullYear(), previousStart.getMonth() + 3, 0)
        : addDays(previousStart, periodDays);
    return { from: isoDate(previousStart), to: isoDate(previousEnd) };
  }
  if (comparison === "SEMESTRE ANTERIOR") {
    const previousStart = new Date(start.getFullYear(), start.getMonth() - 6, 1);
    const currentSemesterEnd = new Date(
      start.getFullYear(),
      Math.floor(start.getMonth() / 6) * 6 + 6,
      0,
    );
    const previousEnd =
      end.getTime() === currentSemesterEnd.getTime()
        ? new Date(previousStart.getFullYear(), previousStart.getMonth() + 6, 0)
        : addDays(previousStart, periodDays);
    return { from: isoDate(previousStart), to: isoDate(previousEnd) };
  }
  const previousEnd = addDays(start, -1);
  return { from: isoDate(addDays(previousEnd, -periodDays)), to: isoDate(previousEnd) };
}

export function aggregateDashboard(state: AppState, range: DateRange) {
  const days: DashboardDay[] = [];
  const productTotals = new Map<string, number>();
  const cursor = parseISO(range.from);
  const end = parseISO(range.to);
  for (let date = cursor; date <= end; date = addDays(date, 1)) {
    const key = isoDate(date);
    const fuelLiters: Record<string, number> = {};
    for (const tank of state.tanks) {
      fuelLiters[tank.id] = Object.values(state.sales[key] ?? {}).reduce(
        (sum, shift) => sum + (shift[tank.id] ?? 0),
        0,
      );
    }
    const received = (state.deliveries ?? []).filter((delivery) => delivery.date === key);
    const receivedLiters = received
      .flatMap((delivery) => delivery.items)
      .reduce((sum, item) => sum + item.qty, 0);
    const oilChanges = (state.oilChanges ?? []).filter((change) => change.date === key).length;
    const mixUnits = Object.values(state.productSales[key] ?? {}).reduce(
      (sum, shift) =>
        sum +
        Object.entries(shift).reduce((shiftSum, [productId, quantity]) => {
          productTotals.set(productId, (productTotals.get(productId) ?? 0) + quantity);
          return shiftSum + quantity;
        }, 0),
      0,
    );
    days.push({
      date: key,
      weekday: WEEKDAYS[date.getDay()] ?? "",
      liters: Object.values(fuelLiters).reduce((sum, liters) => sum + liters, 0),
      received: receivedLiters,
      mixUnits,
      oilChanges,
      deliveries: received.length,
      fuelLiters,
    });
  }
  const totals = days.reduce<DashboardTotals>(
    (result, day) => {
      result.liters += day.liters;
      result.mixUnits += day.mixUnits;
      result.oilChanges += day.oilChanges;
      result.received += day.received;
      result.deliveries += day.deliveries;
      for (const [fuelId, liters] of Object.entries(day.fuelLiters)) {
        result.fuelLiters[fuelId] = (result.fuelLiters[fuelId] ?? 0) + liters;
      }
      return result;
    },
    { liters: 0, mixUnits: 0, oilChanges: 0, received: 0, deliveries: 0, fuelLiters: {} },
  );
  const products = [...productTotals.entries()]
    .map(([id, quantity]) => ({
      id,
      name: state.products.find((product) => product.id === id)?.name ?? "PRODUTO EXCLUÍDO",
      quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity);
  return { days, totals, products };
}

export function comparePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatDashboardDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDashboardNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}
