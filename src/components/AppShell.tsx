import { Link, useLocation } from "@tanstack/react-router";
import {
  Fuel,
  CalendarDays,
  Settings,
  DatabaseBackup,
  BarChart3,
  ShoppingBasket,
  KanbanSquare,
  Gauge,
  Truck,
  Moon,
  Sun,
  ClipboardCheck,
  BookOpenCheck,
  CircleHelp,
  Droplets,
  WalletCards,
  AlertTriangle,
  Menu,
  X,
  Trophy,
  Cake,
  Shield,
  BellRing,
  Users,
  ShieldCheck,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getPersistedRole, roleAllows, useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/lib/theme";
import { fmtL, todayISO, useAppState } from "@/lib/store";
import { calculateTankAutonomy, formatAutonomy, formatTankLiters } from "@/lib/tank-autonomy";
import {
  getDivergenceRecords,
  subscribeToDivergenceChanges,
  type TankDivergence,
} from "@/lib/divergence";
import {
  buildOwnerWhatsAppMessage,
  dailyWhatsAppAttemptKey,
  dailyWhatsAppSentKey,
  ownerWhatsAppUrl,
  readOwnerWhatsAppConfig,
} from "@/lib/whatsapp-dono";
import {
  checkDailyFiscalNotifications,
  getFiscalAlertSummary,
  useFiscalDocuments,
} from "@/lib/fiscalizacao";

type NavItem = { to: string; label: string; icon: LucideIcon; gradient: string };

const rowOne: NavItem[] = [
  {
    to: "/dashboard",
    label: "DASHBOARD",
    icon: BarChart3,
    gradient: "from-amber-500 to-orange-700",
  },
  {
    to: "/",
    label: "MEDIDAS / VENDAS DIÁRIAS",
    icon: Fuel,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    to: "/relatorios",
    label: "Relatório Vendas Combustível",
    icon: BarChart3,
    gradient: "from-sky-500 to-blue-600",
  },
  {
    to: "/recebimento",
    label: "Recebimento Combustível",
    icon: Truck,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    to: "/lmc",
    label: "Relatório LMC",
    icon: BookOpenCheck,
    gradient: "from-indigo-500 to-blue-700",
  },
  {
    to: "/afericao",
    label: "Aferição",
    icon: Gauge,
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    to: "/produtos",
    label: "CONTROLE PRODUTOS",
    icon: ShoppingBasket,
    gradient: "from-pink-500 to-rose-600",
  },
];

const rowTwo: NavItem[] = [
  {
    to: "/escala",
    label: "Escala",
    icon: CalendarDays,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    to: "/tarefas",
    label: "TAREFAS KANBAN",
    icon: KanbanSquare,
    gradient: "from-orange-500 to-amber-600",
  },
  {
    to: "/checklist",
    label: "CHECK LIST",
    icon: ClipboardCheck,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    to: "/fiscalizacao",
    label: "FISCALIZAÇÃO",
    icon: Shield,
    gradient: "from-amber-600 to-yellow-800",
  },
  {
    to: "/fechamento-caixa",
    label: "FECHAMENTO CAIXA",
    icon: WalletCards,
    gradient: "from-green-500 to-emerald-700",
  },
  {
    to: "/troca-oleo",
    label: "TROCA DE ÓLEO",
    icon: Droplets,
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    to: "/metas",
    label: "METAS",
    icon: Trophy,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    to: "/aniversariantes",
    label: "ANIVERSARIANTES",
    icon: Cake,
    gradient: "from-pink-500 to-fuchsia-600",
  },
  {
    to: "/backup",
    label: "Backup",
    icon: DatabaseBackup,
    gradient: "from-slate-500 to-slate-700",
  },
  {
    to: "/configuracoes",
    label: "Ajustes",
    icon: Settings,
    gradient: "from-gray-600 to-gray-800",
  },
  {
    to: "/ajuda",
    label: "Ajuda",
    icon: CircleHelp,
    gradient: "from-fuchsia-500 to-purple-600",
  },
  {
    to: "/usuarios",
    label: "USUÁRIOS DO POSTO",
    icon: Users,
    gradient: "from-cyan-600 to-blue-800",
  },
  {
    to: "/lgpd",
    label: "MEU CONSENTIMENTO LGPD",
    icon: ShieldCheck,
    gradient: "from-emerald-600 to-green-800",
  },
  {
    to: "/pagamentos",
    label: "MINHA ASSINATURA",
    icon: WalletCards,
    gradient: "from-emerald-500 to-teal-700",
  },
];

function NavRow({
  items,
  desktopColumns,
  sidebar = false,
  onNavigate,
  mobileDrawer = false,
}: {
  items: NavItem[];
  desktopColumns: 5 | 6;
  sidebar?: boolean;
  onNavigate?: () => void;
  mobileDrawer?: boolean;
}) {
  return (
    <div
      className={`grid gap-1.5 ${sidebar ? "grid-cols-1" : desktopColumns === 6 ? "grid-cols-3 md:grid-cols-6" : "grid-cols-3 md:grid-cols-5"}`}
    >
      {items.map(({ to, label, icon: Icon, gradient }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          className={`flex min-w-0 flex-col items-center justify-center rounded-xl text-center font-medium uppercase leading-tight tracking-wider text-muted-foreground transition-colors ${mobileDrawer ? "min-h-16 gap-2 px-2 py-2 text-[11px]" : "min-h-14 gap-1 px-1 py-1 text-[9px]"}`}
          activeProps={{ className: "bg-muted text-foreground" }}
        >
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}
          >
            <Icon className="size-5 text-white" />
          </div>
          <span className="max-w-full whitespace-normal break-words">{label}</span>
        </Link>
      ))}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const subscription = useSubscription();
  const location = useLocation();
  const appState = useAppState();
  const company = appState.company;
  const [today, setToday] = useState(todayISO());
  const [divergenceRecords, setDivergenceRecords] = useState<TankDivergence[]>([]);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{ date: string; url: string } | null>(
    null,
  );
  const lowTanks = useMemo(
    () =>
      calculateTankAutonomy(appState, today).filter(
        (entry) => entry.percent !== undefined && entry.percent <= 25,
      ),
    [appState, today],
  );
  const { documents } = useFiscalDocuments();
  const fiscalAlerts = getFiscalAlertSummary(documents);
  const latestDivergences = useMemo(() => {
    const latestByTank = new Map<string, TankDivergence>();
    for (const record of divergenceRecords) {
      const current = latestByTank.get(record.tankId);
      if (!current || current.date < record.date) latestByTank.set(record.tankId, record);
    }
    return [...latestByTank.values()].filter((record) => record.status === "CRITICA");
  }, [divergenceRecords]);
  const companyDetails = [
    company?.bandeira,
    company?.address && `${company.address}${company.number ? `, ${company.number}` : ""}`,
    company?.bairro,
    company?.city && `${company.city}${company.state ? ` - ${company.state}` : ""}`,
  ].filter((value): value is string => Boolean(value?.trim()));
  const visibleItems = (items: NavItem[]) =>
    items.filter(
      (item) =>
        subscription.isAdmin ||
        roleAllows(subscription.role ?? getPersistedRole(), item.to, subscription.permissions),
    );
  const ownerReadOnly =
    subscription.role === "PROPRIETARIO" &&
    location.pathname !== "/usuarios" &&
    location.pathname !== "/lgpd" &&
    location.pathname !== "/pagamentos";
  const billingReadOnly = subscription.currentAccount?.billingStatus === "ATRASADO";
  const trialHours =
    subscription.trialRemainingMs === null
      ? null
      : Math.floor(subscription.trialRemainingMs / (60 * 60 * 1000));
  const trialMinutes =
    subscription.trialRemainingMs === null
      ? null
      : Math.floor((subscription.trialRemainingMs % (60 * 60 * 1000)) / (60 * 1000));

  useEffect(() => {
    const level = Number(window.localStorage.getItem("posto-font-size-level") ?? 0);
    document.documentElement.style.fontSize = `${16 + Math.min(3, Math.max(0, level))}px`;
  }, []);

  useEffect(() => {
    const refreshDate = () => {
      const currentDate = todayISO();
      setToday((previous) => (previous === currentDate ? previous : currentDate));
    };
    const interval = window.setInterval(refreshDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const refresh = () => setDivergenceRecords(getDivergenceRecords());
    try {
      refresh();
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL CARREGAR OS ALERTAS DE DIVERGÊNCIA.", error);
    }
    return subscribeToDivergenceChanges(() => {
      try {
        refresh();
      } catch (error) {
        console.error("NÃO FOI POSSÍVEL ATUALIZAR OS ALERTAS DE DIVERGÊNCIA.", error);
      }
    });
  }, []);

  useEffect(() => {
    const check = () => {
      try {
        checkDailyFiscalNotifications();
      } catch (error) {
        console.error("FALHA AO ATUALIZAR ALERTAS DE FISCALIZAÇÃO.", error);
      }
    };
    check();
    const interval = window.setInterval(check, 24 * 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    for (const entry of lowTanks) {
      const key = `alerta_25_${entry.tank.id}_${today}`;
      try {
        if (window.localStorage.getItem(key) === null) {
          window.localStorage.setItem(key, new Date().toISOString());
        }
      } catch (error) {
        console.error("NÃO FOI POSSÍVEL REGISTRAR O ALERTA DIÁRIO DE ESTOQUE.", error);
      }
    }
  }, [lowTanks, today]);

  useEffect(() => {
    const checkScheduledWhatsApp = () => {
      try {
        if (subscription.role === "PROPRIETARIO") {
          setPendingWhatsApp(null);
          return;
        }
        const config = readOwnerWhatsAppConfig();
        if (!config.ativo || config.numero.replace(/\D/g, "").length < 12) return;
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        if (currentTime < config.horario) return;
        const sentKey = dailyWhatsAppSentKey(today);
        const attemptKey = dailyWhatsAppAttemptKey(today);
        if (window.localStorage.getItem(sentKey) === "true") return;
        const message = buildOwnerWhatsAppMessage(appState, config, today);
        const url = ownerWhatsAppUrl(config.numero, message);
        if (window.localStorage.getItem(attemptKey) === today) {
          setPendingWhatsApp({ date: today, url });
          return;
        }
        window.localStorage.setItem(attemptKey, today);
        const popup = window.open(url, "_blank");
        if (!popup) {
          setPendingWhatsApp({ date: today, url });
          return;
        }
        popup.opener = null;
        window.localStorage.setItem(sentKey, "true");
        setPendingWhatsApp(null);
      } catch (error) {
        console.error("NÃO FOI POSSÍVEL PREPARAR O FECHAMENTO DIÁRIO PARA WHATSAPP.", error);
      }
    };
    checkScheduledWhatsApp();
    const interval = window.setInterval(checkScheduledWhatsApp, 60_000);
    return () => window.clearInterval(interval);
  }, [appState, subscription.role, today]);

  const openPendingWhatsApp = () => {
    if (!pendingWhatsApp || subscription.role === "PROPRIETARIO") return;
    try {
      const popup = window.open(pendingWhatsApp.url, "_blank");
      if (!popup) {
        console.error("O NAVEGADOR BLOQUEOU A ABERTURA DO WHATSAPP.");
        return;
      }
      popup.opener = null;
      window.localStorage.setItem(dailyWhatsAppSentKey(pendingWhatsApp.date), "true");
      setPendingWhatsApp(null);
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL ABRIR O WHATSAPP.", error);
    }
  };

  const ownerPhone = company?.phone?.replace(/\D/g, "") ?? "";
  const whatsappUrl =
    ownerPhone.length >= 10
      ? `https://wa.me/${ownerPhone.startsWith("55") ? ownerPhone : `55${ownerPhone}`}?text=${encodeURIComponent(
          `ALERTA 25% - ${lowTanks.map(({ index, tank }) => `TANQUE ${String(index + 1).padStart(2, "0")} ${tank.name.toLocaleUpperCase("pt-BR")}`).join("; ")}`,
        )}`
      : null;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background md:pl-64">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        {subscription.trialRemainingMs !== null ? (
          <div
            role="status"
            className="bg-white px-4 py-2 text-center text-sm font-bold text-black"
          >
            TESTE GRÁTIS - RESTAM {trialHours}H {String(trialMinutes).padStart(2, "0")}MIN
          </div>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
            className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl tracking-wide text-foreground">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            {company?.name || companyDetails.length > 0 ? (
              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                {company?.name} · {companyDetails.join(" · ")}
              </p>
            ) : null}
          </div>
          <Link
            to={
              latestDivergences.length > 0
                ? "/"
                : lowTanks.length > 0
                  ? "/dashboard"
                  : "/fiscalizacao"
            }
            title={`${fiscalAlerts.message}${lowTanks.length > 0 ? ` · ${lowTanks.length} TANQUE(S) COM ESTOQUE BAIXO` : ""}${latestDivergences.length > 0 ? ` · ${latestDivergences.length} DIVERGÊNCIA(S) CRÍTICA(S)` : ""}`}
            aria-label={`${fiscalAlerts.message}${lowTanks.length > 0 ? ` · ${lowTanks.length} TANQUE(S) COM ESTOQUE BAIXO` : ""}${latestDivergences.length > 0 ? ` · ${latestDivergences.length} DIVERGÊNCIA(S) CRÍTICA(S)` : ""}`}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <BellRing className="size-5" />
            {fiscalAlerts.dueWithin180 + lowTanks.length + latestDivergences.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {fiscalAlerts.dueWithin180 + lowTanks.length + latestDivergences.length}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => void subscription.logout()}
            aria-label="Sair da conta"
            title="SAIR DA CONTA"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl overflow-auto p-4 md:mx-auto md:px-4 md:py-5">
        {ownerReadOnly ? (
          <div
            role="status"
            className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-center font-bold text-amber-950"
          >
            PERFIL SOMENTE LEITURA
          </div>
        ) : null}
        {billingReadOnly ? (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-center font-bold text-red-950"
          >
            PAGAMENTO ATRASADO - REGULARIZE PARA CONTINUAR. VISUALIZAÇÃO DISPONÍVEL DURANTE O
            PERÍODO DE REGULARIZAÇÃO.
          </div>
        ) : null}
        {pendingWhatsApp && subscription.role !== "PROPRIETARIO" ? (
          <section
            role="status"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900"
          >
            <span>FECHAMENTO DIÁRIO PRONTO. O NAVEGADOR BLOQUEOU A ABERTURA AUTOMÁTICA.</span>
            <button
              type="button"
              onClick={openPendingWhatsApp}
              className="rounded-md bg-[#b7791f] px-3 py-2 text-xs font-bold text-white"
            >
              ABRIR WHATSAPP PARA REVISAR E ENVIAR
            </button>
          </section>
        ) : null}
        {latestDivergences.length > 0 ? (
          <section
            role="alert"
            className="sticky top-20 z-10 mb-4 animate-pulse rounded-xl border border-red-500 bg-red-50 p-3 text-sm font-extrabold text-red-800 shadow-md"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                {latestDivergences.map((record) => {
                  const tankIndex = appState.tanks.findIndex((tank) => tank.id === record.tankId);
                  const tankName = appState.tanks[tankIndex]?.name ?? record.tankId;
                  return (
                    <p key={record.tankId}>
                      TANQUE {String(tankIndex + 1).padStart(2, "0")} (
                      {tankName.toLocaleUpperCase("pt-BR")}) COM DIVERGÊNCIA CRÍTICA HÁ{" "}
                      {record.consecutiveDays} DIAS — VERIFICAR
                    </p>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
        {lowTanks.length > 0 ? (
          <section
            role="alert"
            className="sticky top-20 z-10 mb-4 space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-md"
          >
            {lowTanks.map((entry) => (
              <p key={entry.tank.id} className="text-sm font-bold">
                ⛽ TANQUE {String(entry.index + 1).padStart(2, "0")} -{" "}
                {entry.tank.name.toLocaleUpperCase("pt-BR")} ATINGIU O LIMITE DE 25% (
                {entry.percent?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% —{" "}
                {entry.stock === undefined ? "SEM MEDIÇÃO" : formatTankLiters(entry.stock)} de{" "}
                {fmtL(entry.tank.capacity)}) - AUTONOMIA: {formatAutonomy(entry.autonomyHours)} -{" "}
                PROVIDENCIAR PEDIDO
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              <Link
                to="/dashboard"
                className="rounded-md bg-[#b7791f] px-3 py-2 text-xs font-bold text-white"
              >
                VER ALERTAS E SUGESTÃO DE PEDIDO
              </Link>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800"
                >
                  COMPARTILHAR ALERTA NO WHATSAPP
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
        {ownerReadOnly || billingReadOnly ? (
          <fieldset
            disabled
            className="contents"
            onSubmitCapture={(event) => event.preventDefault()}
          >
            {children}
          </fieldset>
        ) : (
          children
        )}
      </main>

      <nav className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-border bg-card md:flex">
        <div className="mx-auto flex h-full flex-col gap-1.5 overflow-y-auto px-4 py-6">
          <NavRow items={visibleItems(rowOne)} desktopColumns={6} sidebar />
          <NavRow items={visibleItems(rowTwo)} desktopColumns={6} sidebar />
        </div>
      </nav>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <nav className="relative flex h-full w-full max-w-[17rem] flex-col overflow-y-auto border-r border-border bg-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="flex size-10 items-center justify-center rounded-md border border-border text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <NavRow
                items={visibleItems(rowOne)}
                desktopColumns={6}
                sidebar
                onNavigate={() => setMobileMenuOpen(false)}
                mobileDrawer
              />
              <NavRow
                items={visibleItems(rowTwo)}
                desktopColumns={6}
                sidebar
                onNavigate={() => setMobileMenuOpen(false)}
                mobileDrawer
              />
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
