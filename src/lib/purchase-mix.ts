import type { Delivery, Tank } from "@/lib/store";

export type PurchaseMix = {
  commonLiters: number;
  additiveLiters: number;
  totalGasolineLiters: number;
  percentage: number;
};

export type PurchaseMixEvolution = {
  id: string;
  date: string;
  supplier: string;
  commonLiters: number;
  additiveLiters: number;
  accumulatedPercentage: number;
};

export type MonthlyPurchaseMix = {
  month: string;
  commonLiters: number;
  additiveLiters: number;
  percentage: number;
  closedAt: string;
};

const MONTHLY_MIX_HISTORY_KEY = "posto10_purchase_mix_month_history";

export function readMonthlyPurchaseMixHistory(): MonthlyPurchaseMix[] {
  const raw = window.localStorage.getItem(MONTHLY_MIX_HISTORY_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("O HISTÓRICO MENSAL DO MIX DE COMPRA ESTÁ INVÁLIDO.");
  }
  return parsed as MonthlyPurchaseMix[];
}

export function saveMonthlyPurchaseMix(record: MonthlyPurchaseMix, replace = false) {
  const history = readMonthlyPurchaseMixHistory();
  const existingIndex = history.findIndex((entry) => entry.month === record.month);
  if (existingIndex >= 0) {
    if (!replace) return history;
    history[existingIndex] = record;
  } else {
    history.push(record);
  }
  history.sort((a, b) => b.month.localeCompare(a.month));
  window.localStorage.setItem(MONTHLY_MIX_HISTORY_KEY, JSON.stringify(history));
  return history;
}

function classifyFuel(name: string): "common" | "additive" | null {
  const normalized = name.toLocaleUpperCase("pt-BR");
  if (normalized.includes("ADITIVADA")) return "additive";
  if (normalized.includes("GASOLINA") && normalized.includes("COMUM")) return "common";
  return null;
}

function amountsForDelivery(delivery: Delivery, tanks: Tank[]) {
  return delivery.items.reduce(
    (amounts, item) => {
      const registeredFuel = item.tankId
        ? tanks.find((tank) => tank.id === item.tankId)?.name
        : undefined;
      const type = classifyFuel(registeredFuel ?? item.fuel);
      if (type === "common") amounts.commonLiters += item.qty;
      if (type === "additive") amounts.additiveLiters += item.qty;
      return amounts;
    },
    { commonLiters: 0, additiveLiters: 0 },
  );
}

export function calculatePurchaseMix(
  deliveries: Delivery[],
  tanks: Tank[],
  include: (delivery: Delivery) => boolean = () => true,
): PurchaseMix {
  const amounts = deliveries.filter(include).reduce(
    (total, delivery) => {
      const receipt = amountsForDelivery(delivery, tanks);
      total.commonLiters += receipt.commonLiters;
      total.additiveLiters += receipt.additiveLiters;
      return total;
    },
    { commonLiters: 0, additiveLiters: 0 },
  );
  const totalGasolineLiters = amounts.commonLiters + amounts.additiveLiters;

  return {
    ...amounts,
    totalGasolineLiters,
    percentage: totalGasolineLiters > 0 ? (amounts.additiveLiters / totalGasolineLiters) * 100 : 0,
  };
}

export function buildPurchaseMixEvolution(
  deliveries: Delivery[],
  tanks: Tank[],
): PurchaseMixEvolution[] {
  const receipts = deliveries
    .map((delivery) => ({
      delivery,
      amounts: amountsForDelivery(delivery, tanks),
    }))
    .filter(({ amounts }) => amounts.commonLiters > 0 || amounts.additiveLiters > 0)
    .sort(
      (a, b) =>
        a.delivery.date.localeCompare(b.delivery.date) ||
        a.delivery.createdAt.localeCompare(b.delivery.createdAt),
    );
  let commonLiters = 0;
  let additiveLiters = 0;

  return receipts.map(({ delivery, amounts }) => {
    commonLiters += amounts.commonLiters;
    additiveLiters += amounts.additiveLiters;
    const total = commonLiters + additiveLiters;
    return {
      id: delivery.id,
      date: delivery.date,
      supplier: delivery.distribuidora,
      commonLiters: amounts.commonLiters,
      additiveLiters: amounts.additiveLiters,
      accumulatedPercentage: total > 0 ? (additiveLiters / total) * 100 : 0,
    };
  });
}
