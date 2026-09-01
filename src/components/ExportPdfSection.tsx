import { useState } from "react";
import { FileDown, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildMedicoesPdf, medicoesFileName } from "@/lib/medicoes-pdf";
import {
  formatBR,
  monthStartISO,
  shiftISO,
  todayISO,
  useAppState,
  weekStartISO,
} from "@/lib/store";

type Filtro = "diario" | "semanal" | "mensal" | "periodo";

const LABELS: Record<Filtro, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
  periodo: "Por período",
};

export function ExportPdfSection() {
  const state = useAppState();
  const today = todayISO();
  const [filtro, setFiltro] = useState<Filtro>("diario");
  const [from, setFrom] = useState(monthStartISO(today));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const range = (): { from: string; to: string } => {
    if (filtro === "diario") return { from: today, to: today };
    if (filtro === "semanal") return { from: weekStartISO(today), to: shiftISO(weekStartISO(today), 6) };
    if (filtro === "mensal") return { from: monthStartISO(today), to: today };
    return { from, to };
  };

  const gerar = async () => {
    const r = range();
    const blob = await buildMedicoesPdf(state, r.from, r.to, LABELS[filtro]);
    return { blob, name: medicoesFileName(r.from, r.to), r };
  };

  const baixar = async () => {
    setBusy(true);
    try {
      const { blob, name } = await gerar();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`PDF salvo como ${name}.`);
    } finally {
      setBusy(false);
    }
  };

  const enviarWhatsApp = async () => {
    setBusy(true);
    try {
      const { blob, name, r } = await gerar();
      const file = new File([blob], name, { type: "application/pdf" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: "Medições — Posto 10",
            text: `Medições e vendas de ${formatBR(r.from)} a ${formatBR(r.to)}`,
          });
          setStatus("Escolha o WhatsApp na tela de compartilhamento.");
        } catch {
          setStatus(null);
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      window.open(
        `https://wa.me/?text=${encodeURIComponent(
          `Medições e vendas do Posto 10 — ${formatBR(r.from)} a ${formatBR(r.to)}. Anexe o arquivo ${name} salvo no aparelho.`,
        )}`,
        "_blank",
      );
      setStatus(`O PDF ${name} foi salvo — anexe-o na conversa do WhatsApp.`);
    } finally {
      setBusy(false);
    }
  };

  const r = range();

  return (
    <section className="mb-5 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-primary" />
        <h2 className="font-display text-lg text-foreground">Exportar PDF das medições</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Gere o relatório das medições do início do dia e das vendas por turno e envie pelo WhatsApp.
      </p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as Filtro[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            onClick={() => setFiltro(f)}
          >
            {LABELS[f]}
          </Button>
        ))}
      </div>

      {filtro === "periodo" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input className="mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input className="mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Intervalo do relatório: {formatBR(r.from)} a {formatBR(r.to)}
      </p>

      <Button className="w-full" disabled={busy} onClick={() => void enviarWhatsApp()}>
        <Share2 className="size-4" /> Enviar por WhatsApp
      </Button>
      <Button variant="outline" className="w-full" disabled={busy} onClick={() => void baixar()}>
        <FileDown className="size-4" /> Salvar PDF no aparelho
      </Button>

      {status ? (
        <p className="rounded-lg border border-primary/40 bg-secondary p-3 text-xs text-foreground">
          {status}
        </p>
      ) : null}
    </section>
  );
}
