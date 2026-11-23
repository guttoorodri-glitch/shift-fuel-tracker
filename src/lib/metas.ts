import { useEffect, useState } from "react";

export type TipoMeta = "litros" | "unidades" | "reais";

export type FrentistaMeta = {
  id: string;
  nome: string;
  cpf: string;
  nascimento: string;
  whatsapp: string;
  ativo: boolean;
  metas: Record<string, number>;
};

export type MetaDefinicao = {
  id: string;
  nome: string;
  tipo: TipoMeta;
  valorMensal: number;
  valoresIndividuais: Record<string, number>;
  padrao?: boolean;
};

export type VendaMeta = {
  data: string;
  frentistaId: string;
  metaNome: string;
  quantidade: number;
};

export type TipoMetaApuracao = "individual" | "equipe";

export const META_TYPE_KEY = "posto10_tipo_meta";
export const BIRTHDAY_NOTIFICATIONS_KEY = "posto10_notificacoes_aniversario";
export const FRENTISTAS_KEY = "posto10_frentistas";
export const METAS_DEFINICAO_KEY = "posto10_metas_definicao";
export const VENDAS_METAS_KEY = "posto10_vendas_metas";

export const METAS_PADRAO: MetaDefinicao[] = [
  {
    id: "gasolina-aditivada",
    nome: "Gasolina Aditivada",
    tipo: "litros",
    valorMensal: 0,
    valoresIndividuais: {},
    padrao: true,
  },
  {
    id: "lubrificantes",
    nome: "Lubrificantes",
    tipo: "unidades",
    valorMensal: 0,
    valoresIndividuais: {},
    padrao: true,
  },
  {
    id: "ducha",
    nome: "Ducha",
    tipo: "unidades",
    valorMensal: 0,
    valoresIndividuais: {},
    padrao: true,
  },
];

export function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export function writeLocalJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(`posto10-storage:${key}`));
}

export function usePostoStorage<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readLocalJson(key, fallback));

  useEffect(() => {
    const refresh = () => setValue(readLocalJson(key, fallback));
    const eventName = `posto10-storage:${key}`;
    window.addEventListener(eventName, refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [fallback, key]);

  const save = (nextValue: T) => {
    setValue(nextValue);
    writeLocalJson(key, nextValue);
  };

  return [value, save];
}

export function readTipoMeta(): TipoMetaApuracao {
  if (typeof window === "undefined") return "individual";
  return window.localStorage.getItem(META_TYPE_KEY) === "equipe" ? "equipe" : "individual";
}

export function writeTipoMeta(value: TipoMetaApuracao): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(META_TYPE_KEY, value);
  window.dispatchEvent(new CustomEvent(`posto10-storage:${META_TYPE_KEY}`));
}

export function parseQuantidade(value: string): number {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cpfValido(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calcDigit = (length: number) => {
    const sum = Array.from(
      { length },
      (_, index) => Number(cpf[index]) * (length + 1 - index),
    ).reduce((total, digit) => total + digit, 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

export function ageOnDate(birthDate: string, referenceDate: Date): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return 0;
  let age = referenceDate.getFullYear() - year;
  if (
    referenceDate.getMonth() + 1 < month ||
    (referenceDate.getMonth() + 1 === month && referenceDate.getDate() < day)
  ) {
    age -= 1;
  }
  return age;
}
