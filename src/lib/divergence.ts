export type DivergenceStatus = "OK" | "DIVERGENCIA" | "CRITICA";

export type TankDivergence = {
  date: string;
  tankId: string;
  theoretical: number;
  physical: number;
  diffLiters: number;
  diffPercent: number;
  status: DivergenceStatus;
  consecutiveDays: number;
};

const STORAGE_PREFIX = "divergencia_";
const CHANGE_EVENT = "divergence_updated";
const TOLERANCE_PERCENT = 0.6;

function storageKey(date: string, tankId: string) {
  return `${STORAGE_PREFIX}${date}_${tankId}`;
}

function isDivergenceRecord(value: unknown): value is TankDivergence {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TankDivergence>;
  return (
    typeof record.date === "string" &&
    typeof record.tankId === "string" &&
    typeof record.theoretical === "number" &&
    typeof record.physical === "number" &&
    typeof record.diffLiters === "number" &&
    typeof record.diffPercent === "number" &&
    (record.status === "OK" || record.status === "DIVERGENCIA" || record.status === "CRITICA") &&
    typeof record.consecutiveDays === "number"
  );
}

export function getDivergenceRecords(): TankDivergence[] {
  if (typeof window === "undefined") return [];
  const records: TankDivergence[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (isDivergenceRecord(parsed)) records.push(parsed);
      else console.error(`REGISTRO DE DIVERGÊNCIA INVÁLIDO: ${key}`);
    }
  } catch (error) {
    console.error("NÃO FOI POSSÍVEL LER O HISTÓRICO DE DIVERGÊNCIAS.", error);
    throw error;
  }
  return records.sort((a, b) => a.date.localeCompare(b.date) || a.tankId.localeCompare(b.tankId));
}

export function findDivergenceRecord(records: TankDivergence[], date: string, tankId: string) {
  return records.find((record) => record.date === date && record.tankId === tankId);
}

export function saveDivergenceRecord(
  date: string,
  tankId: string,
  theoretical: number,
  physical: number,
  capacity: number,
): TankDivergence {
  if (typeof window === "undefined") {
    throw new Error("NÃO É POSSÍVEL SALVAR DIVERGÊNCIA FORA DO NAVEGADOR.");
  }
  if (!Number.isFinite(theoretical) || !Number.isFinite(physical) || capacity <= 0) {
    throw new Error("VALORES INVÁLIDOS PARA CALCULAR A DIVERGÊNCIA.");
  }
  const diffLiters = physical - theoretical;
  const diffPercent = (diffLiters / capacity) * 100;
  const absoluteDiffPercent = Math.abs(diffPercent);
  const previousDate = new Date(`${date}T12:00:00`);
  const existingRecords = getDivergenceRecords();
  let consecutiveDays = 1;
  for (let offset = 1; ; offset += 1) {
    previousDate.setDate(previousDate.getDate() - 1);
    const day = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}-${String(previousDate.getDate()).padStart(2, "0")}`;
    const previous = existingRecords.find(
      (record) => record.date === day && record.tankId === tankId,
    );
    if (!previous || Math.abs(previous.diffPercent) <= TOLERANCE_PERCENT) break;
    consecutiveDays += 1;
  }
  const status: DivergenceStatus =
    absoluteDiffPercent <= TOLERANCE_PERCENT
      ? "OK"
      : consecutiveDays >= 3
        ? "CRITICA"
        : "DIVERGENCIA";
  const record: TankDivergence = {
    date,
    tankId,
    theoretical,
    physical,
    diffLiters,
    diffPercent,
    status,
    consecutiveDays: absoluteDiffPercent <= TOLERANCE_PERCENT ? 0 : consecutiveDays,
  };
  try {
    window.localStorage.setItem(storageKey(date, tankId), JSON.stringify(record));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch (error) {
    console.error("NÃO FOI POSSÍVEL SALVAR A DIVERGÊNCIA DO TANQUE.", error);
    throw error;
  }
  return record;
}

export function subscribeToDivergenceChanges(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function divergenceCriticalAlerts(records: TankDivergence[]) {
  return records.filter((record) => record.status === "CRITICA");
}

export function formatDivergencePercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}
