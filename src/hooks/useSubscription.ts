import { useEffect, useMemo, useState } from "react";
import {
  CONSENT_VERSION,
  acceptLocalConsent,
  authenticateLocalAccount,
  recordAccountLogin,
  deleteManagedUser as deleteStoredManagedUser,
  ensureDemoOwner,
  ensureLegacyAccount,
  getLocalAccount,
  getPublicAccount,
  LOCAL_ACCOUNTS_STORAGE_KEY,
  listManagedUsers,
  registerTrialAccount,
  revokeLocalConsent,
  saveManagedUser,
  updateManagedPermissions as updateStoredManagedPermissions,
  updateLocalPassword,
  updateTrialStatus,
  type AccessRole,
  type ManagedPermissions,
  type ManagedUserInput,
  type PublicLocalAccount,
} from "@/lib/local-auth";
export { roleAllows } from "@/lib/local-auth";
export type { ManagedPermissions } from "@/lib/local-auth";
export const PIX_KEY = "19992197178";
export const SUBSCRIPTION_PRICE = "79,95";
export type SubscriptionPlan = "troca-oleo" | "frentista" | "gerente";
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = ["troca-oleo", "frentista", "gerente"];
export const PLAN_PRICES: Record<SubscriptionPlan, string> = {
  "troca-oleo": "69,90",
  frentista: "89,90",
  gerente: "109,90",
};

export const PLAN_MENU_FEATURES = [
  {
    path: "/dashboard",
    label: "DASHBOARD GERENCIAL",
    description:
      "Acompanhe vendas, produtos, recebimentos, trocas de óleo, comparações por período e documentos com vencimento.",
  },
  {
    path: "/metas",
    label: "METAS",
    description:
      "Cadastre frentistas, defina metas individuais ou por equipe, lance vendas diárias e acompanhe o ranking mensal.",
  },
  {
    path: "/aniversariantes",
    label: "ANIVERSARIANTES",
    description:
      "Consulte aniversariantes do dia e do mês e envie mensagens de parabéns pelo WhatsApp.",
  },
  {
    path: "/fiscalizacao",
    label: "FISCALIZAÇÃO",
    description:
      "Cadastre documentos e vencimentos, acompanhe alertas de renovação e envie avisos pelo WhatsApp.",
  },
  {
    path: "/",
    label: "MEDIDAS / VENDAS DIÁRIAS",
    description:
      "Escolha a data e informe medições e vendas de cada tanque em todos os turnos configurados em Ajustes. O sistema valida os campos obrigatórios e atualiza os gráficos de vendas e estoque.",
  },
  {
    path: "/relatorios",
    label: "RELATÓRIO VENDAS COMBUSTÍVEL",
    description:
      "Filtre por datas e tanque para comparar o volume vendido. Consulte totais do período, gráficos por combustível e evolução diária; exporte o resultado em PDF.",
  },
  {
    path: "/recebimento",
    label: "RECEBIMENTO COMBUSTÍVEL",
    description:
      "Registre data, distribuidora e nota fiscal. Informe cada combustível, volume e tanque de destino, além dos dados de análise da descarga; consulte e exporte os recebimentos.",
  },
  {
    path: "/lmc",
    label: "RELATÓRIO LMC",
    description:
      "Consulte a movimentação do Livro de Movimentação de Combustíveis, com compras, vendas e estoques organizados por tanque e data. Filtre períodos e gere PDF.",
  },
  {
    path: "/afericao",
    label: "AFERIÇÃO",
    description:
      "Cadastre cada bico e vincule-o ao tanque de origem. Configure limites de tolerância, registre vazões lenta e rápida e consulte os resultados de aferição.",
  },
  {
    path: "/produtos",
    label: "CONTROLE PRODUTOS",
    description:
      "Cadastre produtos da loja, registre vendas por turno e reposições. Faça contagens físicas e compare o saldo contado com o saldo calculado.",
  },
  {
    path: "/escala",
    label: "ESCALA",
    description:
      "Cadastre frentistas, horários e turnos. Planeje folgas e faltas na grade mensal e salve ou compartilhe a escala em PDF.",
  },
  {
    path: "/tarefas",
    label: "TAREFAS KANBAN",
    description:
      "Crie tarefas, descreva o que precisa ser feito, atribua responsável e prazo. Acompanhe cada cartão pelas etapas do quadro Kanban.",
  },
  {
    path: "/checklist",
    label: "CHECK LIST",
    description:
      "Confira rotinas diárias, semanais, mensais e periódicas do posto. Marque cada verificação concluída no ciclo correspondente e acompanhe o progresso.",
  },
  {
    path: "/fechamento-caixa",
    label: "FECHAMENTO CAIXA",
    description:
      "Selecione data e turno, confira litros e preço por bico, lance mini mercado e compare o total vendido com todas as formas de recebimento. Registre o frentista caixa, assine e salve ou compartilhe o fechamento em PDF.",
  },
  {
    path: "/troca-oleo",
    label: "TROCA DE ÓLEO",
    description:
      "Cadastre técnicos em lubrificação e registre cliente, veículo, produto, filtros, valor e quilometragem. Configure metas e alvos de comissão, emita recibos PDF e acompanhe lembretes de manutenção.",
  },
  {
    path: "/backup",
    label: "BACKUP",
    description:
      "Exporte os dados do aplicativo em arquivo JSON para guardar ou compartilhar. Use a opção de restauração para importar uma cópia existente; mantenha backups em outro local.",
  },
  {
    path: "/configuracoes",
    label: "AJUSTES",
    description:
      "Cadastre os dados da empresa, configure combustíveis/tanques, capacidade e quantidade de turnos. Ajuste preços e tamanho das letras, altere senha e mantenha os dados operacionais atualizados.",
  },
  {
    path: "/ajuda",
    label: "AJUDA",
    description:
      "Leia este guia, compare os recursos incluídos nos planos, consulte orientações de compra e renovação e salve ou compartilhe o Manual e o Contrato em PDF.",
  },
  {
    path: "/usuarios",
    label: "USUÁRIOS DO POSTO",
    description: "Cadastro e manutenção de GERENTES, FRENTISTAS e TROCA-OLEO pelo PROPRIETÁRIO.",
  },
  {
    path: "/lgpd",
    label: "MEU CONSENTIMENTO LGPD",
    description: "Consulte o aceite da Política de Privacidade e registre sua revogação.",
  },
] as const;

export function planAllows(plan: SubscriptionPlan, path: string) {
  if (
    path === "/dashboard" ||
    path === "/metas" ||
    path === "/aniversariantes" ||
    path === "/fiscalizacao"
  )
    return true;
  if (path === "/troca-oleo") return true;
  if (plan === "gerente") return true;
  if (plan === "frentista") {
    return ["/", "/relatorios", "/produtos", "/recebimento"].includes(path);
  }
  return false;
}

const PASSWORD_GRACE_MS = 5 * 60 * 1000;
const ADMIN_PASSWORD = "45231702@";
const AUTH_STORAGE_KEY = "posto-auth-session";
const AUTH_SESSION_CHANGED_EVENT = "posto-auth-session-changed";
const SUBSCRIPTION_STORAGE_KEY = "posto-subscription";
const WRONG_PASSWORD_LOCK_KEY = "posto-wrong-password-lock";
const VISITOR_GRANT_KEY = "posto-visitor-grant";
const DEFAULT_PLAN_PASSWORDS: Record<SubscriptionPlan, string> = {
  "troca-oleo": "TROCADOR10",
  frentista: "FRENTISTA10",
  gerente: "GERENTE10",
};

function notifyAuthSessionChanged() {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

type SubscriptionStatus = "active" | "warning" | "grace" | "expired";

type StoredSubscription = {
  subscriptionStartDate?: string | undefined;
  subscriptionExpiryDate?: string | undefined;
  subscriptionStatus?: SubscriptionStatus | undefined;
  subscriptionPlan?: SubscriptionPlan | undefined;
};

type AuthSession = {
  isAdmin: boolean;
  username?: string;
  accountId?: string;
  role?: AccessRole;
  passwordGraceUntil?: number;
  isVisitor?: boolean;
};

type WrongPasswordLock = { username: SubscriptionPlan; expiresAt: number };
export type SubscriptionState = {
  authLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string | null;
  role: AccessRole | null;
  permissions: ManagedPermissions;
  email: string | null;
  accountId: string | null;
  postoId: string | null;
  currentAccount: PublicLocalAccount | null;
  managedUsers: PublicLocalAccount[];
  requiresConsent: boolean;
  trialRemainingMs: number | null;
  subscriptionStartDate: string | null;
  subscriptionExpiryDate: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  daysRemaining: number;
  daysUntilBlock: number;
  needsPayment: boolean;
  isBlocked: boolean;
  visitorExpired: boolean;
  authError: string | null;
  passwordGraceSeconds: number;
  loginUser: (username: string, password: string) => boolean;
  loginAdmin: (password: string) => boolean;
  registerVisitor: (input: { nome: string; email: string; senha: string }) => boolean;
  acceptConsent: (readAt?: string) => boolean;
  revokeConsent: () => boolean;
  createManagedUser: (input: ManagedUserInput) => boolean;
  updateManagedUser: (userId: string, input: ManagedUserInput) => boolean;
  updateUserPermissions: (userId: string, permissions: ManagedPermissions) => boolean;
  deleteManagedUser: (userId: string) => boolean;
  returnToLogin: () => void;
  changePassword: (currentPassword: string, nextPassword: string) => boolean;
  logout: () => Promise<void>;
};

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDay(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
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

export function getPersistedRole(): AccessRole | null {
  const persisted = readJson<AuthSession>(AUTH_STORAGE_KEY);
  if (persisted?.role) return persisted.role;
  const plan = persisted?.username?.toLocaleLowerCase("pt-BR") as SubscriptionPlan | undefined;
  if (!plan || !SUBSCRIPTION_PLANS.includes(plan)) return null;
  const roleByPlan: Record<SubscriptionPlan, Exclude<AccessRole, "PROPRIETARIO">> = {
    "troca-oleo": "TROCA-OLEO",
    frentista: "FRENTISTA",
    gerente: "GERENTE",
  };
  return roleByPlan[plan];
}

function subscriptionFromStorage(): StoredSubscription {
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

function getPlanPassword(plan: SubscriptionPlan) {
  const key = `posto-password-${plan}`;
  const storedPassword = window.localStorage.getItem(key);
  if (!storedPassword || storedPassword.toLocaleUpperCase("pt-BR") === "POSTO10") {
    const defaultPassword = DEFAULT_PLAN_PASSWORDS[plan];
    window.localStorage.setItem(key, defaultPassword);
    return defaultPassword;
  }
  return storedPassword;
}

function storedPlan(): SubscriptionPlan {
  if (typeof window === "undefined") return "gerente";
  const plan = window.localStorage.getItem("subscriptionPlan") as SubscriptionPlan | null;
  return plan && SUBSCRIPTION_PLANS.includes(plan) ? plan : "gerente";
}

export function useSubscription(): SubscriptionState {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeAccount, setActiveAccount] = useState<ReturnType<typeof getLocalAccount>>(null);
  const [managedUsers, setManagedUsers] = useState<PublicLocalAccount[]>([]);
  const [expiredTrialAccountId, setExpiredTrialAccountId] = useState<string | null>(null);
  const [storedSubscription, setStoredSubscription] = useState<StoredSubscription>({});
  const [today, setToday] = useState(todayKey());
  const [clock, setClock] = useState(Date.now());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    try {
      ensureDemoOwner();
      setStoredSubscription(subscriptionFromStorage());
      const localSession = readJson<AuthSession>(AUTH_STORAGE_KEY);
      if (localSession?.isAdmin || window.localStorage.getItem("isAdmin") === "true") {
        setSession(localSession?.isAdmin ? localSession : { isAdmin: true });
        return;
      }
      if (localSession?.accountId) {
        const account = getLocalAccount(localSession.accountId);
        if (account) {
          const restoredSession = { ...localSession, role: account.perfil };
          setSession(restoredSession);
          setActiveAccount(account);
          setManagedUsers(listManagedUsers(account.postoId));
          return;
        }
      }
      if (localSession?.isVisitor) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(VISITOR_GRANT_KEY);
      } else if (localSession?.username) {
        const plan = localSession.username.toLowerCase() as SubscriptionPlan;
        if (SUBSCRIPTION_PLANS.includes(plan)) {
          const roleByPlan: Record<SubscriptionPlan, Exclude<AccessRole, "PROPRIETARIO">> = {
            "troca-oleo": "TROCA-OLEO",
            frentista: "FRENTISTA",
            gerente: "GERENTE",
          };
          const account = ensureLegacyAccount(roleByPlan[plan], getPlanPassword(plan));
          const migratedSession = {
            ...localSession,
            username: account.email,
            accountId: account.id,
            role: account.perfil,
          };
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(migratedSession));
          setSession(migratedSession);
          setActiveAccount(account);
          setManagedUsers(listManagedUsers(account.postoId));
        }
      } else if (localSession) {
        setSession(localSession);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "NÃO FOI POSSÍVEL CARREGAR O ACESSO.");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncSession = () => {
      try {
        const nextSession = readJson<AuthSession>(AUTH_STORAGE_KEY);
        if (!nextSession) {
          setSession(null);
          setActiveAccount(null);
          setManagedUsers([]);
          setExpiredTrialAccountId(null);
          return;
        }
        if (nextSession.isAdmin) {
          setSession(nextSession);
          setActiveAccount(null);
          setManagedUsers([]);
          return;
        }
        const account = nextSession.accountId ? getLocalAccount(nextSession.accountId) : null;
        if (!account) {
          setSession(null);
          setActiveAccount(null);
          setManagedUsers([]);
          return;
        }
        setSession({ ...nextSession, role: account.perfil });
        setActiveAccount(account);
        setManagedUsers(listManagedUsers(account.postoId));
        setExpiredTrialAccountId(null);
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "NÃO FOI POSSÍVEL ATUALIZAR A SESSÃO.",
        );
      }
    };
    const syncStoredAccounts = (event: StorageEvent) => {
      if (event.key === LOCAL_ACCOUNTS_STORAGE_KEY) syncSession();
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession);
    window.addEventListener("posto-local-accounts-changed", syncSession);
    window.addEventListener("storage", syncStoredAccounts);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession);
      window.removeEventListener("posto-local-accounts-changed", syncSession);
      window.removeEventListener("storage", syncStoredAccounts);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(todayKey());
      setClock(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.passwordGraceUntil || clock < session.passwordGraceUntil) return;
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
    setActiveAccount(null);
    setAuthError("Tempo temporário encerrado. Entre novamente com a senha correta.");
  }, [clock, session]);

  useEffect(() => {
    if (!session?.isVisitor || !activeAccount?.trial_fim) return;
    if (clock <= new Date(activeAccount.trial_fim).getTime()) return;
    const updated = updateTrialStatus(activeAccount.id, clock);
    if (updated) setActiveAccount(updated);
    setExpiredTrialAccountId(activeAccount.id);
  }, [activeAccount, clock, session]);

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

  const loginAdmin = (password: string) => {
    if (password.toLocaleUpperCase("pt-BR") !== ADMIN_PASSWORD.toLocaleUpperCase("pt-BR"))
      return false;
    const next = { isAdmin: true } satisfies AuthSession;
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem("isAdmin", "true");
    setAuthError(null);
    setActiveAccount(null);
    setExpiredTrialAccountId(null);
    setSession(next);
    notifyAuthSessionChanged();
    return true;
  };

  const loginUser = (username: string, password: string) => {
    const normalizedUsername = username.trim().toLocaleLowerCase("pt-BR") as SubscriptionPlan;
    const account = authenticateLocalAccount(username, password);
    if (account) {
      if (account.billingStatus === "CANCELADO" || account.billingStatus === "BLOQUEADO") {
        setAuthError(
          account.billingStatus === "CANCELADO"
            ? "ASSINATURA CANCELADA. REATIVE PARA CONTINUAR."
            : "ACESSO BLOQUEADO. ENTRE EM CONTATO COM O ADMINISTRADOR.",
        );
        return false;
      }
      if (
        account.billingStatus === "ATRASADO" &&
        account.dataProximoVencimento &&
        Date.now() > new Date(account.dataProximoVencimento).getTime() + 5 * 24 * 60 * 60 * 1000
      ) {
        setAuthError("PRAZO DE REGULARIZAÇÃO ENCERRADO. REGULARIZE O PAGAMENTO PARA CONTINUAR.");
        return false;
      }
      if (
        account.tipo_acesso === "TRIAL_48H" &&
        account.trial_fim &&
        Date.now() > new Date(account.trial_fim).getTime()
      ) {
        updateTrialStatus(account.id);
        setExpiredTrialAccountId(account.id);
        setAuthError(null);
        return false;
      }

      const nextSession: AuthSession = {
        isAdmin: false,
        username: account.email,
        accountId: account.id,
        role: account.perfil,
        isVisitor: account.tipo_acesso === "TRIAL_48H",
      };
      recordAccountLogin(account.id);
      const nextSubscription = {
        ...subscriptionFromStorage(),
        subscriptionPlan: "gerente" as const,
      };
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(nextSubscription));
      window.localStorage.setItem("subscriptionPlan", "gerente");
      setStoredSubscription(nextSubscription);
      setActiveAccount(account);
      setManagedUsers(listManagedUsers(account.postoId));
      setExpiredTrialAccountId(null);
      setAuthError(null);
      setSession(nextSession);
      notifyAuthSessionChanged();
      return true;
    }

    if (!SUBSCRIPTION_PLANS.includes(normalizedUsername)) {
      setAuthError("INFORME O E-MAIL CADASTRADO OU UM PERFIL LEGADO VÁLIDO.");
      return false;
    }
    const wrongLock = readJson<WrongPasswordLock>(WRONG_PASSWORD_LOCK_KEY);
    if (wrongLock && wrongLock.username !== normalizedUsername) {
      setAuthError(
        "O acesso está bloqueado. Digite a senha correta do usuário que iniciou a sessão temporária.",
      );
      return false;
    }

    const expectedPassword = getPlanPassword(normalizedUsername);
    const passwordMatches =
      password.toLocaleUpperCase("pt-BR") === expectedPassword.toLocaleUpperCase("pt-BR");
    if (!passwordMatches && (wrongLock?.expiresAt ?? 0) <= Date.now() && wrongLock) {
      setAuthError(
        "Os 5 minutos de acesso temporário terminaram. Digite a senha correta para entrar.",
      );
      return false;
    }
    if (!passwordMatches && calculated.status === "expired") {
      setAuthError("A assinatura está bloqueada. Solicite a renovação pelo WhatsApp.");
      return false;
    }

    const roleByPlan: Record<SubscriptionPlan, Exclude<AccessRole, "PROPRIETARIO">> = {
      "troca-oleo": "TROCA-OLEO",
      frentista: "FRENTISTA",
      gerente: "GERENTE",
    };
    const legacyAccount = ensureLegacyAccount(roleByPlan[normalizedUsername], expectedPassword);
    let nextSession: AuthSession;
    if (passwordMatches) {
      window.localStorage.removeItem(WRONG_PASSWORD_LOCK_KEY);
      setAuthError(null);
      nextSession = {
        isAdmin: false,
        username: legacyAccount.email,
        accountId: legacyAccount.id,
        role: legacyAccount.perfil,
      };
    } else {
      const expiresAt = wrongLock?.expiresAt ?? Date.now() + PASSWORD_GRACE_MS;
      const lock = { username: normalizedUsername, expiresAt } satisfies WrongPasswordLock;
      window.localStorage.setItem(WRONG_PASSWORD_LOCK_KEY, JSON.stringify(lock));
      setAuthError(null);
      nextSession = {
        isAdmin: false,
        username: legacyAccount.email,
        accountId: legacyAccount.id,
        role: legacyAccount.perfil,
        passwordGraceUntil: expiresAt,
      };
    }

    const nextSubscription = { ...subscriptionFromStorage(), subscriptionPlan: normalizedUsername };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(nextSubscription));
    window.localStorage.setItem("subscriptionPlan", normalizedUsername);
    setStoredSubscription(nextSubscription);
    setActiveAccount(legacyAccount);
    setManagedUsers(listManagedUsers(legacyAccount.postoId));
    setExpiredTrialAccountId(null);
    setSession(nextSession);
    notifyAuthSessionChanged();
    return true;
  };

  const registerVisitor = (input: { nome: string; email: string; senha: string }) => {
    try {
      const account = registerTrialAccount(input);
      const nextSession: AuthSession = {
        isAdmin: false,
        username: account.email,
        accountId: account.id,
        role: account.perfil,
        isVisitor: true,
      };
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      window.localStorage.setItem("subscriptionPlan", "gerente");
      const nextSubscription = {
        ...subscriptionFromStorage(),
        subscriptionPlan: "gerente" as const,
      };
      window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(nextSubscription));
      setStoredSubscription(nextSubscription);
      setActiveAccount(account);
      setManagedUsers([]);
      setExpiredTrialAccountId(null);
      setSession(nextSession);
      setAuthError(null);
      notifyAuthSessionChanged();
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "NÃO FOI POSSÍVEL CRIAR O TESTE.");
      return false;
    }
  };

  const acceptConsent = (readAt?: string) => {
    if (!activeAccount || !session) return false;
    try {
      const updated = acceptLocalConsent(activeAccount.id, readAt);
      setActiveAccount(updated);
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "NÃO FOI POSSÍVEL GRAVAR O CONSENTIMENTO.",
      );
      return false;
    }
  };

  const revokeConsent = () => {
    if (!activeAccount || !session) return false;
    try {
      revokeLocalConsent(activeAccount.id);
      returnToLogin();
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "NÃO FOI POSSÍVEL REVOGAR O CONSENTIMENTO.",
      );
      return false;
    }
  };

  const refreshManagedUsers = () => {
    if (activeAccount) setManagedUsers(listManagedUsers(activeAccount.postoId));
  };

  const createManagedUser = (input: ManagedUserInput) => {
    if (session?.role !== "PROPRIETARIO" || !activeAccount) return false;
    try {
      saveManagedUser(activeAccount.postoId, input);
      refreshManagedUsers();
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "NÃO FOI POSSÍVEL CRIAR O USUÁRIO.");
      return false;
    }
  };

  const updateManagedUser = (userId: string, input: ManagedUserInput) => {
    if (session?.role !== "PROPRIETARIO" || !activeAccount) return false;
    try {
      saveManagedUser(activeAccount.postoId, input, userId);
      refreshManagedUsers();
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "NÃO FOI POSSÍVEL ATUALIZAR O USUÁRIO.",
      );
      return false;
    }
  };

  const updateUserPermissions = (userId: string, permissions: ManagedPermissions) => {
    if (session?.role !== "PROPRIETARIO" || !activeAccount) return false;
    try {
      updateStoredManagedPermissions(activeAccount.postoId, userId, permissions);
      refreshManagedUsers();
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "NÃO FOI POSSÍVEL SALVAR AS PERMISSÕES.",
      );
      return false;
    }
  };

  const deleteManagedUser = (userId: string) => {
    if (session?.role !== "PROPRIETARIO" || !activeAccount) return false;
    try {
      deleteStoredManagedUser(activeAccount.postoId, userId);
      refreshManagedUsers();
      setAuthError(null);
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "NÃO FOI POSSÍVEL EXCLUIR O USUÁRIO.");
      return false;
    }
  };

  const returnToLogin = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem("isAdmin");
    setSession(null);
    setActiveAccount(null);
    setManagedUsers([]);
    setExpiredTrialAccountId(null);
    setAuthError(null);
    notifyAuthSessionChanged();
  };

  const changePassword = (currentPassword: string, nextPassword: string) => {
    if (session?.accountId) {
      try {
        const updated = updateLocalPassword(session.accountId, currentPassword, nextPassword);
        if (!updated) return false;
        if (updated.id.startsWith("legacy-") && updated.perfil !== "PROPRIETARIO") {
          const legacyPlan: Record<Exclude<AccessRole, "PROPRIETARIO">, SubscriptionPlan> = {
            GERENTE: "gerente",
            FRENTISTA: "frentista",
            "TROCA-OLEO": "troca-oleo",
          };
          window.localStorage.setItem(
            `posto-password-${legacyPlan[updated.perfil]}`,
            nextPassword.toLocaleUpperCase("pt-BR"),
          );
        }
        setActiveAccount(updated);
        return true;
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "NÃO FOI POSSÍVEL ALTERAR A SENHA.");
        return false;
      }
    }
    const username = session?.username as SubscriptionPlan | undefined;
    if (!username || !nextPassword.trim()) return false;
    const passwordKey = `posto-password-${username}`;
    const storedPassword = getPlanPassword(username);
    if (currentPassword.toLocaleUpperCase("pt-BR") !== storedPassword.toLocaleUpperCase("pt-BR"))
      return false;
    window.localStorage.setItem(passwordKey, nextPassword.toLocaleUpperCase("pt-BR"));
    return true;
  };

  const logout = async () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem("isAdmin");
    setSession(null);
    setActiveAccount(null);
    setManagedUsers([]);
    setExpiredTrialAccountId(null);
    notifyAuthSessionChanged();
  };

  const consentDate = activeAccount?.lgpd_data_hora
    ? new Date(activeAccount.lgpd_data_hora).getTime()
    : null;
  const revokedDate = activeAccount?.lgpd_revogado_data_hora
    ? new Date(activeAccount.lgpd_revogado_data_hora).getTime()
    : null;
  const hasCurrentConsent = Boolean(
    activeAccount?.lgpd_aceito &&
    activeAccount.lgpd_lido &&
    activeAccount.lgpd_de_acordo &&
    activeAccount.lgpd_versao_termo === CONSENT_VERSION &&
    activeAccount.lgpd_versao === CONSENT_VERSION &&
    activeAccount.lgpd_email === activeAccount.email &&
    activeAccount.lgpd_data_hora_leitura &&
    consentDate !== null &&
    (revokedDate === null || consentDate >= revokedDate),
  );

  return {
    authLoading,
    isAuthenticated: Boolean(
      session && (!session.passwordGraceUntil || session.passwordGraceUntil > clock),
    ),
    isAdmin: session?.isAdmin ?? false,
    username: session?.username ?? null,
    role: session?.role ?? activeAccount?.perfil ?? null,
    permissions: activeAccount?.permissoes ?? {},
    email: activeAccount?.email ?? null,
    accountId: activeAccount?.id ?? null,
    postoId: activeAccount?.postoId ?? null,
    currentAccount: activeAccount ? getPublicAccount(activeAccount) : null,
    managedUsers,
    requiresConsent: Boolean(session && !session.isAdmin && activeAccount && !hasCurrentConsent),
    trialRemainingMs:
      session?.isVisitor && activeAccount?.trial_fim
        ? Math.max(0, new Date(activeAccount.trial_fim).getTime() - clock)
        : null,
    passwordGraceSeconds: session?.passwordGraceUntil
      ? Math.max(0, Math.ceil((session.passwordGraceUntil - clock) / 1000))
      : 0,
    visitorExpired: Boolean(
      expiredTrialAccountId ||
      (session?.isVisitor &&
        activeAccount?.trial_fim &&
        clock > new Date(activeAccount.trial_fim).getTime()),
    ),
    subscriptionStartDate: storedSubscription.subscriptionStartDate ?? null,
    subscriptionExpiryDate: storedSubscription.subscriptionExpiryDate ?? null,
    subscriptionStatus: calculated.status,
    subscriptionPlan: storedSubscription.subscriptionPlan ?? "gerente",
    daysRemaining: calculated.daysRemaining,
    daysUntilBlock: calculated.daysUntilBlock,
    needsPayment: false,
    isBlocked: false,
    authError,
    loginUser,
    loginAdmin,
    registerVisitor,
    acceptConsent,
    revokeConsent,
    createManagedUser,
    updateManagedUser,
    updateUserPermissions,
    deleteManagedUser,
    returnToLogin,
    changePassword,
    logout,
  };
}
