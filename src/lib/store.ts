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
  /** Datas de falta em formato ISO (yyyy-mm-dd) */
  faltas?: string[];
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

export type StockCount = {
  id: string;
  productId: string;
  date: string;
  /** Quantidade contada fisicamente */
  counted: number;
  /** Saldo do sistema no momento da contagem */
  expected: number;
  /** counted - expected (negativo = falta, positivo = sobra) */
  diff: number;
  note?: string | undefined;
};

export type TaskStatus = "afazer" | "fazendo" | "feito";

export type Task = {
  id: string;
  title: string;
  note?: string | undefined;
  due?: string | undefined;
  assignee?: string | undefined;
  status: TaskStatus;
  createdAt: string;
};

export type ChecklistFrequency = "diario" | "semanal" | "mensal" | "trimestral" | "semestral";

export type ChecklistItem = {
  id: string;
  title: string;
  frequency: ChecklistFrequency;
  /** Indica exigência geral ou ponto condicionado à licença/regra local */
  requirement: "obrigatorio" | "condicional" | "recomendado";
};

/** Bico de abastecimento */
export type Nozzle = {
  id: string;
  /** Identificação do bico, ex.: "Bico 1" */
  name: string;
  /** Combustível do bico */
  fuel: string;
};

export type CalibrationItem = {
  nozzleId: string;
  /** Resultado em ml na vazão lenta */
  lenta?: number | undefined;
  /** Resultado em ml na vazão rápida */
  rapida?: number | undefined;
};

/** Aferição de bicos */
export type Calibration = {
  id: string;
  date: string;
  responsavel: string;
  items: CalibrationItem[];
  createdAt: string;
};


/** Item (combustível) de uma nota de recebimento */
export type DeliveryItem = {
  fuel: string;
  /** Litros recebidos */
  qty: number;
  temperatura?: number | undefined;
  densidade?: number | undefined;
  /** Densidade corrigida a 20 °C */
  densidade20?: number | undefined;
  /** Teor alcoólico (%) — etanol */
  teorAlcoolico?: number | undefined;
  /** % de etanol na gasolina */
  etanolPct?: number | undefined;
  /** Ponto de fulgor (°C) — diesel */
  fulgor?: number | undefined;
};

/** Recebimento de combustível (nota fiscal) */
export type Delivery = {
  id: string;
  date: string;
  distribuidora: string;
  nf: string;
  items: DeliveryItem[];
  createdAt: string;
};

/** Dados cadastrais do posto usados no cabeçalho dos PDFs */
export type Company = {
  name: string;
  address: string;
  bairro: string;
  cnpj: string;
  ie: string;
  phone: string;
};

export type AppState = {
  /** Cadastro do posto */
  company?: Company;
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
  /** Contagens de estoque físico (acertos) */
  counts: StockCount[];
  /** Folga automática para todos os frentistas em todos os domingos */
  sundayOff?: boolean;
  /** Tarefas do quadro kanban */
  tasks?: Task[];
  /** Bicos cadastrados */
  nozzles?: Nozzle[];
  /** Aferições realizadas */
  calibrations?: Calibration[];
  /** Recebimentos de combustível */
  deliveries?: Delivery[];
  /** Verificações operacionais e de conformidade do gerente */
  checklistItems?: ChecklistItem[];
  /** Último ciclo concluído por item (dia, semana, mês, trimestre ou semestre) */
  checklistChecks?: Record<string, string>;
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

/** 36 bicos padrão (Bico 1 ... Bico 36) */
export function defaultNozzles(): Nozzle[] {
  return Array.from({ length: 36 }, (_, i) => ({
    id: `n${i + 1}`,
    name: `Bico ${i + 1}`,
    fuel: "Gasolina Comum",
  }));
}

export function defaultChecklistItems(): ChecklistItem[] {
  const items: Array<Omit<ChecklistItem, "id">> = [
    { frequency: "diario", requirement: "obrigatorio", title: "Escriturar o Livro de Movimentação de Combustíveis (LMC) com compras, vendas e estoque por produto" },
    { frequency: "diario", requirement: "obrigatorio", title: "Medir fisicamente o estoque dos tanques e comparar com o estoque contábil" },
    { frequency: "diario", requirement: "obrigatorio", title: "Conferir se os preços estão visíveis e iguais no totem, bombas e sistema de caixa" },
    { frequency: "diario", requirement: "obrigatorio", title: "Verificar uso dos EPIs e cumprimento das regras de segurança na pista" },
    { frequency: "diario", requirement: "recomendado", title: "Inspecionar bicos, mangueiras e bombas para identificar vazamentos, gotejamento ou avarias" },
    { frequency: "diario", requirement: "recomendado", title: "Conferir limpeza da pista, sinalização, iluminação, extintores e saídas desobstruídas" },
    { frequency: "diario", requirement: "recomendado", title: "Conferir fechamento dos turnos, caixa e vendas por forma de pagamento" },
    { frequency: "diario", requirement: "recomendado", title: "Verificar funcionamento das câmeras, alarmes e controles de acesso" },

    { frequency: "semanal", requirement: "obrigatorio", title: "Verificar a integridade dos lacres e selos do Inmetro nas bombas medidoras" },
    { frequency: "semanal", requirement: "obrigatorio", title: "Conferir validade, acesso e sinalização dos extintores conforme o plano de segurança" },
    { frequency: "semanal", requirement: "recomendado", title: "Auditar volume vendido, compras e estoque do LMC para investigar divergências" },
    { frequency: "semanal", requirement: "recomendado", title: "Inspecionar canaletas e caixa separadora de água e óleo contra acúmulo, entupimento ou transbordo" },
    { frequency: "semanal", requirement: "recomendado", title: "Inspecionar cobertura da pista e sistemas de contenção ou recuperação de vapores existentes" },
    { frequency: "semanal", requirement: "recomendado", title: "Realizar conversa de segurança e revisar procedimentos operacionais com a equipe" },
    { frequency: "semanal", requirement: "recomendado", title: "Conferir estoque e validade de produtos da loja, lubrificantes e materiais de consumo" },

    { frequency: "mensal", requirement: "obrigatorio", title: "Conferir obrigações de movimentação e os envios exigidos pela ANP dentro do prazo aplicável" },
    { frequency: "mensal", requirement: "obrigatorio", title: "Revisar vencimentos de alvará, licença ambiental, AVCB e demais certificados do posto" },
    { frequency: "mensal", requirement: "obrigatorio", title: "Conferir validade dos treinamentos obrigatórios, incluindo NR-20 e brigada de incêndio" },
    { frequency: "mensal", requirement: "recomendado", title: "Revisar manutenção preventiva de bombas, tanques, filtros e equipamentos elétricos" },
    { frequency: "mensal", requirement: "recomendado", title: "Analisar margem por combustível, despesas, perdas, inadimplência e resultados do mês" },
    { frequency: "mensal", requirement: "recomendado", title: "Avaliar desempenho da equipe e necessidades de treinamento" },
    { frequency: "mensal", requirement: "recomendado", title: "Testar gerador, nobreak e sistemas de emergência existentes" },
    { frequency: "mensal", requirement: "recomendado", title: "Organizar notas, laudos, certificados e documentos para pronta apresentação em fiscalização" },

    { frequency: "trimestral", requirement: "condicional", title: "Realizar monitoramento dos poços ambientais quando exigido pela licença ambiental" },
    { frequency: "trimestral", requirement: "condicional", title: "Verificar sensores e sistemas automáticos de detecção de vazamentos instalados" },
    { frequency: "trimestral", requirement: "recomendado", title: "Executar auditoria interna de documentação, LMC, preços, lacres, sinalização e identidade da bandeira" },
    { frequency: "trimestral", requirement: "recomendado", title: "Revisar contratos de manutenção de bombas, tanques e instalações elétricas" },
    { frequency: "trimestral", requirement: "recomendado", title: "Realizar simulado de emergência com cenário de vazamento ou princípio de incêndio" },

    { frequency: "semestral", requirement: "condicional", title: "Confirmar a verificação metrológica das bombas no prazo definido pelo Inmetro/IPEM local" },
    { frequency: "semestral", requirement: "condicional", title: "Realizar teste de estanqueidade de tanques e tubulações no prazo da licença e das normas aplicáveis" },
    { frequency: "semestral", requirement: "condicional", title: "Revisar laudos elétricos, SPDA e sistema de combate a incêndio exigidos pelos órgãos locais" },
    { frequency: "semestral", requirement: "recomendado", title: "Revisar o plano de gerenciamento de riscos e o plano de emergência ambiental" },
    { frequency: "semestral", requirement: "recomendado", title: "Auditar segurança patrimonial, câmeras, alarmes, acessos e apólices de seguro" },
  ];
  return items.map((item, index) => ({ ...item, id: `check-${index + 1}` }));
}

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
  counts: [],
  sundayOff: false,
  tasks: [],
  nozzles: defaultNozzles(),
  calibrations: [],
  deliveries: [],
  checklistItems: defaultChecklistItems(),
  checklistChecks: {},
};


function load(): AppState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as AppState;
    const merged = { ...defaultState, ...parsed };
    if (!merged.nozzles || merged.nozzles.length === 0) merged.nozzles = defaultNozzles();
    return merged;

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

  toggleFalta: (id: string, date: string) =>
    update((s) => ({
      ...s,
      attendants: s.attendants.map((a) =>
        a.id === id
          ? {
              ...a,
              faltas: (a.faltas ?? []).includes(date)
                ? (a.faltas ?? []).filter((d) => d !== date)
                : [...(a.faltas ?? []), date],
            }
          : a,
      ),
    })),

  setSundayOff: (on: boolean) => update((s) => ({ ...s, sundayOff: on })),

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

  /* ---------- contagem de estoque ---------- */

  addStockCount: (c: Omit<StockCount, "id" | "diff">) =>
    update((s) => ({
      ...s,
      counts: [
        ...(s.counts ?? []),
        { ...c, diff: c.counted - c.expected, id: uid() },
      ],
    })),

  removeStockCount: (id: string) =>
    update((s) => ({ ...s, counts: (s.counts ?? []).filter((c) => c.id !== id) })),

  /* ---------- tarefas (kanban) ---------- */

  addTask: (t: Omit<Task, "id" | "createdAt">) =>
    update((s) => ({
      ...s,
      tasks: [...(s.tasks ?? []), { ...t, id: uid(), createdAt: new Date().toISOString() }],
    })),

  updateTask: (id: string, patch: Partial<Task>) =>
    update((s) => ({
      ...s,
      tasks: (s.tasks ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  setTaskStatus: (id: string, status: TaskStatus) =>
    update((s) => ({
      ...s,
      tasks: (s.tasks ?? []).map((t) => (t.id === id ? { ...t, status } : t)),
    })),

  /* ---------- bicos e aferição ---------- */

  addNozzle: (n: Omit<Nozzle, "id">) =>
    update((s) => ({ ...s, nozzles: [...(s.nozzles ?? []), { ...n, id: uid() }] })),

  updateNozzle: (id: string, patch: Partial<Nozzle>) =>
    update((s) => ({
      ...s,
      nozzles: (s.nozzles ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeNozzle: (id: string) =>
    update((s) => ({ ...s, nozzles: (s.nozzles ?? []).filter((n) => n.id !== id) })),

  addCalibration: (c: Omit<Calibration, "id" | "createdAt">) =>
    update((s) => ({
      ...s,
      calibrations: [
        { ...c, id: uid(), createdAt: new Date().toISOString() },
        ...(s.calibrations ?? []),
      ],
    })),

  removeCalibration: (id: string) =>
    update((s) => ({
      ...s,
      calibrations: (s.calibrations ?? []).filter((c) => c.id !== id),
    })),

  /* ---------- recebimento de combustível ---------- */

  addDelivery: (d: Omit<Delivery, "id" | "createdAt">) =>
    update((s) => ({
      ...s,
      deliveries: [
        { ...d, id: uid(), createdAt: new Date().toISOString() },
        ...(s.deliveries ?? []),
      ],
    })),

  removeDelivery: (id: string) =>
    update((s) => ({
      ...s,
      deliveries: (s.deliveries ?? []).filter((d) => d.id !== id),
    })),

  removeTask: (id: string) =>
    update((s) => ({ ...s, tasks: (s.tasks ?? []).filter((t) => t.id !== id) })),

  /* ---------- check list gerencial ---------- */

  addChecklistItem: (item: Omit<ChecklistItem, "id">) =>
    update((s) => ({
      ...s,
      checklistItems: [...(s.checklistItems ?? []), { ...item, id: uid() }],
    })),

  updateChecklistItem: (id: string, patch: Partial<ChecklistItem>) =>
    update((s) => ({
      ...s,
      checklistItems: (s.checklistItems ?? []).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })),

  removeChecklistItem: (id: string) =>
    update((s) => {
      const checks = { ...(s.checklistChecks ?? {}) };
      delete checks[id];
      return {
        ...s,
        checklistItems: (s.checklistItems ?? []).filter((item) => item.id !== id),
        checklistChecks: checks,
      };
    }),

  toggleChecklistItem: (id: string, cycleKey: string) =>
    update((s) => {
      const checks = { ...(s.checklistChecks ?? {}) };
      if (checks[id] === cycleKey) delete checks[id];
      else checks[id] = cycleKey;
      return { ...s, checklistChecks: checks };
    }),

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
    attendants: (data.attendants as Attendant[]).map((a) => ({
      ...a,
      folgas: a.folgas ?? [],
      faltas: a.faltas ?? [],
    })),
    openings: data.openings ?? {},
    sales: data.sales ?? {},
    products: data.products ?? [],
    productSales: data.productSales ?? {},
    restocks: data.restocks ?? [],
    counts: data.counts ?? [],
    sundayOff: data.sundayOff ?? false,
    tasks: data.tasks ?? [],
    nozzles: data.nozzles ?? [],
    calibrations: data.calibrations ?? [],
    deliveries: data.deliveries ?? [],
    checklistItems: data.checklistItems ?? defaultChecklistItems(),
    checklistChecks: data.checklistChecks ?? {},
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

/** Soma dos acertos (falta/sobra) das contagens físicas */
export function productAdjusted(s: AppState, productId: string, from?: string, to?: string) {
  return (s.counts ?? [])
    .filter(
      (c) =>
        c.productId === productId && (!from || c.date >= from) && (!to || c.date <= to),
    )
    .reduce((a, c) => a + (c.diff ?? 0), 0);
}

/** Saldo atual = estoque inicial + reposições - vendas + acertos de contagem */
export function productBalance(s: AppState, productId: string) {
  const product = s.products.find((p) => p.id === productId);
  if (!product) return 0;
  return (
    product.initialStock +
    productRestocked(s, productId) -
    productSold(s, productId) +
    productAdjusted(s, productId)
  );
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

/** Domingo? (iso yyyy-mm-dd) */
export function isSunday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getDay() === 0;
}

export type DayStatus = "trabalho" | "folga" | "falta";

export function dayStatus(s: AppState, a: Attendant, iso: string): DayStatus {
  if ((a.faltas ?? []).includes(iso)) return "falta";
  if (a.folgas.includes(iso)) return "folga";
  if (s.sundayOff && isSunday(iso)) return "folga";
  return "trabalho";
}

/* ---------- aferição: derivados ---------- */

export const CALIBRATION_LIMIT = 100;

/** Aprovada quando todos os valores informados estão entre -100 e +100 */
export function calibrationApproved(c: Calibration) {
  const values = c.items.flatMap((i) =>
    [i.lenta, i.rapida].filter((v): v is number => typeof v === "number"),
  );
  if (values.length === 0) return false;
  return values.every((v) => v >= -CALIBRATION_LIMIT && v <= CALIBRATION_LIMIT);
}

/** Cor do combustível conforme os tanques cadastrados */
export function fuelColor(s: AppState, fuel: string): string | undefined {
  const key = fuel.trim().toLowerCase();
  return s.tanks.find((t) => t.name.trim().toLowerCase() === key)?.color;
}
