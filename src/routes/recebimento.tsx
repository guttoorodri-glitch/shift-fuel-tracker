import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Plus, Share2, Trash2, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actions,
  fmtL,
  formatBR,
  fuelColor,
  todayISO,
  useAppState,
  type DeliveryItem,
  type Delivery,
} from "@/lib/store";
import { buildRecebimentoPdf, recebimentoFileName } from "@/lib/recebimento-pdf";

export const Route = createFileRoute("/recebimento")({
  head: () => ({
    meta: [
      { title: "Recebimento de Combustíveis — Posto 10" },
      {
        name: "description",
        content:
          "Registre notas fiscais de recebimento de combustível com distribuidora, quantidade e análise de qualidade por produto.",
      },
      { property: "og:title", content: "Recebimento de Combustíveis — Posto 10" },
      {
        property: "og:description",
        content:
          "Controle das descargas: temperatura, densidade a 20 °C, teor alcoólico, % de etanol e ponto de fulgor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecebimentoPage,
});

const parse = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? undefined : n;
};

const isEtanol = (fuel: string) => fuel.toLowerCase().includes("etanol");
const isGasolina = (fuel: string) => fuel.toLowerCase().includes("gasolina");
const isDiesel = (fuel: string) => fuel.toLowerCase().includes("diesel");

type Draft = {
  fuel: string;
  qty: string;
  temperatura: string;
  densidade: string;
  densidade20: string;
  teorAlcoolico: string;
  etanolPct: string;
  fulgor: string;
};

const emptyDraft = (fuel: string): Draft => ({
  fuel,
  qty: "",
  temperatura: "",
  densidade: "",
  densidade20: "",
  teorAlcoolico: "",
  etanolPct: "",
  fulgor: "",
});

function DeliveryExportButtons({
  delivery,
  state,
}: {
  delivery: Delivery;
  state: AppState;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await buildRecebimentoPdf(delivery, state);
      const name = recebimentoFileName(delivery);
      downloadBlob(blob, name);
      setStatus(`PDF salvo como ${name}.`);
    } catch {
      setStatus("Não foi possível gerar o PDF do recebimento.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildRecebimentoPdf(delivery, state);
      const name = recebimentoFileName(delivery);
      setStatus(
        await sharePdf(
          blob,
          name,
          `Recebimento — NF ${delivery.nf}, ${formatBR(delivery.date)}.`,
        ),
      );
    } catch {
      setStatus("Não foi possível compartilhar o PDF. Toque em Salvar PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" disabled={busy} onClick={() => void share()}>
          <Share2 className="size-4" /> WhatsApp
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void download()}>
          <FileDown className="size-4" /> Salvar PDF
        </Button>
      </div>
      {status ? (
        <p className="rounded-lg border border-primary/40 bg-secondary p-2 text-xs text-foreground">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function RecebimentoPage() {
  const s = useAppState();
  const fuels = useMemo(() => s.tanks.map((t) => t.name), [s.tanks]);
  const firstFuel = fuels[0] ?? "Gasolina Comum";

  const [date, setDate] = useState(todayISO());
  const [distribuidora, setDistribuidora] = useState("");
  const [nf, setNf] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft(firstFuel)]);

  const setDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const total = drafts.reduce((a, d) => a + (parse(d.qty) ?? 0), 0);

  const canSave =
    distribuidora.trim() !== "" &&
    nf.trim() !== "" &&
    drafts.some((d) => (parse(d.qty) ?? 0) > 0);

  const save = () => {
    const items: DeliveryItem[] = drafts
      .filter((d) => (parse(d.qty) ?? 0) > 0)
      .map((d) => ({
        fuel: d.fuel,
        qty: parse(d.qty) ?? 0,
        temperatura: parse(d.temperatura),
        densidade: parse(d.densidade),
        densidade20: parse(d.densidade20),
        teorAlcoolico: isEtanol(d.fuel) ? parse(d.teorAlcoolico) : undefined,
        etanolPct: isGasolina(d.fuel) ? parse(d.etanolPct) : undefined,
        fulgor: isDiesel(d.fuel) ? parse(d.fulgor) : undefined,
      }));
    if (items.length === 0) return;
    actions.addDelivery({ date, distribuidora: distribuidora.trim(), nf: nf.trim(), items });
    setDistribuidora("");
    setNf("");
    setDrafts([emptyDraft(firstFuel)]);
  };

  const deliveries = s.deliveries ?? [];

  return (
    <AppShell title="Recebimento" subtitle="Notas fiscais e análise da descarga">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-xl tracking-wide text-foreground">Nova nota fiscal</h2>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nf">Número da NF</Label>
            <Input id="nf" value={nf} onChange={(e) => setNf(e.target.value)} placeholder="000123" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="dist">Distribuidora</Label>
            <Input
              id="dist"
              value={distribuidora}
              onChange={(e) => setDistribuidora(e.target.value)}
              placeholder="Ex.: Ipiranga"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {drafts.map((d, i) => {
            const color = fuelColor(s, d.fuel);
            return (
              <div
                key={i}
                className="rounded-xl border border-border bg-background p-3"
                style={color ? { borderLeft: `4px solid ${color}` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <select
                    value={d.fuel}
                    onChange={(e) => setDraft(i, { fuel: e.target.value })}
                    className="h-9 flex-1 rounded-md border border-input bg-card px-2 text-sm text-foreground"
                  >
                    {fuels.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  {drafts.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover combustível"
                      onClick={() => setDrafts((ds) => ds.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade (L)</Label>
                    <Input
                      inputMode="decimal"
                      value={d.qty}
                      onChange={(e) => setDraft(i, { qty: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Temperatura (°C)</Label>
                    <Input
                      inputMode="decimal"
                      value={d.temperatura}
                      onChange={(e) => setDraft(i, { temperatura: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Densidade</Label>
                    <Input
                      inputMode="decimal"
                      value={d.densidade}
                      onChange={(e) => setDraft(i, { densidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Densidade a 20 °C</Label>
                    <Input
                      inputMode="decimal"
                      value={d.densidade20}
                      onChange={(e) => setDraft(i, { densidade20: e.target.value })}
                    />
                  </div>
                  {isEtanol(d.fuel) ? (
                    <div>
                      <Label>Teor alcoólico (%)</Label>
                      <Input
                        inputMode="decimal"
                        value={d.teorAlcoolico}
                        onChange={(e) => setDraft(i, { teorAlcoolico: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {isGasolina(d.fuel) ? (
                    <div>
                      <Label>Etanol na gasolina (%)</Label>
                      <Input
                        inputMode="decimal"
                        value={d.etanolPct}
                        onChange={(e) => setDraft(i, { etanolPct: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {isDiesel(d.fuel) ? (
                    <div>
                      <Label>Ponto de fulgor (°C)</Label>
                      <Input
                        inputMode="decimal"
                        value={d.fulgor}
                        onChange={(e) => setDraft(i, { fulgor: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setDrafts((ds) => [...ds, emptyDraft(firstFuel)])}
          >
            <Plus className="mr-1 size-4" /> Combustível
          </Button>
          <p className="text-sm text-muted-foreground">Total: {fmtL(total)}</p>
        </div>

        <Button className="mt-3 w-full" disabled={!canSave} onClick={save}>
          <Truck className="mr-2 size-4" /> Salvar recebimento
        </Button>
      </section>

      <section className="mt-5 space-y-3">
        <h2 className="font-display text-xl tracking-wide text-foreground">Histórico</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento registrado.</p>
        ) : (
          deliveries.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg tracking-wide text-foreground">
                    {d.distribuidora}
                  </p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    NF {d.nf} · {formatBR(d.date)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir recebimento"
                  onClick={() => actions.removeDelivery(d.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {d.items.map((it, i) => {
                  const color = fuelColor(s, it.fuel);
                  return (
                    <div
                      key={i}
                      className="rounded-xl bg-background p-3"
                      style={color ? { borderLeft: `4px solid ${color}` } : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium" style={color ? { color } : undefined}>
                          {it.fuel}
                        </p>
                        <p className="text-sm text-foreground">{fmtL(it.qty)}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          it.temperatura !== undefined ? `Temp. ${it.temperatura} °C` : null,
                          it.densidade !== undefined ? `Dens. ${it.densidade}` : null,
                          it.densidade20 !== undefined ? `Dens. 20°C ${it.densidade20}` : null,
                          it.teorAlcoolico !== undefined ? `Teor alc. ${it.teorAlcoolico}%` : null,
                          it.etanolPct !== undefined ? `Etanol ${it.etanolPct}%` : null,
                          it.fulgor !== undefined ? `Fulgor ${it.fulgor} °C` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem análise informada"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <DeliveryExportButtons delivery={d} />
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
