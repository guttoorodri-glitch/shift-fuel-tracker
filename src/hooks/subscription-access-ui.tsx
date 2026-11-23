import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SubscriptionState } from "@/hooks/useSubscription";

export function LoginScreen({ subscription }: { subscription: SubscriptionState }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showVisitorRegistration, setShowVisitorRegistration] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPassword, setVisitorPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
            POSTO 10
          </p>
          <h1 className="mt-2 font-display text-4xl">CONTROLE DE OPERAÇÕES</h1>
          <p className="mt-2 text-sm text-slate-400">
            ACESSO LOCAL DE TESTE. CADASTROS E DADOS FICAM NESTE NAVEGADOR.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(subscription.loginUser(username, password) ? null : subscription.authError);
          }}
        >
          <Input
            className="border-white/10 bg-slate-800 text-white"
            placeholder="PERFIL: PROPRIETÁRIO, GERENTE, FRENTISTA OU TROCADOR DE ÓLEO"
            aria-label="Perfil ou e-mail"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            className="border-white/10 bg-slate-800 text-white"
            type="password"
            placeholder="SENHA DO PERFIL"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button className="w-full" type="submit">
            ENTRAR
          </Button>
          <p className="text-center text-xs text-slate-400">
            USE O E-MAIL CADASTRADO; CONTAS LEGADAS PODEM USAR O NOME DO PERFIL.
          </p>
        </form>
        <Button
          type="button"
          className="w-full bg-white font-bold text-black hover:bg-gray-100"
          onClick={() => {
            setError(null);
            setShowVisitorRegistration((visible) => !visible);
          }}
        >
          ENTRAR COMO VISITANTE - 48 HORAS GRÁTIS
        </Button>
        {showVisitorRegistration ? (
          <form
            className="space-y-3 border-t border-white/10 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !subscription.registerVisitor({
                  nome: visitorName,
                  email: visitorEmail,
                  senha: visitorPassword,
                })
              ) {
                setError(subscription.authError);
              } else {
                setError(null);
              }
            }}
          >
            <p className="text-sm font-semibold text-amber-300">
              CADASTRO RÁPIDO — TESTE DE 48 HORAS
            </p>
            <Input
              className="border-white/10 bg-slate-800 text-white"
              placeholder="NOME"
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              required
            />
            <Input
              className="border-white/10 bg-slate-800 text-white"
              type="email"
              placeholder="E-MAIL"
              value={visitorEmail}
              onChange={(event) => setVisitorEmail(event.target.value)}
              required
            />
            <Input
              className="border-white/10 bg-slate-800 text-white"
              type="password"
              placeholder="SENHA (MÍNIMO 6 CARACTERES)"
              value={visitorPassword}
              onChange={(event) => setVisitorPassword(event.target.value)}
              minLength={6}
              required
            />
            <Button className="w-full" type="submit">
              CRIAR CONTA E INICIAR TESTE
            </Button>
          </form>
        ) : null}
        <p className="text-center text-xs text-slate-400">
          CONTAS LOCAIS SÃO SOMENTE PARA DEMONSTRAÇÃO; NÃO HÁ ISOLAMENTO SEGURO ENTRE POSTOS.
        </p>
        <button
          type="button"
          className="w-full text-sm text-amber-300 underline"
          onClick={() => setShowAdmin((visible) => !visible)}
        >
          ACESSO ADMINISTRADOR
        </button>
        {showAdmin ? (
          <form
            className="space-y-3 border-t border-white/10 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(
                subscription.loginAdmin(adminPassword) ? null : "SENHA ADMINISTRATIVA INVÁLIDA.",
              );
            }}
          >
            <Input
              className="border-white/10 bg-slate-800 text-white"
              type="password"
              placeholder="SENHA ADMINISTRATIVA"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
            />
            <Button className="w-full" type="submit">
              <ShieldCheck /> ENTRAR COMO ADMINISTRADOR
            </Button>
          </form>
        ) : null}
        {error || subscription.authError ? (
          <p role="alert" className="text-center text-sm text-red-300">
            {error ?? subscription.authError}
          </p>
        ) : null}
        {(error ?? subscription.authError)?.includes("ASSINATURA CANCELADA") ? (
          <a
            href="/planos"
            className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-black"
          >
            REATIVAR ASSINATURA
          </a>
        ) : null}
      </section>
    </main>
  );
}

export function VisitorExpiredScreen({ onBackToLogin }: { onBackToLogin: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
        <h1 className="font-display text-2xl text-amber-300">
          SEU TESTE DE 48 HORAS ACABOU. ASSINE PARA CONTINUAR USANDO O POSTO 10
        </h1>
        <a
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          href="https://wa.me/5519992197178?text=QUERO%20ASSINAR%20O%20POSTO%2010"
          target="_blank"
          rel="noreferrer"
        >
          ASSINAR AGORA
        </a>
        <Button
          className="w-full border-white/20 text-white hover:bg-slate-800"
          variant="outline"
          type="button"
          onClick={onBackToLogin}
        >
          VOLTAR PARA LOGIN
        </Button>
      </section>
    </main>
  );
}

export function ConsentScreen({
  onAccept,
  onDecline,
  error,
  viewOnly = false,
}: {
  onAccept: (readAt?: string) => boolean;
  onDecline: () => void;
  error: string | null;
  viewOnly?: boolean;
}) {
  const [read, setRead] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);
  return (
    <main
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 px-4 py-8 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lgpd-title"
    >
      <section className="w-full max-w-3xl space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <h1 id="lgpd-title" className="font-display text-3xl text-amber-300">
          CONTRATO DE USO E POLÍTICA DE PRIVACIDADE - LGPD - LEI 13.709/2018
        </h1>
        <div className="max-h-[45vh] space-y-4 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-sm leading-relaxed text-slate-200">
          <h2 className="font-bold text-white">1. DADOS COLETADOS</h2>
          <p>
            O Posto 10 pode registrar dados de identificação e contato dos usuários, como nome e
            e-mail, dados de acesso, registros de consentimento e informações operacionais inseridas
            pela equipe, incluindo abastecimentos, vendas, caixa, estoque, equipe, fiscalização,
            metas, aniversariantes e serviços de troca de óleo.
          </p>
          <h2 className="font-bold text-white">2. FINALIDADE DO TRATAMENTO</h2>
          <p>
            Os dados são tratados para autenticar usuários, operar as funções do aplicativo,
            registrar e consultar as atividades do posto, produzir relatórios, manter a segurança e
            atender solicitações relacionadas aos dados.
          </p>
          <h2 className="font-bold text-white">3. VÍNCULO AO POSTO E ACOMPANHAMENTO</h2>
          <p>
            Cada conta de equipe é vinculada ao posto correspondente. O PROPRIETÁRIO do posto pode
            acompanhar os dados operacionais inseridos pela equipe e consultar as informações
            daquele posto, de acordo com as permissões configuradas. Os dados não devem ser usados
            para finalidade incompatível com a operação do posto.
          </p>
          <h2 className="font-bold text-white">4. ARMAZENAMENTO E SEGURANÇA</h2>
          <p>
            Nesta versão de demonstração, os cadastros, registros operacionais e consentimentos
            ficam armazenados localmente no navegador e aparelho utilizados. Eles não são
            sincronizados entre aparelhos nem protegidos por autorização de servidor. O usuário deve
            proteger o aparelho e manter cópias de segurança. Uma futura versão conectada a servidor
            poderá ter regras de armazenamento e segurança próprias, que serão informadas antes de
            sua utilização.
          </p>
          <h2 className="font-bold text-white">5. DIREITOS DO TITULAR</h2>
          <p>
            O titular pode solicitar confirmação, acesso, correção ou exclusão dos seus dados e pode
            revogar o consentimento. Neste modo local, a exclusão de registros também pode afetar os
            dados operacionais associados armazenados neste navegador. Para exercer direitos ou
            pedir suporte, entre em contato com o responsável pelo Posto 10.
          </p>
          <h2 className="font-bold text-white">6. CONSENTIMENTO</h2>
          <p>
            O tratamento descrito observa a Lei Geral de Proteção de Dados Pessoais - Lei
            13.709/2018. Ao marcar as duas confirmações e selecionar LI E ESTOU DE ACORDO, o usuário
            confirma que leu o contrato e concorda com o tratamento descrito. O registro guarda a
            versão do contrato, data e hora, e-mail e status do aceite. A revogação encerra a sessão
            e exige novo aceite antes de continuar usando o aplicativo.
          </p>
        </div>
        {!viewOnly ? (
          <>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-amber-400"
                checked={read}
                onChange={(event) => {
                  setRead(event.target.checked);
                  setReadAt(event.target.checked ? new Date().toISOString() : null);
                }}
              />
              <span>CONFIRMO QUE LI O CONTRATO COMPLETO</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-amber-400"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>ESTOU DE ACORDO COM O CONTRATO E COM O TRATAMENTO DOS MEUS DADOS</span>
            </label>
            <Button
              className="w-full"
              type="button"
              disabled={!read || !agreed}
              onClick={() => {
                if (!onAccept(readAt ?? undefined)) {
                  setRead(false);
                  setAgreed(false);
                  setReadAt(null);
                }
              }}
            >
              LI E ESTOU DE ACORDO
            </Button>
            <Button
              className="w-full border border-black bg-white font-bold text-black hover:bg-gray-100 hover:text-black"
              variant="outline"
              type="button"
              onClick={onDecline}
            >
              NÃO CONCORDO
            </Button>
          </>
        ) : (
          <Button
            className="w-full border-white/20 text-white hover:bg-slate-800"
            variant="outline"
            type="button"
            onClick={onDecline}
          >
            FECHAR
          </Button>
        )}
        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
