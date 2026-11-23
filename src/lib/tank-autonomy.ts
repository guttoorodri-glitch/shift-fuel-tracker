import type { AppState, Tank } from "@/lib/store";

export type TankAutonomy = {
  tank: Tank;
  index: number;
  stock: number | undefined;
  percent: number | undefined;
  dailyAverage: number;
  autonomyDays: number | undefined;
  autonomyHours: number | undefined;
  suggestedOrder: number | undefined;
};

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endTime - startTime) / 86_400_000);
}

function shiftNumbers(day: Record<string, Record<string, number>> | undefined) {
  return Object.keys(day ?? {})
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function salesForTank(state: AppState, date: string, tankId: string, fromShift = 1) {
  return shiftNumbers(state.sales[date]).reduce(
    (total, shift) =>
      total + (shift >= fromShift ? (state.sales[date]?.[shift]?.[tankId] ?? 0) : 0),
    0,
  );
}

function receivedForTank(state: AppState, date: string, tank: Tank) {
  return (state.deliveries ?? [])
    .filter((delivery) => delivery.date === date)
    .flatMap((delivery) => delivery.items)
    .filter((item) => {
      if (item.tankId) return item.tankId === tank.id;
      const matching = state.tanks.filter(
        (candidate) =>
          candidate.name.trim().toLocaleUpperCase("pt-BR") ===
          item.fuel.trim().toLocaleUpperCase("pt-BR"),
      );
      return matching.length === 1 && matching[0]?.id === tank.id;
    })
    .reduce((total, item) => total + item.qty, 0);
}

function dateKeys(state: AppState) {
  return [
    ...new Set([
      ...Object.keys(state.shiftMeasurements ?? {}),
      ...Object.keys(state.openings),
      ...Object.keys(state.sales),
      ...(state.deliveries ?? []).map((delivery) => delivery.date),
    ]),
  ].sort();
}

function currentStock(state: AppState, tank: Tank, today: string): number | undefined {
  const dates = dateKeys(state).filter((date) => date <= today);
  let anchorDate: string | undefined;
  let stock: number | undefined;

  for (const date of dates) {
    const measurements = state.shiftMeasurements?.[date] ?? {};
    const manual = measurements[1]?.[tank.id] ?? state.openings[date]?.[tank.id];
    if (manual !== undefined) {
      anchorDate = date;
      stock = manual + receivedForTank(state, date, tank) - salesForTank(state, date, tank.id);
      continue;
    }

    const shifts = shiftNumbers(measurements);
    const latestShift = shifts
      .reverse()
      .find((shift) => measurements[shift]?.[tank.id] !== undefined);
    if (latestShift !== undefined) {
      anchorDate = date;
      stock =
        (measurements[latestShift]?.[tank.id] ?? 0) -
        salesForTank(state, date, tank.id, latestShift);
    }
  }

  if (anchorDate === undefined || stock === undefined) return undefined;

  for (const date of dates) {
    if (date <= anchorDate) continue;
    stock += receivedForTank(state, date, tank) - salesForTank(state, date, tank.id);
  }
  return stock;
}

export function calculateTankAutonomy(state: AppState, today: string): TankAutonomy[] {
  const tanks = state.tanks.map((tank, index) => ({
    tank,
    index,
    stock: currentStock(state, tank, today),
  }));
  const start = new Date(`${today}T00:00:00`);
  start.setDate(start.getDate() - 6);
  const firstDay = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  return tanks.map(({ tank, index, stock }) => {
    const sameFuel = tanks.filter(
      (candidate) =>
        candidate.tank.name.trim().toLocaleUpperCase("pt-BR") ===
        tank.name.trim().toLocaleUpperCase("pt-BR"),
    );
    const fuelSales = sameFuel.reduce(
      (total, candidate) =>
        total +
        dateKeys(state)
          .filter((date) => date >= firstDay && date <= today)
          .reduce((sum, date) => sum + salesForTank(state, date, candidate.tank.id), 0),
      0,
    );
    const weightTotal = sameFuel.reduce(
      (total, candidate) => total + Math.max(0, candidate.stock ?? candidate.tank.capacity),
      0,
    );
    const weight = Math.max(0, stock ?? tank.capacity);
    const dailyAverage =
      sameFuel.length > 1 && weightTotal > 0
        ? (fuelSales / 7) * (weight / weightTotal)
        : dateKeys(state)
            .filter((date) => date >= firstDay && date <= today)
            .reduce((sum, date) => sum + salesForTank(state, date, tank.id), 0) / 7;
    const percent =
      stock !== undefined && tank.capacity > 0 ? (stock / tank.capacity) * 100 : undefined;
    const autonomyDays =
      stock !== undefined && dailyAverage > 0 ? Math.max(0, stock) / dailyAverage : undefined;
    const autonomyHours = autonomyDays === undefined ? undefined : autonomyDays * 24;
    const suggestedOrder =
      stock !== undefined && dailyAverage > 0
        ? Math.max(0, tank.capacity - stock - dailyAverage * 2)
        : stock !== undefined
          ? Math.max(0, tank.capacity - stock)
          : undefined;

    return {
      tank,
      index,
      stock,
      percent,
      dailyAverage,
      autonomyDays,
      autonomyHours,
      suggestedOrder,
    };
  });
}

export function formatAutonomy(hours: number | undefined) {
  if (hours === undefined) return "SEM HISTÓRICO DE VENDAS";
  const totalHours = Math.max(0, Math.floor(hours));
  const days = Math.floor(totalHours / 24);
  const remainder = totalHours % 24;
  if (days === 0) return `${remainder}H`;
  if (remainder === 0) return `${days}D`;
  return `${days}D ${remainder}H`;
}

export function formatTankLiters(liters: number) {
  return `${Math.round(liters).toLocaleString("pt-BR")} L`;
}
