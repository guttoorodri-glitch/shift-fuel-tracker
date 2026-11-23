import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  Navigate,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { roleAllows, useSubscription } from "@/hooks/useSubscription";
import { ConsentScreen, LoginScreen, VisitorExpiredScreen } from "@/hooks/subscription-access-ui";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  console.error(normalizedError);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(normalizedError, { boundary: "tanstack_root_error_component" });
  }, [normalizedError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#000000" },
      { title: "Posto 10 — Controle de Vendas e Turnos" },
      {
        name: "description",
        content:
          "Aplicativo para controlar vendas, medições de tanques e escala de frentistas do posto de combustíveis.",
      },
      { property: "og:title", content: "Posto 10 — Controle de Vendas e Turnos" },
      {
        property: "og:description",
        content: "Medições, vendas por turno e escala de frentistas do posto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Não foi possível registrar o service worker.", error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        onChangeCapture={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement))
            return;
          if (
            target instanceof HTMLInputElement &&
            !["text", "search", "email", "tel", "url", "password"].includes(target.type)
          )
            return;
          if ((event.nativeEvent as InputEvent).isComposing) return;
          const uppercase = target.value.toLocaleUpperCase("pt-BR");
          if (uppercase === target.value) return;
          const selectionStart = target.selectionStart;
          const selectionEnd = target.selectionEnd;
          target.value = uppercase;
          if (selectionStart !== null && selectionEnd !== null) {
            target.setSelectionRange(selectionStart, selectionEnd);
          }
        }}
      >
        <AppAccessGate />
      </div>
    </QueryClientProvider>
  );
}

function AppAccessGate() {
  const subscription = useSubscription();
  const location = useLocation();
  const publicPaths = ["/", "/login", "/planos", "/cadastro", "/checkout", "/admin-dev"];

  if (subscription.authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white">
        Carregando acesso...
      </div>
    );
  }
  if (publicPaths.includes(location.pathname)) return <Outlet />;
  if (subscription.visitorExpired) {
    return <VisitorExpiredScreen onBackToLogin={subscription.returnToLogin} />;
  }
  if (!subscription.isAuthenticated) return <LoginScreen subscription={subscription} />;
  if (subscription.isAdmin) return <Outlet />;
  if (subscription.requiresConsent) {
    return (
      <ConsentScreen
        onAccept={subscription.acceptConsent}
        onDecline={subscription.returnToLogin}
        error={subscription.authError}
      />
    );
  }
  if (!roleAllows(subscription.role, location.pathname, subscription.permissions)) {
    const preferredPaths =
      subscription.role === "FRENTISTA"
        ? ["/fechamento-caixa", "/fiscalizacao", "/lgpd"]
        : subscription.role === "TROCA-OLEO"
          ? ["/troca-oleo", "/fiscalizacao", "/lgpd"]
          : ["/dashboard", "/lgpd"];
    const defaultPath =
      preferredPaths.find((path) =>
        roleAllows(subscription.role, path, subscription.permissions),
      ) ?? "/lgpd";
    return <Navigate to={defaultPath} replace />;
  }

  return (
    <>
      {subscription.passwordGraceSeconds > 0 ? (
        <div
          role="alert"
          className="sticky top-0 z-[55] flex flex-wrap items-center justify-center gap-2 bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          SENHA INCORRETA: ACESSO TEMPORÁRIO POR{" "}
          {Math.floor(subscription.passwordGraceSeconds / 60)}:
          {String(subscription.passwordGraceSeconds % 60).padStart(2, "0")}. APÓS ESSE PRAZO, ENTRE
          COM A SENHA CORRETA.
          <button type="button" className="underline" onClick={() => void subscription.logout()}>
            SAIR E CORRIGIR SENHA
          </button>
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
