import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ConsentScreen } from "@/hooks/subscription-access-ui";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/lgpd")({
  head: () => ({ meta: [{ title: "Meu consentimento LGPD — Posto 10" }] }),
  component: ConsentPage,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "NÃO REGISTRADO";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "NÃO REGISTRADO" : date.toLocaleString("pt-BR");
}

function ConsentPage() {
  const subscription = useSubscription();
  const consent = subscription.currentAccount;
  const [viewingContract, setViewingContract] = useState(false);

  if (viewingContract) {
    return (
      <ConsentScreen
        viewOnly
        onAccept={() => true}
        onDecline={() => setViewingContract(false)}
        error={null}
      />
    );
  }

  return (
    <AppShell title="MEU CONSENTIMENTO LGPD" subtitle="PRIVACIDADE E PROTEÇÃO DE DADOS">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">REGISTRO DO CONSENTIMENTO</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">E-MAIL DO USUÁRIO</dt>
            <dd className="break-all font-medium">
              {consent?.lgpd_email_usuario ?? subscription.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">STATUS</dt>
            <dd className="font-medium">{consent?.lgpd_de_acordo ? "ACEITO" : "NÃO ACEITO"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">DATA E HORA DA LEITURA</dt>
            <dd className="font-medium">{formatDate(consent?.lgpd_data_hora_leitura)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">DATA E HORA DO ACEITE</dt>
            <dd className="font-medium">{formatDate(consent?.lgpd_data_hora)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">VERSÃO DO TERMO</dt>
            <dd className="font-medium">{consent?.lgpd_versao ?? "NÃO REGISTRADA"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">E-MAIL</dt>
            <dd className="break-all font-medium">{consent?.lgpd_email ?? subscription.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">IP</dt>
            <dd className="font-medium">{consent?.lgpd_ip ?? "NÃO DISPONÍVEL NO MODO LOCAL"}</dd>
          </div>
          {consent?.lgpd_revogado_data_hora ? (
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">
                DATA E HORA DA REVOGAÇÃO
              </dt>
              <dd className="font-medium">{formatDate(consent.lgpd_revogado_data_hora)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          O IP não é coletado neste modo local. A conta e o consentimento são armazenados apenas
          neste navegador de demonstração.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setViewingContract(true)}>
            VER CONTRATO COMPLETO NOVAMENTE
          </Button>
          {consent?.lgpd_de_acordo ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!window.confirm("REVOGAR O CONSENTIMENTO E ENCERRAR A SESSÃO?")) return;
                subscription.revokeConsent();
              }}
            >
              REVOGAR CONSENTIMENTO
            </Button>
          ) : null}
        </div>
        {subscription.authError ? (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {subscription.authError}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
