import { useSyncExternalStore } from "react";

export type Tank = {
  id: string;
  name: string;
  color: string;
  capacity: number;
};

export type Attendant = {
  id: string;
  name: string;
  shift: number;
  start: string;
  end: string;
  /** Datas de folga em formato ISO (yyyy-mm-dd) */
  folgas: string[];
};

export type Product = {
  id: string;
  name: string;
  color: string;
  unit: string;
  /** Estoque inicial cadastrado pelo usuário */
  initialStock: number;
};

export type Restock = {
  id: string;
  productId: string;
  date: string;
  qty: number;
};

export type AppState = {
  tanks: Tank[];
  shifts: number;
  attendants: Attendant[];
  /** openings[data][tankId] = medida em litros */
  openings: Record<string, Record<string, number>>;
  /** sales[data][turno][tankId] = litros vendidos */
  sales: Record<string, Record<string, Record<string, number>>>;
  products: Product[];
  /** productSales[data][turno][productId] = quantidade vendida */
  productSales: Record<string, Record<string, Record<string, number>>>;
  restocks: Restock[];
};


export const uid = () => Math.random().toString(36).slice(2, 10);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

export const shiftISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

export const formatBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const weekdayBR = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(y, m - 1, d).getDay()];
};

const STORAGE_KEY = "posto-app-v1";

const defaultState: AppState = {
  shifts: 3,
  tanks: [
    { id: "t1", name: "Gasolina Comum", color: "#e0b428", capacity: 15000 },
    { id: "t2", name: "Gasolina Aditivada", color: "#e2632c", capacity: 10000 },
    { id: "t3", name: "Etanol", color: "#3fa06a", capacity: 10000 },
    { id: "t4", name: "Diesel S10", color: "#3b82c4", capacity: 20000 },
  ],
  attendants: [
    { id: "a1", name: "Frentista 1", shift: 1, start: "06:00", end: "14:00", folgas: [] },
    { id: "a2", name: "Frentista 2", shift: 2, start: "14:00", end: "22:00", folgas: [] },
  ],

  openings: {},
  sales: {},
  products: [],
  productSales: {},
  restocks: [],
};


function load(): AppState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...(JSON.parse(raw) as AppState) };
  } catch {
    return defaultState;
  }
}

let state: AppState = load();
let hydrated = typeof window === "undefined";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function update(fn: (s: AppState) => AppState) {
  state = fn(state);
  persist();
  emit();
}

function subscribe(listener: () => void) {
  if (!hydrated) {
    hydrated = true;
    state = load();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => defaultState,
  );
}

/* ---------- ações ---------- */

export const actions = {
  setShifts: (n: number) =>
    update((s) => ({ ...s, shifts: Math.max(1, Math.min(6, Math.round(n) || 1)) })),

  addTank: (tank: Omit<Tank, "id">) =>
    update((s) => ({ ...s, tanks: [...s.tanks, { ...tank, id: uid() }] })),

  updateTank: (id: string, patch: Partial<Tank>) =>
    update((s) => ({
      ...s,
      tanks: s.tanks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  moveTank: (id: string, dir: -1 | 1) =>
    update((s) => {
      const i = s.tanks.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.tanks.length) return s;
      const tanks = [...s.tanks];
      [tanks[i], tanks[j]] = [tanks[j] as Tank, tanks[i] as Tank];
      return { ...s, tanks };
    }),

  removeTank: (id: string) =>
    update((s) => ({ ...s, tanks: s.tanks.filter((t) => t.id !== id) })),

  setOpening: (date: string, tankId: string, value: number) =>
    update((s) => ({
      ...s,
      openings: { ...s.openings, [date]: { ...(s.openings[date] ?? {}), [tankId]: value } },
    })),

  setSale: (date: string, shift: number, tankId: string, value: number) =>
    update((s) => {
      const day = s.sales[date] ?? {};
      const turn = day[shift] ?? {};
      return {
        ...s,
        sales: { ...s.sales, [date]: { ...day, [shift]: { ...turn, [tankId]: value } } },
      };
    }),

  addAttendant: (a: Omit<Attendant, "id" | "folgas">) =>
    update((s) => ({ ...s, attendants: [...s.attendants, { ...a, id: uid(), folgas: [] }] })),

  updateAttendant: (id: string, patch: Partial<Attendant>) =>
    update((s) => ({
      ...s,
      attendants: s.attendants.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  removeAttendant: (id: string) =>
    update((s) => ({ ...s, attendants: s.attendants.filter((a) => a.id !== id) })),

  toggleFolga: (id: string, date: string) =>
    update((s) => ({
      ...s,
      attendants: s.attendants.map((a) =>
        a.id === id
          ? {
              ...a,
              folgas: a.folgas.includes(date)
                ? a.folgas.filter((d) => d !== date)
                : [...a.folgas, date],
            }
          : a,
      ),
    })),

  /* ---------- produtos ---------- */

  addProduct: (p: Omit<Product, "id">) =>
    update((s) => ({ ...s, products: [...s.products, { ...p, id: uid() }] })),

  updateProduct: (id: string, patch: Partial<Product>) =>
    update((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  removeProduct: (id: string) =>
    update((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) })),

  setProductSale: (date: string, shift: number, productId: string, qty: number) =>
    update((s) => {
      const day = s.productSales[date] ?? {};
      const turn = day[shift] ?? {};
      return {
        ...s,
        productSales: {
          ...s.productSales,
          [date]: { ...day, [shift]: { ...turn, [productId]: qty } },
        },
      };
    }),

  addRestock: (r: Omit<Restock, "id">) =>
    update((s) => ({ ...s, restocks: [...s.restocks, { ...r, id: uid() }] })),

  updateRestock: (id: string, patch: Partial<Restock>) =>
    update((s) => ({
      ...s,
      restocks: s.restocks.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  removeRestock: (id: string) =>
    update((s) => ({ ...s, restocks: s.restocks.filter((r) => r.id !== id) })),

  /** Restauração de fábrica: zera todos os dados do aplicativo */
  resetFactory: () => update(() => structuredClone(defaultState)),
};


/* ---------- backup ---------- */

export function serializeState(s: AppState) {
  return JSON.stringify({ app: "posto-controle", version: 1, exportedAt: new Date().toISOString(), data: s }, null, 2);
}

export function importState(raw: string): boolean {
  const parsed = JSON.parse(raw) as { data?: Partial<AppState> } | Partial<AppState>;
  const data = ("data" in parsed && parsed.data ? parsed.data : parsed) as Partial<AppState>;
  if (!Array.isArray(data.tanks) || !Array.isArray(data.attendants)) return false;
  update(() => ({
    shifts: typeof data.shifts === "number" ? data.shifts : defaultState.shifts,
    tanks: data.tanks as Tank[],
    attendants: (data.attendants as Attendant[]).map((a) => ({ ...a, folgas: a.folgas ?? [] })),
    openings: data.openings ?? {},
    sales: data.sales ?? {},
    products: data.products ?? [],
    productSales: data.productSales ?? {},
    restocks: data.restocks ?? [],
  }));

  return true;
}

/* ---------- derivados ---------- */

export function totalSalesOfDay(s: AppState, date: string, tankId: string) {
  const day = s.sales[date] ?? {};
  return Object.values(day).reduce((sum, turn) => sum + (turn[tankId] ?? 0), 0);
}

export function estimatedLevel(s: AppState, date: string, tankId: string) {
  const opening = s.openings[date]?.[tankId];
  if (opening === undefined) return undefined;
  return Math.max(0, opening - totalSalesOfDay(s, date, tankId));
}

export const fmtL = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;

/* ---------- relatórios ---------- */

export const monthStartISO = (iso: string) => `${iso.slice(0, 7)}-01`;

export function datesWithSales(s: AppState) {
  return Object.keys(s.sales).sort();
}

/** Soma por tanque em um intervalo (inclusive) */
export function totalsByTank(s: AppState, from: string, to: string) {
  const result: Record<string, number> = {};
  for (const date of Object.keys(s.sales)) {
    if (date < from || date > to) continue;
    for (const turn of Object.values(s.sales[date] ?? {})) {
      for (const [tankId, liters] of Object.entries(turn)) {
        result[tankId] = (result[tankId] ?? 0) + (liters ?? 0);
      }
    }
  }
  return result;
}

/** Total geral por dia dentro do intervalo */
export function dailyTotals(s: AppState, from: string, to: string) {
  const days: { date: string; total: number }[] = [];
  for (const date of Object.keys(s.sales).sort()) {
    if (date < from || date > to) continue;
    let total = 0;
    for (const turn of Object.values(s.sales[date] ?? {})) {
      for (const liters of Object.values(turn)) total += liters ?? 0;
    }
    days.push({ date, total });
  }
  return days;
}

export function totalInRange(s: AppState, from: string, to: string) {
  return Object.values(totalsByTank(s, from, to)).reduce((a, b) => a + b, 0);
}

/* ---------- produtos: derivados ---------- */

export const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function productSold(s: AppState, productId: string, from?: string, to?: string) {
  let total = 0;
  for (const [date, day] of Object.entries(s.productSales)) {
    if (from && date < from) continue;
    if (to && date > to) continue;
    for (const turn of Object.values(day ?? {})) total += turn[productId] ?? 0;
  }
  return total;
}

export function productRestocked(s: AppState, productId: string, from?: string, to?: string) {
  return s.restocks
    .filter(
      (r) =>
        r.productId === productId && (!from || r.date >= from) && (!to || r.date <= to),
    )
    .reduce((a, r) => a + (r.qty ?? 0), 0);
}

/** Saldo atual = estoque inicial + reposições - vendas */
export function productBalance(s: AppState, productId: string) {
  const product = s.products.find((p) => p.id === productId);
  if (!product) return 0;
  return product.initialStock + productRestocked(s, productId) - productSold(s, productId);
}

export function productSalesByProduct(s: AppState, from: string, to: string) {
  const result: Record<string, number> = {};
  for (const p of s.products) result[p.id] = productSold(s, p.id, from, to);
  return result;
}

export function productDailyTotals(s: AppState, from: string, to: string) {
  const days: { date: string; total: number }[] = [];
  for (const date of Object.keys(s.productSales).sort()) {
    if (date < from || date > to) continue;
    let total = 0;
    for (const turn of Object.values(s.productSales[date] ?? {})) {
      for (const q of Object.values(turn)) total += q ?? 0;
    }
    days.push({ date, total });
  }
  return days;
}

export function productSalesByShift(s: AppState, date: string, productId: string) {
  const day = s.productSales[date] ?? {};
  const out: Record<string, number> = {};
  for (const [shift, turn] of Object.entries(day)) out[shift] = turn[productId] ?? 0;
  return out;
}

export const weekStartISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return shiftISO(iso, -date.getDay());
};
