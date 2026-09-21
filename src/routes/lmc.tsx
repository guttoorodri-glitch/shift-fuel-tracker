import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, CalendarRange, FileDown, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBR, fmtL, lmcRows, monthStartISO, todayISO, useAppState } from "@/lib/store";
import { buildLmcPdf, lmcFileName } from "@/lib/lmc-pdf";
import { downloadBlob, sharePdf } from "@/lib/share-pdf";

export const Route = createFileRoute("/lmc")({
  head: () => ({
    meta: [
      { title: "Relatório LMC — Posto 10" },
      {
        name: "description",
        content: "Livro de Movimentação de Combustíveis por dia e combustível.",
      },
    ],
  }),
  component: LmcPage,
});

const fmt = (value: number | undefined) => (value === undefined ? "—" : fmtL(value));
const fmtPercent = (value: number | undefined) =>
  value === undefined ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function LmcPage() {
  const state = useAppState();
  const [from, setFrom] = useState("1970-01-01");
  const [to, setTo] = useState("1970-01-01");

  useEffect(() => {
    const current = todayISO();
    setFrom(monthStartISO(current));
    setTo(current);
  }, []);

  const rows = useMemo(() => lmcRows(state, from, to), [state, from, to]);
  const divergentCount = rows.filter((row) => row.divergent).length;
  const [busy, setBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const gerarPdf = async () => {
    const blob = await buildLmcPdf(state, rows, from, to);
    return { blob, name: lmcFileName(from, to) };
  };

  const compartilhar = async () => {
    setBusy(true);
    setExportStatus(null);
    try {
      const { blob, name } = await gerarPdf();
      setExportStatus(
        await sharePdf(
          blob,
          name,
          `Relatório LMC do Posto 10 — ${formatBR(from)} a ${formatBR(to)}.`,
        ),
      );
    } catch {
      setExportStatus("Não foi possível gerar o PDF do relatório LMC.");
    } finally {
      setBusy(false);
    }
  };

  const baixar = async () => {
    setBusy(true);
    setExportStatus(null);
    try {
      const { blob, name } = await gerarPdf();
      downloadBlob(blob, name);
      setExportStatus(`PDF salvo como ${name}.`);
    } catch {
      setExportStatus("Não foi possível gerar o PDF do relatório LMC.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Relatório LMC" subtitle="Livro de movimentação de combustíveis">
      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="size-4 text-primary" />
          <h2 className="font-display text-lg text-foreground">Filtrar período</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="lmc-from" className="text-xs text-muted-foreground">
              De
            </Label>
            <Input
              id="lmc-from"
              className="mt-1"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lmc-to" className="text-xs text-muted-foreground">
              Até
            </Label>
            <Input
              id="lmc-to"
              className="mt-1"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {rows.length} linha(s) no período
          {divergentCount > 0 ? ` · ${divergentCount} divergência(s) acima do limite ANP` : ""}.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenCheck className="size-4 text-primary" />
          <h2 className="font-display text-lg text-foreground">Movimentação por combustível</h2>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma medição, venda ou recebimento registrado no período.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-3">Data</th>
                  <th className="px-2 py-3">Combustível</th>
                  <th className="px-2 py-3 text-right">Físico inicial</th>
                  <th className="px-2 py-3 text-right">Vendas T1+T2</th>
                  <th className="px-2 py-3 text-right">Recebimento</th>
                  <th className="px-2 py-3 text-right">Escritural</th>
                  <th className="px-2 py-3 text-right">Físico dia seguinte</th>
                  <th className="px-2 py-3 text-right">Diferença LMC</th>
                  <th className="px-2 py-3 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Fragment key={`${row.date}-${row.tankId}`}>
                    {index === 0 || rows[index - 1]?.tankId !== row.tankId ? (
                      <tr key={`${row.tankId}-group`} className="bg-muted/60">
                        <td colSpan={9} className="px-2 py-2 font-semibold text-foreground">
                          Tanque: {row.fuel}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-b border-border/70 last:border-0">
                      <td className="whitespace-nowrap px-2 py-3 tabular-nums text-foreground">
                        {formatBR(row.date)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 font-medium text-foreground">
                        {row.fuel}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                        {fmt(row.opening)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                        {fmtL(row.sales)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                        {fmtL(row.received)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                        {fmt(row.bookStock)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                        {fmt(row.nextPhysical)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-right tabular-nums ${row.divergent ? "font-semibold text-destructive" : ""}`}
                      >
                        {row.divergent ? (
                          <AlertTriangle
                            className="mr-1 inline size-3.5"
                            aria-label="Divergência"
                          />
                        ) : null}
                        {fmt(row.difference)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-right tabular-nums ${row.divergent ? "font-semibold text-destructive" : ""}`}
                      >
                        {fmtPercent(row.lossPercent)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">
          Divergência: percentual maior que 0,6% ou menor que -0,6%. O cálculo depende do físico
          inicial e da medição do dia seguinte.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void compartilhar()}>
            <Share2 className="size-4" /> Enviar por WhatsApp
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void baixar()}>
            <FileDown className="size-4" /> Salvar PDF
          </Button>
        </div>
        {exportStatus ? (
          <p className="mt-3 rounded-lg border border-primary/40 bg-secondary p-3 text-xs text-foreground">
            {exportStatus}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
