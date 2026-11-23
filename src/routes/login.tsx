import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/hooks/subscription-access-ui";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Posto 10" }] }),
  component: LoginPage,
});

function LoginPage() {
  const subscription = useSubscription();
  if (subscription.isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
        <a href="/" className="rounded-lg bg-amber-500 px-5 py-3 font-bold text-black">
          IR PARA O APLICATIVO
        </a>
      </main>
    );
  }
  return <LoginScreen subscription={subscription} />;
}
