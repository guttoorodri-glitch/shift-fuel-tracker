import type { AppState } from "@/lib/store";
import { calculateTankAutonomy, formatAutonomy, formatTankLiters } from "@/lib/tank-autonomy";
import { getDivergenceRecords } from "@/lib/divergence";
import { readFiscalDocuments } from "@/lib/fiscalizacao";

export const OWNER_WHATSAPP_CONFIG_KEY = "config_whatsapp_dono";
export const OWNER_WHATSAPP_EVENT = "posto10:whatsapp-dono";

export type OwnerWhatsAppItem =
  | "fuelDetails"
  | "fuelChanges"
  | "mix"
  | "oilChanges"
  | "divergences"
  | "fiscalDocuments"
  | "deliveries"
  | "lowTanks";

export type OwnerWhatsAppConfig = {
  ativo: boolean;
  numero: string;
  horario: string;
  itens: Record<OwnerWhatsAppItem, boolean>;
};

export const OWNER_WHATSAPP_ITEMS: Array<{ key: OwnerWhatsAppItem; label: string }> = [
  { key: "fuelDetails", label: "TOTAL POR COMBUSTÍVEL DETALHADO" },
  { key: "fuelChanges", label: "VARIAÇÃO % VS DIA ANTERIOR (TOTAL E POR COMBUSTÍVEL)" },
  { key: "mix", label: "TOTAL MIX" },
  { key: "oilChanges", label: "TROCAS DE ÓLEO" },
  { key: "divergences", label: "DIVERGÊNCIA DE TANQUES (SE ALERTA)" },
  { key: "fiscalDocuments", label: "DOCUMENTOS VENCENDO" },
  { key: "deliveries", label: "RECEBIMENTOS DO DIA" },
  { key: "lowTanks", label: "ALERTA 25% TANQUES" },
];

export const DEFAULT_OWNER_WHATSAPP_CONFIG: OwnerWhatsAppConfig = {
  ativo: false,
  numero: "",
  horario: "23:59",
  itens: {
    fuelDetails: true,
    fuelChanges: true,
    mix: true,
    oilChanges: true,
    divergences: true,
    fiscalDocuments: true,
    deliveries: true,
    lowTanks: true,
  },
};

export function readOwnerWhatsAppConfig(): OwnerWhatsAppConfig {
  if (typeof window === "undefined") return DEFAULT_OWNER_WHATSAPP_CONFIG;
  const raw = window.localStorage.getItem(OWNER_WHATSAPP_CONFIG_KEY);
  if (!raw) return DEFAULT_OWNER_WHATSAPP_CONFIG;
  try {
    const parsed: Partial<OwnerWhatsAppConfig> = JSON.parse(raw);
    return {
      ativo: parsed.ativo === true,
      numero: typeof parsed.numero === "string" ? parsed.numero : "",
      horario: /^\d{2}:\d{2}$/.test(parsed.horario ?? "") ? (parsed.horario as string) : "23:59",
      itens: {
        ...DEFAULT_OWNER_WHATSAPP_CONFIG.itens,
        ...(parsed.itens ?? {}),
      },
    };
  } catch (error) {
    console.error("CONFIGURAÇÃO DE WHATSAPP DO PROPRIETÁRIO INVÁLIDA.", error);
    throw new Error("NÃO FOI POSSÍVEL LER A CONFIGURAÇÃO DO WHATSAPP DO PROPRIETÁRIO.");
  }
}

export function writeOwnerWhatsAppConfig(config: OwnerWhatsAppConfig) {
  if (config.ativo && config.numero.replace(/\D/g, "").length < 12) {
    throw new Error("INFORME WHATSAPP DO PROPRIETÁRIO COM DDD E CÓDIGO DO PAÍS.");
  }
  try {
    window.localStorage.setItem(OWNER_WHATSAPP_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(OWNER_WHATSAPP_EVENT));
  } catch (error) {
    console.error("NÃO FOI POSSÍVEL SALVAR A CONFIGURAÇÃO DO WHATSAPP DO PROPRIETÁRIO.", error);
    throw new Error("NÃO FOI POSSÍVEL SALVAR A CONFIGURAÇÃO DO WHATSAPP DO PROPRIETÁRIO.");
  }
}

function salesByFuel(state: AppState, date: string) {
  const totals = new Map<string, number>();
  for (const tank of state.tanks) {
    const name = tank.name.toLocaleUpperCase("pt-BR");
    const liters = Object.values(state.sales[date] ?? {}).reduce(
      (sum, shift) => sum + (shift[tank.id] ?? 0),
      0,
    );
    totals.set(name, (totals.get(name) ?? 0) + liters);
  }
  return totals;
}

function totalSales(state: AppState, date: string) {
  return [...salesByFuel(state, date).values()].reduce((sum, liters) => sum + liters, 0);
}

function compare(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "SEM BASE";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "🔼+" : "🔽"}${change.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function dateOffset(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function buildOwnerWhatsAppMessage(
  state: AppState,
  config: OwnerWhatsAppConfig,
  date: string,
) {
  const previousDate = dateOffset(date, -1);
  const todaySales = salesByFuel(state, date);
  const previousSales = salesByFuel(state, previousDate);
  const liters = totalSales(state, date);
  const priorLiters = totalSales(state, previousDate);
  const lines = [
    `🏪 POSTO 10 - FECHAMENTO ${formatDate(date)} - ${config.horario}`,
    "",
    `🔥 TOTAL VENDIDO HOJE: ${formatTankLiters(liters).toLocaleUpperCase("pt-BR")}`,
  ];

  if (config.itens.fuelDetails) {
    lines.push("", "⛽ DETALHADO:");
    for (const [fuel, amount] of todaySales) {
      const variation = config.itens.fuelChanges
        ? ` (${compare(amount, previousSales.get(fuel) ?? 0)} VS ONTEM)`
        : "";
      lines.push(`${fuel}: ${formatTankLiters(amount)}${variation}`);
    }
  }
  if (config.itens.fuelChanges) {
    lines.push(
      `VARIAÇÃO TOTAL VS ONTEM: ${compare(liters, priorLiters)}`,
      `VARIAÇÃO POR COMBUSTÍVEL: ${
        [...todaySales]
          .map(([fuel, amount]) => `${fuel} ${compare(amount, previousSales.get(fuel) ?? 0)}`)
          .join(" · ") || "SEM VENDAS"
      }`,
    );
  }
  if (config.itens.mix) {
    const units = Object.values(state.productSales[date] ?? {}).reduce(
      (sum, turn) => sum + Object.values(turn).reduce((turnSum, qty) => turnSum + qty, 0),
      0,
    );
    const previousUnits = Object.values(state.productSales[previousDate] ?? {}).reduce(
      (sum, turn) => sum + Object.values(turn).reduce((turnSum, qty) => turnSum + qty, 0),
      0,
    );
    lines.push(
      `📦 MIX: ${units.toLocaleString("pt-BR")} UNID.${config.itens.fuelChanges ? ` (${compare(units, previousUnits)} VS ONTEM)` : ""}`,
    );
  }
  if (config.itens.oilChanges) {
    const count = (state.oilChanges ?? []).filter((change) => change.date === date).length;
    lines.push(`🔧 TROCAS: ${count}`);
  }
  if (config.itens.deliveries) {
    const received = (state.deliveries ?? []).filter((delivery) => delivery.date === date);
    const receiptSummary = received
      .flatMap((delivery) =>
        delivery.items.map((item) => {
          const tankIndex = state.tanks.findIndex((tank) => tank.id === item.tankId);
          const tankLabel =
            tankIndex >= 0
              ? `T${String(tankIndex + 1).padStart(2, "0")}`
              : "TANQUE NÃO IDENTIFICADO";
          return `${formatTankLiters(item.qty)} ${item.fuel.toLocaleUpperCase("pt-BR")} - ${tankLabel}`;
        }),
      )
      .join(" / ");
    const receivedTotal = received
      .flatMap((delivery) => delivery.items)
      .reduce((sum, item) => sum + item.qty, 0);
    lines.push(
      `⛽ RECEBIMENTOS: ${formatTankLiters(receivedTotal)}${receiptSummary ? ` - ${receiptSummary}` : ""}`,
    );
  }
  if (config.itens.divergences) {
    const alerts = getDivergenceRecords().filter(
      (record) =>
        record.date === date && (record.status === "DIVERGENCIA" || record.status === "CRITICA"),
    );
    lines.push(
      `⚠️ DIVERGÊNCIAS: ${
        alerts.length > 0
          ? alerts
              .map((record) => {
                const index = state.tanks.findIndex((tank) => tank.id === record.tankId);
                return `T${String(index + 1).padStart(2, "0")} ${formatTankLiters(record.diffLiters)} (${record.diffPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`;
              })
              .join(" · ")
          : "TANQUES OK DENTRO DE 0,6%"
      }`,
    );
  }
  if (config.itens.lowTanks) {
    const alerts = calculateTankAutonomy(state, date).filter(
      (entry) => entry.percent !== undefined && entry.percent <= 25,
    );
    lines.push(
      `🔴 ALERTA 25%: ${
        alerts.length > 0
          ? alerts
              .map(
                (entry) =>
                  `T${String(entry.index + 1).padStart(2, "0")} ATINGIU 25% - AUTONOMIA ${formatAutonomy(entry.autonomyHours)}`,
              )
              .join(" · ")
          : "NENHUM TANQUE EM ALERTA"
      }`,
    );
  }
  if (config.itens.fiscalDocuments) {
    const due = readFiscalDocuments().filter(
      (document) => document.diasParaVencer <= 30 && document.status !== "SEM_DATA",
    );
    lines.push(
      `📄 DOCUMENTOS VENCENDO: ${
        due.length > 0
          ? due
              .map(
                (document) =>
                  `${document.nomeDocumento.toLocaleUpperCase("pt-BR")} EM ${document.diasParaVencer} DIAS`,
              )
              .join(" · ")
          : "NENHUM NOS PRÓXIMOS 30 DIAS"
      }`,
    );
  }
  lines.push("", "POSTO 10 AUTOMÁTICO");
  return lines.join("\n");
}

export function ownerWhatsAppUrl(numero: string, message: string) {
  const digits = numero.replace(/\D/g, "");
  const international = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

export function dailyWhatsAppSentKey(date: string) {
  return `envio_whatsapp_${date}`;
}

export function dailyWhatsAppAttemptKey(date: string) {
  return `tentativa_whatsapp_${date}`;
}
