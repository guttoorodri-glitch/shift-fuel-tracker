import type { PaidOwnerSignup } from "@/lib/local-auth";

export const SAAS_PLAN_PRICES_CENTS = {
  MENSAL: 12990,
  ANUAL: 129900,
} as const;

export function saasPlanPrice(plan: PaidOwnerSignup["plano"]) {
  return SAAS_PLAN_PRICES_CENTS[plan] / 100;
}

export function saasMonthlyEquivalent(plan: PaidOwnerSignup["plano"]) {
  return plan === "ANUAL" ? SAAS_PLAN_PRICES_CENTS.ANUAL / 100 / 12 : saasPlanPrice(plan);
}

export type PendingCheckout = Omit<PaidOwnerSignup, "senha"> & { senha: string };

const PENDING_CHECKOUT_KEY = "posto10-pending-checkout";

export function savePendingCheckout(signup: PendingCheckout) {
  window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(signup));
}

export function readPendingCheckout(): PendingCheckout | null {
  const raw = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingCheckout;
  } catch (error) {
    throw new Error("NÃO FOI POSSÍVEL LER O CADASTRO PENDENTE.", { cause: error });
  }
}

export function clearPendingCheckout() {
  window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
}
