import { useEffect, useMemo, useState } from "react";
export const PIX_KEY = "19992197178";
export const SUBSCRIPTION_PRICE = "79,95";
export type SubscriptionPlan = "troca-oleo" | "frentista" | "gerente";
export const PLAN_PRICES: Record<SubscriptionPlan, string> = {
  "troca-oleo": "69,90",
  frentista: "89,90",
  gerente: "109,90",
};

export function planAllows(plan: SubscriptionPlan, path: string) {
  if (path === "/pagamentos" || path === "/troca-oleo") return true;
  if (plan === "gerente") return true;
  if (plan === "frentista") {
    return ["/", "/relatorios", "/produtos", "/recebimento"].includes(path);
  }
  return false;
}
const SUBSCRIPTION_DAYS = 30;
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "Admin@Posto10@";
const AUTH_STORAGE_KEY = "posto-auth-session";
const SUBSCRIPTION_STORAGE_KEY = "posto-subscription";

type SubscriptionStatus = "active" | "warning" | "grace" | "expired";

type StoredSubscription = {
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: SubscriptionPlan;
};

type AuthSession = {
  isAdmin: boolean;
  username?: string;
};

export type SubscriptionState = {
  authLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string | null;
  subscriptionStartDate: string | null;
  subscriptionExpiryDate: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  daysRemaining: number;
  daysUntilBlock: number;
  needsPayment: boolean;
  isBlocked: boolean;
  authError: string | null;
  loginUser: (username: string, password: string) => boolean;
  loginAdmin: (login: string, password: string) => boolean;
  changePassword: (currentPassword: string, nextPassword: string) => boolean;
  logout: () => Promise<void>;
  renewSubscription: (plan?: SubscriptionPlan) => void;
};

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = parseDay(value);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

function dayDistance(from: string, to: string) {
  return Math.floor((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000);
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function subscriptionFromStorage() {
  const stored = readJson<StoredSubscription>(SUBSCRIPTION_STORAGE_KEY) ?? {};
  if (typeof window === "undefined") return stored;
  return {
    subscriptionStartDate:
      window.localStorage.getItem("subscriptionStartDate") ?? stored.subscriptionStartDate,
    subscriptionExpiryDate:
      window.localStorage.getItem("subscriptionExpiryDate") ?? stored.subscriptionExpiryDate,
    subscriptionStatus:
      (window.localStorage.getItem("subscriptionStatus") as SubscriptionStatus | null) ??
      stored.subscriptionStatus,
    subscriptionPlan:
      (window.localStorage.getItem("subscriptionPlan") as SubscriptionPlan | null) ??
      stored.subscriptionPlan,
  };
}

function calculateSubscription(stored: StoredSubscription, today: string) {
  if (!stored.subscriptionStartDate || !stored.subscriptionExpiryDate) {
    return { status: "expired" as SubscriptionStatus, daysRemaining: 0, daysUntilBlock: 0 };
  }

  const elapsed = dayDistance(stored.subscriptionStartDate, today);
  const daysRemaining = Math.max(0, dayDistance(today, stored.subscriptionExpiryDate));
  const daysUntilBlock = Math.max(0, 35 - elapsed);
  const status: SubscriptionStatus =
    elapsed >= 35 ? "expired" : elapsed >= 30 ? "grace" : elapsed >= 25 ? "warning" : "active";

  return { status, daysRemaining, daysUntilBlock };
}

function saveSubscription(start: string, plan: SubscriptionPlan) {
  const subscription = {
    subscriptionStartDate: start,
    subscriptionExpiryDate: addDays(start, SUBSCRIPTION_DAYS),
    subscriptionStatus: "active" as SubscriptionStatus,
    subscriptionPlan: plan,
  };
  window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subscription));
  window.localStorage.setItem("subscriptionStartDate", subscription.subscriptionStartDate);
  window.localStorage.setItem("subscriptionExpiryDate", subscription.subscriptionExpiryDate);
  window.localStorage.setItem("subscriptionStatus", subscription.subscriptionStatus);
  window.localStorage.setItem("subscriptionPlan", subscription.subscriptionPlan);
}

export function useSubscription(): SubscriptionState {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [storedSubscription, setStoredSubscription] = useState<StoredSubscription>({});
  const [today, setToday] = useState(todayKey());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setStoredSubscription(subscriptionFromStorage());
    const localSession = readJson<AuthSession>(AUTH_STORAGE_KEY);
    if (localSession?.isAdmin || window.localStorage.getItem("isAdmin") === "true") {
      setSession(localSession);
      setAuthLoading(false);
      return;
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayKey()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const calculated = useMemo(
    () => calculateSubscription(storedSubscription, today),
    [storedSubscription, today],
  );

  useEffect(() => {
    if (!storedSubscription.subscriptionExpiryDate || typeof window === "undefined") return;
    if (storedSubscription.subscriptionStatus === calculated.status) return;
    const next = { ...storedSubscription, subscriptionStatus: calculated.status };
    window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem("subscriptionStatus", calculated.status);
    setStoredSubscription(next);
  }, [calculated.status, storedSubscription]);

  const renewSubscription = (plan?: SubscriptionPlan) => {
    const start = todayKey();
    const selectedPlan = plan ?? storedSubscription.subscriptionPlan ?? "gerente";
    saveSubscription(start, selectedPlan);
    setStoredSubscription(subscriptionFromStorage());
  };

  const loginAdmin = (login: string, password: string) => {
    if (login !== ADMIN_LOGIN || password !== ADMIN_PASSWORD) return false;
    const next = { isAdmin: true } satisfies AuthSession;
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem("isAdmin", "true");
    setAuthError(null);
    setSession(next);
    return true;
  };

  const loginUser = (username: string, password: string) => {
    const normalizedUsername = username.trim().toLowerCase() as SubscriptionPlan;
    if (!(normalizedUsername in PLAN_PRICES)) {
      setAuthError("Use o nome do plano: troca-oleo, frentista ou gerente.");
      return false;
    }
    const passwordKey = `posto-password-${normalizedUsername}`;
    const storedPassword = window.localStorage.getItem(passwordKey) ?? "posto10";
    if (password !== storedPassword) {
      setAuthError("Usuário ou senha inválidos.");
      return false;
    }
    const next = { isAdmin: false, username: normalizedUsername } satisfies AuthSession;
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    const nextSubscription = { ...subscriptionFromStorage(), subscriptionPlan: normalizedUsername };
    window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(nextSubscription));
    window.localStorage.setItem("subscriptionPlan", normalizedUsername);
    setStoredSubscription(nextSubscription);
    setAuthError(null);
    setSession(next);
    return true;
  };

  const changePassword = (currentPassword: string, nextPassword: string) => {
    const username = session?.username as SubscriptionPlan | undefined;
    if (!username || !nextPassword.trim()) return false;
    const passwordKey = `posto-password-${username}`;
    const storedPassword = window.localStorage.getItem(passwordKey) ?? "posto10";
    if (currentPassword !== storedPassword) return false;
    window.localStorage.setItem(passwordKey, nextPassword);
    return true;
  };

  const logout = async () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem("isAdmin");
    setSession(null);
  };

  return {
    authLoading,
    isAuthenticated: Boolean(session),
    isAdmin: session?.isAdmin ?? false,
    username: session?.username ?? null,
    subscriptionStartDate: storedSubscription.subscriptionStartDate ?? null,
    subscriptionExpiryDate: storedSubscription.subscriptionExpiryDate ?? null,
    subscriptionStatus: calculated.status,
    subscriptionPlan: storedSubscription.subscriptionPlan ?? "gerente",
    daysRemaining: calculated.daysRemaining,
    daysUntilBlock: calculated.daysUntilBlock,
    needsPayment: Boolean(
      session && !session.isAdmin && !storedSubscription.subscriptionExpiryDate,
    ),
    isBlocked: Boolean(session && !session.isAdmin && calculated.status === "expired"),
    authError,
    loginUser,
    loginAdmin,
    changePassword,
    logout,
    renewSubscription,
  };
}
