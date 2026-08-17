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

  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/lib/theme";

const nav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Turnos", icon: Fuel },
  { to: "/relatorios", label: "Vendas", icon: BarChart3 },
  { to: "/produtos", label: "Produtos", icon: ShoppingBasket },
  { to: "/escala", label: "Escala", icon: CalendarDays },
  { to: "/tarefas", label: "Tarefas", icon: KanbanSquare },
  { to: "/afericao", label: "Aferição", icon: Gauge },

  { to: "/backup", label: "Backup", icon: DatabaseBackup },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
];


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

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl tracking-wide text-foreground">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">
                {subtitle}
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

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
