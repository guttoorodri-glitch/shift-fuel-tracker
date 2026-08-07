import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, Mail, RotateCcw, Share2, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBR, importState, serializeState, todayISO, useAppState } from "@/lib/store";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [
      { title: "Backup e Restauração — Posto" },
      {
        name: "description",
        content:
          "Salve um backup dos dados do posto, envie por e-mail ou WhatsApp e restaure as informações quando precisar.",
      },
      { property: "og:title", content: "Backup e Restauração — Posto" },
      {
        property: "og:description",
        content: "Backup dos dados do posto por arquivo ou e-mail e restauração completa.",
      },
    ],
  }),
  component: BackupPage,
});

function BackupPage() {
  const state = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const fileName = `backup-posto-${todayISO()}.json`;

  const totalRegistros =
    Object.keys(state.openings).length + Object.keys(state.sales).length;

  const buildFile = () =>
    new File([serializeState(state)], fileName, { type: "application/json" });

  const baixar = () => {
    const url = URL.createObjectURL(buildFile());
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Backup salvo como ${fileName}.`);
  };

  const compartilhar = async () => {
    const file = buildFile();
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({
          files: [file],
          title: "Backup do posto",
          text: `Backup dos dados do posto — ${formatBR(todayISO())}`,
        });
        setStatus("Backup compartilhado. Escolha o e-mail para guardar o arquivo.");
      } catch {
        setStatus(null);
      }
      return;
    }
    baixar();
    setStatus(
      `Compartilhamento direto não disponível neste aparelho. O arquivo ${fileName} foi salvo — anexe-o no seu e-mail.`,
    );
  };

  const abrirEmail = () => {
    baixar();
    const assunto = encodeURIComponent(`Backup do posto — ${formatBR(todayISO())}`);
    const corpo = encodeURIComponent(
      `Backup dos dados do posto gerado em ${formatBR(todayISO())}.\n\nAnexe o arquivo ${fileName} que acabou de ser salvo no aparelho.`,
    );
    window.location.href = `mailto:${email}?subject=${assunto}&body=${corpo}`;
  };

  const restaurar = async (file: File) => {
    try {
      const ok = importState(await file.text());
      setStatus(
        ok ? "Dados restaurados com sucesso." : "Arquivo inválido: nenhum dado restaurado.",
      );
    } catch {
      setStatus("Não foi possível ler o arquivo de backup.");
    }
  };

  return (
    <AppShell title="Backup" subtitle="Salvar, enviar e restaurar dados">
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg text-foreground">Dados gravados</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Toda medida, venda e escala é gravada automaticamente no aparelho ao salvar.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Tanques" value={state.tanks.length} />
          <Stat label="Frentistas" value={state.attendants.length} />
          <Stat label="Dias com dados" value={totalRegistros} />
        </div>
      </section>

      <section className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg text-foreground">Fazer backup</h2>
        <p className="text-xs text-muted-foreground">
          Gere o arquivo do dia e envie por e-mail ou WhatsApp para nunca perder os dados.
        </p>
        <Button className="w-full" onClick={compartilhar}>
          <Share2 className="size-4" /> Compartilhar / enviar por e-mail
        </Button>
        <Button variant="outline" className="w-full" onClick={baixar}>
          <Download className="size-4" /> Salvar arquivo no aparelho
        </Button>

        <div className="pt-2">
          <Label className="text-xs text-muted-foreground">
            E-mail para envio (opcional)
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              type="email"
              inputMode="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button variant="secondary" onClick={abrirEmail}>
              <Mail className="size-4" /> Abrir
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Abre seu app de e-mail com a mensagem pronta; o arquivo é salvo para anexar.
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg text-foreground">Restaurar backup</h2>
        <p className="text-xs text-muted-foreground">
          Selecione um arquivo de backup para substituir os dados atuais deste aparelho.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restaurar(file);
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Escolher arquivo de backup
        </Button>
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <RotateCcw className="size-3.5" /> A restauração sobrescreve tanques, escala e
          lançamentos.
        </p>
      </section>

      {status ? (
        <p className="mt-4 rounded-lg border border-primary/40 bg-secondary p-3 text-xs text-foreground">
          {status}
        </p>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="font-display text-2xl tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
