import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, FileDown, FileText, HelpCircle, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { buildContratoPdf, buildManualPdf, contratoFileName, manualFileName } from "@/lib/ajuda-pdf";
import { downloadBlob, sharePdf } from "@/lib/share-pdf";
import { PIX_KEY, SUBSCRIPTION_PRICE } from "@/hooks/useSubscription";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — Posto 10" },
      { name: "description", content: "Manual de uso, compra e contrato do aplicativo." },
    ],
  }),
  component: AjudaPage,
});

const CONTRACT_KEY = "posto-contract-accepted";

function AjudaPage() {
  const state = useAppState();
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(CONTRACT_KEY);
    if (saved) {
      setAccepted(true);
      setAcceptedAt(saved);
    }
  }, []);

  const aceitarContrato = (checked: boolean) => {
    setAccepted(checked);
    if (!checked) {
      setAcceptedAt(null);
      window.localStorage.removeItem(CONTRACT_KEY);
      return;
    }
    const timestamp = new Date().toLocaleString("pt-BR");
    setAcceptedAt(timestamp);
    window.localStorage.setItem(CONTRACT_KEY, timestamp);
  };

  const baixarManual = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildManualPdf(state);
      const name = manualFileName();
      downloadBlob(blob, name);
      setStatus(`PDF salvo como ${name}.`);
    } catch {
      setStatus("Não foi possível gerar o Manual em PDF.");
    } finally {
      setBusy(false);
    }
  };

  const compartilharManual = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildManualPdf(state);
      setStatus(
        await sharePdf(
          blob,
          manualFileName(),
          "Manual de uso e planos do aplicativo Posto 10.",
        ),
      );
    } catch {
      setStatus("Não foi possível compartilhar o Manual em PDF.");
    } finally {
      setBusy(false);
    }
  };

  const baixarContrato = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildContratoPdf(state, accepted, acceptedAt);
      const name = contratoFileName();
      downloadBlob(blob, name);
      setStatus(`Contrato salvo como ${name}.`);
    } catch {
      setStatus("Não foi possível gerar o Contrato em PDF.");
    } finally {
      setBusy(false);
    }
  };

  const compartilharContrato = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildContratoPdf(state, accepted, acceptedAt);
      setStatus(
        await sharePdf(
          blob,
          contratoFileName(),
          "Contrato de uso do aplicativo Posto 10.",
        ),
      );
    } catch {
      setStatus("Não foi possível compartilhar o Contrato em PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Ajuda" subtitle="Manual, compra e contrato de uso">
      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Como usar o aplicativo</h2>
        </div>
        <div className="mt-4 space-y-4 text-sm text-foreground">
          <HelpBlock
            title="1. Medidas e vendas diárias"
            text="Informe a medição inicial dos tanques e registre as vendas por turno. Use o histórico diário para acompanhar o estoque estimado."
          />
          <HelpBlock
            title="2. Relatório Vendas Combustível"
            text="Escolha o período e consulte os totais agrupados por tanque. Salve ou compartilhe o PDF pelo WhatsApp."
          />
          <HelpBlock
            title="3. CONTROLE PRODUTOS"
            text="Cadastre produtos, lance vendas, reposições e contagens do estoque da loja."
          />
          <HelpBlock
            title="4. Recebimento Combustível"
            text="Registre a nota e selecione obrigatoriamente o tanque que receberá cada volume. A quantidade será associada a esse tanque."
          />
          <HelpBlock
            title="5. Relatório LMC"
            text="Consulte compras, vendas, estoque escritural, físico do dia seguinte e divergências por tanque e data."
          />
          <HelpBlock
            title="6. Aferição"
            text="Em Parâmetros, cadastre os bicos e vincule cada um ao tanque de origem. Configure os limites de aferição e lance vazão lenta e rápida. O volume aferido retorna ao mesmo tanque e não gera perda."
          />
          <HelpBlock
            title="7. Escala"
            text="Cadastre frentistas, turnos e folgas. Escolha o mês para gerar a escala completa em PDF paisagem."
          />
          <HelpBlock title="8. TAREFAS" text="Crie tarefas e acompanhe o andamento pelo quadro." />
          <HelpBlock
            title="9. Check List"
            text="Marque as rotinas operacionais e de conformidade concluídas."
          />
          <HelpBlock
            title="10. Backup"
            text="Salve e compartilhe uma cópia dos dados ou restaure um backup JSON."
          />
          <HelpBlock
            title="11. Ajustes"
            text="Cadastre os dados do posto, tanques, capacidades, cores e quantidade de turnos."
          />
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-slate-900">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-amber-700" />
          <h2 className="font-display text-xl">Compra e renovação</h2>
        </div>
        <p className="mt-3 text-sm">
          Assinatura: <strong>R${SUBSCRIPTION_PRICE} por 30 dias</strong>.
        </p>
        <p className="mt-1 text-sm">
          Pagamento via PIX: <strong>{PIX_KEY}</strong>.
        </p>
        <p className="mt-3 text-xs">
          Na tela de pagamento, use o QR Code ou o PIX Copia e Cola. Após pagar, clique em “Já Fiz o
          PIX - Liberar Agora”.
        </p>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Contrato</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground">
          Declaro estar ciente de que, após o pagamento, o aplicativo funcionará por 30 dias. Caso
          não ocorra a renovação no prazo, o aplicativo poderá funcionar em tolerância e será
          bloqueado automaticamente ao final desse período.
        </p>
        <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            checked={accepted}
            onChange={(event) => aceitarContrato(event.target.checked)}
          />
          <span>
            Li e estou ciente das condições de pagamento, duração de 30 dias e bloqueio automático
            por falta de renovação.
          </span>
        </label>
        {acceptedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">Ciência registrada em {acceptedAt}.</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">Manual em PDF</h2>
        <p className="text-xs text-muted-foreground">
          Um único arquivo com todos os menus, instruções, opções de compra e renovação.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void compartilharManual()}>
            <Share2 className="size-4" /> Compartilhar Manual
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void baixarManual()}>
            <FileDown className="size-4" /> Salvar Manual
          </Button>
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">Contrato em PDF</h2>
        <p className="text-xs text-muted-foreground">
          Arquivo separado para salvar e compartilhar pelo WhatsApp. O documento registra a ciência do usuário.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void compartilharContrato()}>
            <Share2 className="size-4" /> Compartilhar Contrato
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void baixarContrato()}>
            <FileDown className="size-4" /> Salvar Contrato
          </Button>
        </div>
      </section>
      {status ? (
        <p className="mt-4 rounded-lg border border-primary/40 bg-secondary p-3 text-xs text-foreground">
          {status}
        </p>
      ) : null}
    </AppShell>
  );
}

function HelpBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}
