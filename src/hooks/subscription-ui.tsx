import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PIX_KEY,
  PLAN_PRICES,
  SUBSCRIPTION_PRICE,
  type SubscriptionPlan,
  type SubscriptionState,
} from "@/hooks/useSubscription";

const CHAVE_PIX = PIX_KEY;

function crc16(payload: string) {
  let crc = 0xffff;
  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function createPixPayload(price: string) {
  const amount = price.replace(".", "").replace(",", ".");
  const merchantAccount = `0014BR.GOV.BCB.PIX01${String(PIX_KEY.length).padStart(2, "0")}${PIX_KEY}`;
  const payload = [
    "000201",
    `26${String(merchantAccount.length).padStart(2, "0")}${merchantAccount}`,
    "52040000",
    "5303986",
    `54${String(amount.length).padStart(2, "0")}${amount}`,
    "5802BR",
    "5910SHIFT FUEL",
    "6007LIMEIRA",
    "62070503***",
    "6304",
  ].join("");
  return `${payload}${crc16(payload)}`;
}

export function PixPagamento({
  onJaPaguei,
  price = SUBSCRIPTION_PRICE,
}: {
  onJaPaguei: () => void;
  price?: string;
}) {
  const pixPayload = createPixPayload(price);
  const copiar = () => {
    void navigator.clipboard.writeText(pixPayload);
    alert("PIX Copia e Cola copiado!");
  };
  const copiarChave = () => {
    void navigator.clipboard.writeText("19992197178");
    alert("Chave copiada: 19 99219-7178");
  };

  return (
    <div className="space-y-4 rounded-2xl border border-amber-400/50 bg-amber-50 p-5 text-center text-slate-900">
      <h2 className="text-xl font-bold">Pague R${price} para liberar 30 dias</h2>
      <p className="text-sm">
        Chave PIX: <b>{CHAVE_PIX}</b>{" "}
        <Button type="button" size="sm" variant="outline" onClick={copiarChave}>
          COPIAR CHAVE
        </Button>
      </p>
      <div className="mx-auto my-5 inline-block rounded-xl bg-white p-4">
        <QRCodeSVG value={pixPayload} size={250} />
      </div>
      <p className="font-semibold">PIX Copia e Cola:</p>
      <Textarea value={pixPayload} readOnly rows={3} className="bg-white text-xs" />
      <Button type="button" onClick={copiar}>
        COPIAR CÓDIGO PIX
      </Button>
      <hr className="my-5 border-amber-300" />
      <Button
        type="button"
        className="bg-green-600 px-6 py-3 text-lg hover:bg-green-700"
        onClick={onJaPaguei}
      >
        JÁ FIZ O PIX - LIBERAR AGORA
      </Button>
      <p className="text-xs">Após pagar, clique acima para liberação imediata</p>
    </div>
  );
}

export function LoginScreen({ subscription }: { subscription: SubscriptionState }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
            Posto 10
          </p>
          <h1 className="mt-2 font-display text-4xl">Controle de operações</h1>
          <p className="mt-2 text-sm text-slate-400">
            Entre para acessar suas medições, vendas e relatórios.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!subscription.loginUser(login, password)) setError(subscription.authError);
          }}
        >
          <Input
            className="border-white/10 bg-slate-800 text-white"
            placeholder="Usuário do plano (troca-oleo, frentista ou gerente)"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
          />
          <Input
            className="border-white/10 bg-slate-800 text-white"
            type="password"
            placeholder="Senha (inicial: posto10)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button className="w-full" type="submit">
            Entrar
          </Button>
        </form>
        <button
          type="button"
          className="w-full text-sm text-amber-300 underline"
          onClick={() => setShowAdmin((value) => !value)}
        >
          Acesso Administrador
        </button>
        {showAdmin ? (
          <form
            className="space-y-3 border-t border-white/10 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!subscription.loginAdmin(login, password)) setError("Login ou senha inválidos.");
            }}
          >
            <Input
              className="border-white/10 bg-slate-800 text-white"
              placeholder="Login"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
            />
            <Input
              className="border-white/10 bg-slate-800 text-white"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button className="w-full" type="submit">
              <ShieldCheck /> Entrar como administrador
            </Button>
          </form>
        ) : null}
        {error || subscription.authError ? (
          <p className="text-center text-sm text-red-300">{error ?? subscription.authError}</p>
        ) : null}
      </section>
    </main>
  );
}

export function PaymentScreen({ subscription }: { subscription: SubscriptionState }) {
  const [plan, setPlan] = useState<SubscriptionPlan>(subscription.subscriptionPlan);
  const planNames: Record<SubscriptionPlan, string> = {
    "troca-oleo": "TROCA DE ÓLEO",
    frentista: "FRENTISTA",
    gerente: "GERENTE",
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <section className="w-full max-w-lg space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            Assinatura necessária
          </p>
          <h1 className="mt-2 font-display text-4xl">Libere seu acesso</h1>
          <p className="mt-2 text-sm text-slate-300">
            Pague R$ {PLAN_PRICES[plan]} via PIX para liberar 30 dias de uso.
          </p>
        </div>
        <div className="grid gap-2">
          {(Object.keys(PLAN_PRICES) as SubscriptionPlan[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPlan(item)}
              className={`rounded-xl border p-3 text-left ${plan === item ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <strong>
                {planNames[item]} · R${PLAN_PRICES[item]}
              </strong>
            </button>
          ))}
        </div>
        <PixPagamento
          price={PLAN_PRICES[plan]}
          onJaPaguei={() => subscription.renewSubscription(plan)}
        />
        <Button
          variant="ghost"
          className="w-full text-slate-300"
          onClick={() => void subscription.logout()}
        >
          Sair
        </Button>
      </section>
    </main>
  );
}

export function SubscriptionBanner({ subscription }: { subscription: SubscriptionState }) {
  if (subscription.isAdmin || subscription.subscriptionStatus === "active") return null;
  if (subscription.isBlocked) return null;
  if (subscription.subscriptionStatus === "warning") {
    return (
      <div className="sticky top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-950">
        Sua assinatura vence em {subscription.daysRemaining} dias. Renove via PIX {PIX_KEY} - R${" "}
        {SUBSCRIPTION_PRICE}.{" "}
        <button type="button" className="ml-2 underline" onClick={subscription.renewSubscription}>
          Já Paguei
        </button>
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-50 animate-pulse bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white">
      Faltam {subscription.daysUntilBlock} dias para bloqueio total. Pague via PIX {PIX_KEY}{" "}
    </div>
  );
}

export function GraceModal({ subscription }: { subscription: SubscriptionState }) {
  const [dismissed, setDismissed] = useState(false);
  if (subscription.subscriptionStatus !== "grace" || dismissed) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-400 bg-red-950 p-6 text-white shadow-2xl">
        <h2 className="font-display text-3xl">Sua assinatura venceu hoje!</h2>
        <p className="text-sm">
          O app funcionará por mais 5 dias em modo de tolerância. Pague agora via PIX {PIX_KEY} para
          não perder acesso.
        </p>
        <PixPagamento onJaPaguei={subscription.renewSubscription} />
        <Button variant="ghost" className="w-full text-white" onClick={() => setDismissed(true)}>
          Continuar no modo de tolerância
        </Button>
      </div>
    </div>
  );
}

export function BlockedScreen({ subscription }: { subscription: SubscriptionState }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-white">
      <section className="w-full max-w-lg space-y-5 rounded-2xl border border-red-900 bg-zinc-950 p-6 text-center shadow-2xl">
        <h1 className="font-display text-4xl text-red-400">Acesso bloqueado</h1>
        <p className="text-sm text-zinc-300">
          Sua assinatura expirou. Para reativar, faça PIX de R$ {SUBSCRIPTION_PRICE} para a chave{" "}
          {PIX_KEY} e clique abaixo.
        </p>
        <PixPagamento onJaPaguei={subscription.renewSubscription} />
        <Button
          variant="ghost"
          className="w-full text-zinc-300"
          onClick={() => void subscription.logout()}
        >
          Sair
        </Button>
      </section>
    </main>
  );
}
