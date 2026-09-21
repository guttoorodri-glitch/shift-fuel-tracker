import { Link } from "@tanstack/react-router";
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
  CreditCard,
  Droplets,
  WalletCards,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { planAllows, useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/lib/theme";
import { useAppState } from "@/lib/store";

type NavItem = { to: string; label: string; icon: LucideIcon; color: string };

const rowOne: NavItem[] = [
  { to: "/", label: "Medidas e vendas diárias", icon: Fuel, color: "var(--primary)" },
  {
    to: "/relatorios",
    label: "Relatório Vendas Combustível",
    icon: BarChart3,
    color: "var(--chart-2)",
  },
  {
    to: "/produtos",
    label: "CONTROLE PRODUTOS",
    icon: ShoppingBasket,
    color: "var(--chart-3)",
  },
  {
    to: "/recebimento",
    label: "Recebimento Combustível",
    icon: Truck,
    color: "var(--chart-4)",
  },
  { to: "/lmc", label: "Relatório LMC", icon: BookOpenCheck, color: "var(--chart-1)" },
  { to: "/afericao", label: "Aferição", icon: Gauge, color: "var(--chart-5)" },
];

const rowTwo: NavItem[] = [
  { to: "/escala", label: "Escala", icon: CalendarDays, color: "var(--folga)" },
  { to: "/tarefas", label: "TAREFAS", icon: KanbanSquare, color: "var(--falta)" },
  { to: "/checklist", label: "Check List", icon: ClipboardCheck, color: "var(--aprovado)" },
  { to: "/backup", label: "Backup", icon: DatabaseBackup, color: "var(--chart-1)" },
  { to: "/configuracoes", label: "Ajustes", icon: Settings, color: "var(--muted-foreground)" },
  { to: "/ajuda", label: "Ajuda", icon: CircleHelp, color: "var(--primary)" },
  { to: "/pagamentos", label: "PAGAMENTOS", icon: CreditCard, color: "var(--primary)" },
  { to: "/troca-oleo", label: "TROCA DE ÓLEO", icon: Droplets, color: "var(--chart-3)" },
  { to: "/fechamento-caixa", label: "FECHAMENTO CAIXA", icon: WalletCards, color: "var(--primary)" },
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
      {items.map(({ to, label, icon: Icon, color }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          className={`flex min-w-0 flex-col items-center justify-center rounded-xl text-center font-medium uppercase leading-tight tracking-wider text-muted-foreground transition-colors ${mobileDrawer ? "min-h-16 gap-2 px-2 py-2 text-[11px]" : "min-h-14 gap-1 px-1 py-1 text-[9px]"}`}
          activeProps={{ className: "bg-muted text-foreground" }}
        >
          <Icon className={mobileDrawer ? "size-6" : "size-5"} style={{ color }} />
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
  const company = useAppState().company;
  const companyDetails = [
    company?.bandeira,
    company?.address && `${company.address}${company.number ? `, ${company.number}` : ""}`,
    company?.bairro,
    company?.city && `${company.city}${company.state ? ` - ${company.state}` : ""}`,
  ].filter((value): value is string => Boolean(value?.trim()));
  const visibleItems = (items: NavItem[]) =>
    items.filter(
      (item) => subscription.isAdmin || planAllows(subscription.subscriptionPlan, item.to),
    );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background md:pl-64">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
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
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl overflow-auto p-4 md:mx-auto md:px-4 md:py-5">{children}</main>

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
