import { saasPlanPrice } from "@/lib/saas-checkout";

export type AccessRole = "PROPRIETARIO" | "GERENTE" | "FRENTISTA" | "TROCA-OLEO";

export const OWNER_MENU_PERMISSIONS = [
  { path: "/fiscalizacao", label: "FISCALIZAÇÃO" },
  { path: "/fechamento-caixa", label: "FECHAMENTO CAIXA" },
  { path: "/troca-oleo", label: "TROCA DE ÓLEO" },
  { path: "/metas", label: "METAS" },
  { path: "/aniversariantes", label: "ANIVERSARIANTES" },
  { path: "/backup", label: "BACKUP" },
  { path: "/configuracoes", label: "AJUSTES" },
  { path: "/ajuda", label: "AJUDA" },
  { path: "/usuarios", label: "USUÁRIOS DO POSTO" },
] as const;

export type ManagedMenuPath = (typeof OWNER_MENU_PERMISSIONS)[number]["path"];
export type ManagedPermissions = Partial<Record<ManagedMenuPath, boolean>>;

export type ConsentRecord = {
  lgpd_aceito: boolean;
  lgpd_data_hora: string | null;
  lgpd_versao_termo: string | null;
  lgpd_email_usuario: string;
  lgpd_ip: string | null;
  lgpd_revogado_data_hora: string | null;
  lgpd_lido: boolean;
  lgpd_de_acordo: boolean;
  lgpd_data_hora_leitura: string | null;
  lgpd_versao: string | null;
  lgpd_email: string;
};

export type BillingPlan = "TRIAL_48H" | "MENSAL" | "ANUAL";
export type BillingStatus = "ATIVO" | "TRIAL" | "ATRASADO" | "CANCELADO" | "BLOQUEADO";
export type LocalPaymentRecord = {
  date: string;
  method: "PIX" | "CARTÃO";
  amount: number;
  status: "CONFIRMADO" | "PENDENTE" | "ATRASADO";
};

export type LocalAccount = ConsentRecord & {
  id: string;
  nome: string;
  email: string;
  perfil: AccessRole;
  senha: string;
  postoId: string;
  permissoes: ManagedPermissions;
  tipo_acesso: "PAGO" | "TRIAL_48H";
  status: "ATIVO" | "EXPIRADO";
  trial_inicio: string | null;
  trial_fim: string | null;
  criado_em: string;
  postoNome?: string;
  telefone?: string;
  cnpj?: string;
  plano?: BillingPlan;
  billingStatus?: BillingStatus;
  dataProximoVencimento?: string | null;
  ultimoPagamento?: string | null;
  formaPagamento?: "PIX" | "CARTÃO" | null;
  valorPagamento?: number | null;
  ultimoLogin?: string | null;
  pagamentos?: LocalPaymentRecord[];
  historicoAcessos?: string[];
  isDemoRecord?: boolean;
};

export type PublicLocalAccount = Omit<LocalAccount, "senha">;

export type ManagedUserInput = {
  nome: string;
  email: string;
  perfil: Exclude<AccessRole, "PROPRIETARIO">;
  senha: string;
  permissoes: ManagedPermissions;
};

const MANAGER_DEFAULT_PERMISSIONS: ManagedPermissions = {
  "/fiscalizacao": true,
  "/fechamento-caixa": true,
  "/troca-oleo": true,
  "/metas": true,
  "/aniversariantes": true,
  "/backup": true,
  "/configuracoes": true,
  "/ajuda": true,
  "/usuarios": false,
};
const STAFF_DEFAULT_PERMISSIONS: Record<"FRENTISTA" | "TROCA-OLEO", ManagedPermissions> = {
  FRENTISTA: { "/fechamento-caixa": true, "/fiscalizacao": true },
  "TROCA-OLEO": { "/troca-oleo": true, "/fiscalizacao": true },
};

export function defaultManagedPermissions(role: ManagedUserInput["perfil"]): ManagedPermissions {
  return role === "GERENTE"
    ? { ...MANAGER_DEFAULT_PERMISSIONS }
    : { ...STAFF_DEFAULT_PERMISSIONS[role] };
}

export function roleAllows(
  role: AccessRole | null,
  path: string,
  permissions?: ManagedPermissions,
) {
  if (!role) return false;
  if (path === "/pagamentos") return role === "PROPRIETARIO";
  if (path === "/lgpd") return true;
  if (role === "PROPRIETARIO") return true;
  const menuPath =
    OWNER_MENU_PERMISSIONS.find(
      ({ path: candidate }) => path === candidate || path.startsWith(`${candidate}/`),
    )?.path ??
    (path === "/configuracoes-precos" || path === "/configuracoes-formas-pagamento"
      ? "/configuracoes"
      : undefined);
  if (menuPath) {
    const granted =
      permissions && menuPath in permissions
        ? permissions[menuPath]
        : defaultManagedPermissions(role)[menuPath];
    return granted === true;
  }
  return role === "GERENTE";
}

export const LOCAL_ACCOUNTS_STORAGE_KEY = "posto10-local-accounts";
export const CONSENT_VERSION = "v1.0 - 08/11/2026";
export const TRIAL_DURATION_MS = 48 * 60 * 60 * 1000;
const DEMO_OWNER_EMAIL = "proprietario@teste.com";
const LEGACY_OWNER_EMAIL = "dono@teste.com";

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("pt-BR");
}

function readAccounts(): LocalAccount[] {
  const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("O cadastro local de usuários está inválido.");
    }
    return parsed.map((value: unknown) => {
      const entry = value as LocalAccount;
      const perfil = (entry.perfil as string) === "DONO" ? "PROPRIETARIO" : entry.perfil;
      const managedRole =
        perfil === "GERENTE" || perfil === "FRENTISTA" || perfil === "TROCA-OLEO" ? perfil : null;
      return {
        ...entry,
        perfil,
        permissoes: entry.permissoes ?? (managedRole ? defaultManagedPermissions(managedRole) : {}),
        lgpd_aceito: entry.lgpd_aceito ?? false,
        lgpd_data_hora: entry.lgpd_data_hora ?? null,
        lgpd_versao_termo: entry.lgpd_versao_termo ?? null,
        lgpd_email_usuario: entry.lgpd_email_usuario ?? entry.email,
        lgpd_ip: entry.lgpd_ip ?? null,
        lgpd_revogado_data_hora: entry.lgpd_revogado_data_hora ?? null,
        lgpd_lido: entry.lgpd_lido ?? entry.lgpd_aceito ?? false,
        lgpd_de_acordo: entry.lgpd_de_acordo ?? entry.lgpd_aceito ?? false,
        lgpd_data_hora_leitura: entry.lgpd_data_hora_leitura ?? entry.lgpd_data_hora ?? null,
        lgpd_versao: entry.lgpd_versao ?? entry.lgpd_versao_termo ?? null,
        lgpd_email: entry.lgpd_email ?? entry.lgpd_email_usuario ?? entry.email,
      };
    }) as LocalAccount[];
  } catch (error) {
    throw new Error("Não foi possível ler o cadastro local de usuários.", { cause: error });
  }
}

function saveAccounts(accounts: LocalAccount[]) {
  window.localStorage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new Event("posto-local-accounts-changed"));
}

function createAccount(
  input: Omit<LocalAccount, keyof ConsentRecord | "criado_em" | "permissoes"> & {
    permissoes?: ManagedPermissions;
    criado_em?: string;
  },
): LocalAccount {
  return {
    ...input,
    perfil: (input.perfil as string) === "DONO" ? "PROPRIETARIO" : input.perfil,
    permissoes:
      input.permissoes ??
      (input.perfil === "PROPRIETARIO"
        ? {}
        : defaultManagedPermissions(input.perfil as ManagedUserInput["perfil"])),
    criado_em: input.criado_em ?? new Date().toISOString(),
    lgpd_aceito: false,
    lgpd_data_hora: null,
    lgpd_versao_termo: null,
    lgpd_email_usuario: input.email,
    lgpd_ip: null,
    lgpd_revogado_data_hora: null,
    lgpd_lido: false,
    lgpd_de_acordo: false,
    lgpd_data_hora_leitura: null,
    lgpd_versao: null,
    lgpd_email: input.email,
  };
}

export function ensureDemoOwner() {
  const accounts = readAccounts();
  let canonical = accounts.find(
    (account) =>
      account.id === "posto10-demo-owner" ||
      normalizeEmail(account.email) === DEMO_OWNER_EMAIL ||
      normalizeEmail(account.email) === LEGACY_OWNER_EMAIL,
  );
  if (!canonical) {
    canonical = createAccount({
      id: "posto10-demo-owner",
      nome: "PROPRIETÁRIO DE TESTE",
      email: DEMO_OWNER_EMAIL,
      perfil: "PROPRIETARIO",
      senha: "123456",
      postoId: "posto10-demo",
      tipo_acesso: "PAGO",
      status: "ATIVO",
      trial_inicio: null,
      trial_fim: null,
    });
    accounts.push(canonical);
  } else {
    canonical.email = DEMO_OWNER_EMAIL;
    canonical.nome = "PROPRIETÁRIO DE TESTE";
    canonical.perfil = "PROPRIETARIO";
    canonical.postoId = "posto10-demo";
    canonical.tipo_acesso = "PAGO";
    canonical.status = "ATIVO";
    canonical.trial_inicio = null;
    canonical.trial_fim = null;
    canonical.lgpd_email = DEMO_OWNER_EMAIL;
    canonical.lgpd_email_usuario = DEMO_OWNER_EMAIL;
  }
  if (!accounts.some((account) => normalizeEmail(account.email) === LEGACY_OWNER_EMAIL)) {
    accounts.push(
      createAccount({
        id: "posto10-demo-owner-legacy",
        nome: "PROPRIETÁRIO DE TESTE",
        email: LEGACY_OWNER_EMAIL,
        perfil: "PROPRIETARIO",
        senha: "123456",
        postoId: canonical.postoId,
        tipo_acesso: "PAGO",
        status: "ATIVO",
        trial_inicio: null,
        trial_fim: null,
      }),
    );
  }
  saveAccounts(accounts);
}

export function ensureLegacyAccount(perfil: Exclude<AccessRole, "PROPRIETARIO">, senha: string) {
  const accounts = readAccounts();
  const email = `${perfil.toLocaleLowerCase("pt-BR")}@posto10.local`;
  const existing = accounts.find((account) => normalizeEmail(account.email) === email);
  if (existing) return existing;
  const account = createAccount({
    id: `legacy-${perfil.toLocaleLowerCase("pt-BR")}`,
    nome: perfil,
    email,
    perfil,
    senha: senha.toLocaleUpperCase("pt-BR"),
    postoId: "posto10-demo",
    tipo_acesso: "PAGO",
    status: "ATIVO",
    trial_inicio: null,
    trial_fim: null,
  });
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

export function getLocalAccounts() {
  return readAccounts();
}

export function getLocalAccount(accountId: string) {
  return readAccounts().find((account) => account.id === accountId) ?? null;
}

export function getPublicAccount(account: LocalAccount): PublicLocalAccount {
  const { senha: _senha, ...publicAccount } = account;
  return publicAccount;
}

export function authenticateLocalAccount(identifier: string, password: string) {
  const normalizedIdentifier = normalizeEmail(identifier);
  const accounts = readAccounts();
  let account = accounts.find(
    (candidate) => normalizeEmail(candidate.email) === normalizedIdentifier,
  );
  if (!account && normalizedIdentifier === "proprietario") {
    const demoOwner = accounts.find((candidate) => candidate.id === "posto10-demo-owner");
    if (demoOwner) account = demoOwner;
  }
  if (!account || account.senha !== password.toLocaleUpperCase("pt-BR")) return null;
  return account;
}

export function registerTrialAccount(input: { nome: string; email: string; senha: string }) {
  const nome = input.nome.trim();
  const email = normalizeEmail(input.email);
  const senha = input.senha.trim().toLocaleUpperCase("pt-BR");
  if (!nome || !email || !senha) throw new Error("INFORME NOME, E-MAIL E SENHA.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("INFORME UM E-MAIL VÁLIDO.");
  }
  if (senha.length < 6) throw new Error("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");

  const accounts = readAccounts();
  if (accounts.some((account) => normalizeEmail(account.email) === email)) {
    throw new Error("JÁ EXISTE UM CADASTRO COM ESTE E-MAIL. ENTRE COM SUA CONTA.");
  }

  const startedAt = new Date();
  const id = `trial-${crypto.randomUUID()}`;
  const account = createAccount({
    id,
    nome,
    email,
    perfil: "PROPRIETARIO",
    senha,
    postoId: id,
    tipo_acesso: "TRIAL_48H",
    status: "ATIVO",
    trial_inicio: startedAt.toISOString(),
    trial_fim: new Date(startedAt.getTime() + TRIAL_DURATION_MS).toISOString(),
    plano: "TRIAL_48H",
    billingStatus: "TRIAL",
    dataProximoVencimento: new Date(startedAt.getTime() + TRIAL_DURATION_MS).toISOString(),
    ultimoLogin: startedAt.toISOString(),
    historicoAcessos: [startedAt.toISOString()],
  });
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

export type PaidOwnerSignup = {
  postoNome: string;
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  senha: string;
  plano: Exclude<BillingPlan, "TRIAL_48H">;
};

export function createPaidDemoAccount(input: PaidOwnerSignup, paymentMethod: "PIX" | "CARTÃO") {
  const postoNome = input.postoNome.trim();
  const nome = input.nome.trim();
  const email = normalizeEmail(input.email);
  const telefone = input.telefone.trim();
  const cnpj = input.cnpj.replace(/\D/g, "");
  const senha = input.senha.trim().toLocaleUpperCase("pt-BR");
  if (!postoNome || !nome || !telefone || !cnpj || !email || !senha) {
    throw new Error("PREENCHA TODOS OS CAMPOS DO CADASTRO.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INFORME UM E-MAIL VÁLIDO.");
  if (senha.length < 6) throw new Error("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");
  const accounts = readAccounts();
  const now = new Date();
  const days = input.plano === "ANUAL" ? 365 : 30;
  const amount = saasPlanPrice(input.plano);
  const due = new Date(now);
  due.setDate(due.getDate() + days);
  const existing = accounts.find((account) => normalizeEmail(account.email) === email);
  if (existing) {
    const canReactivate =
      existing.billingStatus === "CANCELADO" ||
      existing.billingStatus === "ATRASADO" ||
      existing.status === "EXPIRADO";
    if (!canReactivate || existing.senha !== senha) {
      throw new Error(
        "JÁ EXISTE UM CADASTRO COM ESTE E-MAIL. INFORME AS CREDENCIAIS DA CONTA PARA REATIVAR.",
      );
    }
    const reactivated: LocalAccount = {
      ...existing,
      nome,
      postoNome,
      telefone,
      cnpj,
      tipo_acesso: "PAGO",
      status: "ATIVO",
      plano: input.plano,
      billingStatus: "ATIVO",
      dataProximoVencimento: due.toISOString(),
      ultimoPagamento: now.toISOString(),
      formaPagamento: paymentMethod,
      valorPagamento: amount,
      pagamentos: [
        ...(existing.pagamentos ?? []),
        { date: now.toISOString(), method: paymentMethod, amount, status: "CONFIRMADO" },
      ],
      trial_inicio: null,
      trial_fim: null,
    };
    saveAccounts(accounts.map((account) => (account.id === existing.id ? reactivated : account)));
    return reactivated;
  }
  const id = `paid-demo-${crypto.randomUUID()}`;
  const account = createAccount({
    id,
    nome,
    email,
    perfil: "PROPRIETARIO",
    senha,
    postoId: id,
    postoNome,
    telefone,
    cnpj,
    tipo_acesso: "PAGO",
    status: "ATIVO",
    plano: input.plano,
    billingStatus: "ATIVO",
    dataProximoVencimento: due.toISOString(),
    ultimoPagamento: now.toISOString(),
    formaPagamento: paymentMethod,
    valorPagamento: amount,
    pagamentos: [{ date: now.toISOString(), method: paymentMethod, amount, status: "CONFIRMADO" }],
    ultimoLogin: null,
    historicoAcessos: [],
    trial_inicio: null,
    trial_fim: null,
  });
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

export function updateLocalBilling(
  accountId: string,
  update: Partial<
    Pick<
      LocalAccount,
      | "billingStatus"
      | "dataProximoVencimento"
      | "ultimoPagamento"
      | "formaPagamento"
      | "valorPagamento"
      | "pagamentos"
      | "historicoAcessos"
      | "ultimoLogin"
      | "trial_fim"
      | "status"
      | "plano"
      | "tipo_acesso"
    >
  >,
) {
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw new Error("POSTO NÃO ENCONTRADO.");
  const updated = { ...account, ...update };
  saveAccounts(accounts.map((candidate) => (candidate.id === accountId ? updated : candidate)));
  return updated;
}

export function ensureDeveloperDemoAccounts() {
  const accounts = readAccounts();
  const now = new Date();
  const trialId = "posto10-dev-demo-trial";
  const paidId = "posto10-dev-demo-paid";
  if (!accounts.some((account) => account.id === trialId)) {
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    accounts.push(
      createAccount({
        id: trialId,
        nome: "PROPRIETÁRIO DEMO TRIAL",
        email: "trial.demo@posto10.local",
        perfil: "PROPRIETARIO",
        senha: "DEMO123",
        postoId: trialId,
        postoNome: "POSTO DEMO TRIAL",
        telefone: "(11) 99999-1111",
        cnpj: "00000000000191",
        tipo_acesso: "TRIAL_48H",
        status: "ATIVO",
        plano: "TRIAL_48H",
        billingStatus: "TRIAL",
        trial_inicio: start.toISOString(),
        trial_fim: new Date(start.getTime() + TRIAL_DURATION_MS).toISOString(),
        dataProximoVencimento: new Date(start.getTime() + TRIAL_DURATION_MS).toISOString(),
      }),
    );
  }
  if (!accounts.some((account) => account.id === paidId)) {
    const due = new Date(now);
    due.setDate(due.getDate() + 30);
    accounts.push(
      createAccount({
        id: paidId,
        nome: "PROPRIETÁRIO DEMO PAGO",
        email: "pago.demo@posto10.local",
        perfil: "PROPRIETARIO",
        senha: "DEMO123",
        postoId: paidId,
        postoNome: "POSTO DEMO PAGO",
        telefone: "(11) 99999-2222",
        cnpj: "00000000000272",
        tipo_acesso: "PAGO",
        status: "ATIVO",
        plano: "MENSAL",
        billingStatus: "ATIVO",
        dataProximoVencimento: due.toISOString(),
        ultimoPagamento: now.toISOString(),
        formaPagamento: "PIX",
        valorPagamento: saasPlanPrice("MENSAL"),
        pagamentos: [
          {
            date: now.toISOString(),
            method: "PIX",
            amount: saasPlanPrice("MENSAL"),
            status: "CONFIRMADO",
          },
        ],
        trial_inicio: null,
        trial_fim: null,
      }),
    );
  }
  const demoPaidIndex = accounts.findIndex((account) => account.id === paidId);
  const demoPaidAccount = accounts[demoPaidIndex];
  if (demoPaidAccount && demoPaidAccount.plano === "MENSAL") {
    const updatedDemoPaid: LocalAccount = {
      ...demoPaidAccount,
      valorPagamento: saasPlanPrice("MENSAL"),
      pagamentos: (demoPaidAccount.pagamentos ?? []).map((payment) => ({
        ...payment,
        amount: saasPlanPrice("MENSAL"),
      })),
    };
    accounts[demoPaidIndex] = updatedDemoPaid;
  }
  saveAccounts(accounts);
}

export function recordAccountLogin(accountId: string) {
  const account = getLocalAccount(accountId);
  if (!account) return;
  const now = new Date().toISOString();
  updateLocalBilling(accountId, {
    ultimoLogin: now,
    historicoAcessos: [...(account.historicoAcessos ?? []), now],
  });
}

export function listManagedUsers(postoId: string): PublicLocalAccount[] {
  return readAccounts()
    .filter(
      (account) =>
        account.postoId === postoId &&
        account.perfil !== "PROPRIETARIO" &&
        !account.id.startsWith("legacy-"),
    )
    .map(getPublicAccount);
}

export function saveManagedUser(postoId: string, input: ManagedUserInput, userId?: string) {
  const nome = input.nome.trim();
  const email = normalizeEmail(input.email);
  const senha = input.senha.trim().toLocaleUpperCase("pt-BR");
  if (!nome || !email) throw new Error("INFORME NOME E E-MAIL.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("INFORME UM E-MAIL VÁLIDO.");
  }

  const accounts = readAccounts();
  const existing = userId ? accounts.find((account) => account.id === userId) : null;
  if (userId && (!existing || existing.postoId !== postoId || existing.perfil === "PROPRIETARIO")) {
    throw new Error("USUÁRIO NÃO ENCONTRADO NO POSTO ATUAL.");
  }
  if (
    accounts.some((account) => account.id !== userId && normalizeEmail(account.email) === email)
  ) {
    throw new Error("JÁ EXISTE UM USUÁRIO COM ESTE E-MAIL.");
  }
  if (!existing && senha.length < 6) {
    throw new Error("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");
  }
  if (existing && senha && senha.length < 6) {
    throw new Error("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");
  }

  const account = existing
    ? {
        ...existing,
        nome,
        email,
        perfil: input.perfil,
        senha: senha || existing.senha,
        permissoes: input.permissoes,
        lgpd_email_usuario: email,
        lgpd_email: email,
      }
    : createAccount({
        id: `user-${crypto.randomUUID()}`,
        nome,
        email,
        perfil: input.perfil,
        senha,
        permissoes: input.permissoes,
        postoId,
        tipo_acesso: "PAGO",
        status: "ATIVO",
        trial_inicio: null,
        trial_fim: null,
      });

  const nextAccounts = existing
    ? accounts.map((candidate) => (candidate.id === userId ? account : candidate))
    : [...accounts, account];
  saveAccounts(nextAccounts);
  return getPublicAccount(account);
}

export function updateManagedPermissions(
  postoId: string,
  userId: string,
  permissions: ManagedPermissions,
) {
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === userId);
  if (!account || account.postoId !== postoId || account.perfil === "PROPRIETARIO") {
    throw new Error("USUÁRIO NÃO ENCONTRADO NO POSTO ATUAL.");
  }
  const updated = { ...account, permissoes: { ...permissions } };
  saveAccounts(accounts.map((candidate) => (candidate.id === userId ? updated : candidate)));
  return getPublicAccount(updated);
}

export function deleteManagedUser(postoId: string, userId: string) {
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === userId);
  if (!account || account.postoId !== postoId || account.perfil === "PROPRIETARIO") {
    throw new Error("USUÁRIO NÃO ENCONTRADO NO POSTO ATUAL.");
  }
  saveAccounts(accounts.filter((candidate) => candidate.id !== userId));
}

export function acceptLocalConsent(accountId: string, readAt?: string) {
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw new Error("NÃO FOI POSSÍVEL LOCALIZAR A CONTA DO USUÁRIO.");
  const acceptedAt = new Date().toISOString();
  const updated: LocalAccount = {
    ...account,
    lgpd_aceito: true,
    lgpd_data_hora: acceptedAt,
    lgpd_versao_termo: CONSENT_VERSION,
    lgpd_email_usuario: account.email,
    lgpd_ip: null,
    lgpd_lido: true,
    lgpd_de_acordo: true,
    lgpd_data_hora_leitura: readAt ?? acceptedAt,
    lgpd_versao: CONSENT_VERSION,
    lgpd_email: account.email,
    lgpd_revogado_data_hora: null,
  };
  saveAccounts(accounts.map((candidate) => (candidate.id === accountId ? updated : candidate)));
  return updated;
}

export function revokeLocalConsent(accountId: string) {
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw new Error("NÃO FOI POSSÍVEL LOCALIZAR A CONTA DO USUÁRIO.");
  const updated = {
    ...account,
    lgpd_aceito: false,
    lgpd_de_acordo: false,
    lgpd_revogado_data_hora: new Date().toISOString(),
  };
  saveAccounts(accounts.map((candidate) => (candidate.id === accountId ? updated : candidate)));
  return updated;
}

export function updateLocalPassword(
  accountId: string,
  currentPassword: string,
  nextPassword: string,
) {
  const next = nextPassword.trim().toLocaleUpperCase("pt-BR");
  if (next.length < 6) throw new Error("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account || account.senha !== currentPassword.toLocaleUpperCase("pt-BR")) return false;
  const updated = { ...account, senha: next };
  saveAccounts(accounts.map((candidate) => (candidate.id === accountId ? updated : candidate)));
  return updated;
}

export function updateTrialStatus(accountId: string, now = Date.now()) {
  const accounts = readAccounts();
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account || account.tipo_acesso !== "TRIAL_48H" || !account.trial_fim) return null;
  if (now <= new Date(account.trial_fim).getTime() || account.status === "EXPIRADO") return null;
  const updated = { ...account, status: "EXPIRADO" as const };
  saveAccounts(accounts.map((candidate) => (candidate.id === accountId ? updated : candidate)));
  return updated;
}
