import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  type AppState,
  type DeliveryItem,
  type Delivery,
} from "@/lib/store";
import { buildRecebimentoPdf, recebimentoFileName } from "@/lib/recebimento-pdf";
import { downloadBlob, sharePdf } from "@/lib/share-pdf";

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
  tankId: string;
  qty: string;
  temperatura: string;
  densidade: string;
  densidade20: string;
  teorAlcoolico: string;
  etanolPct: string;
  fulgor: string;
};

const analysisFor = (draft: Draft) => {
  const fuel = draft.fuel.toLowerCase();
  const density = parse(draft.densidade20 ?? draft.densidade);
  const flash = parse(draft.fulgor);
  const alcohol = parse(draft.teorAlcoolico);
  const issues: string[] = [];
  if (density === undefined) issues.push("densidade não informada");
  if (fuel.includes("etanol") && density !== undefined && (density < 805 || density > 811)) {
    issues.push("densidade do etanol fora de 805 a 811 kg/m³");
  }
  if (fuel.includes("etanol") && alcohol === undefined) issues.push("teor alcoólico não informado");
  if (fuel.includes("diesel") && density !== undefined) {
    const minimum = fuel.includes("s10") ? 815 : 815;
    const maximum = fuel.includes("s10") ? 850 : 865;
    if (density < minimum || density > maximum)
      issues.push(`densidade fora de ${minimum} a ${maximum} kg/m³`);
  }
  if (fuel.includes("diesel") && flash === undefined) {
    issues.push("ponto de fulgor não informado");
  } else if (fuel.includes("diesel") && flash < 38) {
    issues.push("ponto de fulgor inferior a 38 °C");
  }
  return { authorized: issues.length === 0, issues };
};

const emptyDraft = (tankId: string, fuel: string): Draft => ({
  fuel,
  tankId,
  qty: "",
  temperatura: "",
  densidade: "",
  densidade20: "",
  teorAlcoolico: "",
  etanolPct: "",
  fulgor: "",
});

function DeliveryExportButtons({ delivery, state }: { delivery: Delivery; state: AppState }) {
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
        await sharePdf(blob, name, `Recebimento — NF ${delivery.nf}, ${formatBR(delivery.date)}.`),
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
  const [date, setDate] = useState(todayISO());
  const [distribuidora, setDistribuidora] = useState("");
  const [nf, setNf] = useState("");
  const [motorista, setMotorista] = useState("");
  const [rgMotorista, setRgMotorista] = useState("");
  const [placaCaminhao, setPlacaCaminhao] = useState("");
  const [responsavelAnalise, setResponsavelAnalise] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft("", "")]);

  const setDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const total = drafts.reduce((a, d) => a + (parse(d.qty) ?? 0), 0);

  const canSave =
    distribuidora.trim() !== "" &&
    nf.trim() !== "" &&
    motorista.trim() !== "" &&
    rgMotorista.trim() !== "" &&
    placaCaminhao.trim() !== "" &&
    responsavelAnalise.trim() !== "" &&
    drafts.every((d) => d.tankId !== "") &&
    drafts.every((d) => (parse(d.qty) ?? 0) > 0);

  const save = () => {
    const items: DeliveryItem[] = drafts
      .filter((d) => (parse(d.qty) ?? 0) > 0)
      .map((d) => ({
        fuel: d.fuel,
        tankId: d.tankId,
        qty: parse(d.qty) ?? 0,
        temperatura: parse(d.temperatura),
        densidade: parse(d.densidade),
        densidade20: parse(d.densidade20),
        teorAlcoolico: isEtanol(d.fuel) ? parse(d.teorAlcoolico) : undefined,
        etanolPct: isGasolina(d.fuel) ? parse(d.etanolPct) : undefined,
        fulgor: isDiesel(d.fuel) ? parse(d.fulgor) : undefined,
      }));
    if (items.length === 0) return;
    actions.addDelivery({
      date,
      distribuidora: distribuidora.trim(),
      nf: nf.trim(),
      motorista: motorista.trim(),
      rgMotorista: rgMotorista.trim(),
      placaCaminhao: placaCaminhao.trim(),
      responsavelAnalise: responsavelAnalise.trim(),
      items,
    });
    setDistribuidora("");
    setNf("");
    setDrafts([emptyDraft("", "")]);
  };

  const deliveries = s.deliveries ?? [];

  return (
    <AppShell title="Recebimento Combustível" subtitle="Notas fiscais e análise da descarga">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-xl tracking-wide text-foreground">Nova nota fiscal</h2>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nf">Número da NF</Label>
            <Input
              id="nf"
              value={nf}
              onChange={(e) => setNf(e.target.value)}
              placeholder="000123"
            />
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
          <div>
            <Label>Motorista</Label>
            <Input value={motorista} onChange={(e) => setMotorista(e.target.value)} />
          </div>
          <div>
            <Label>RG do motorista</Label>
            <Input value={rgMotorista} onChange={(e) => setRgMotorista(e.target.value)} />
          </div>
          <div>
            <Label>Placa do caminhão</Label>
            <Input value={placaCaminhao} onChange={(e) => setPlacaCaminhao(e.target.value)} />
          </div>
          <div>
            <Label>Responsável pela análise</Label>
            <Input
              value={responsavelAnalise}
              onChange={(e) => setResponsavelAnalise(e.target.value)}
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
                    value={d.tankId}
                    onChange={(e) => {
                      const tank = s.tanks.find((item) => item.id === e.target.value);
                      if (tank) setDraft(i, { tankId: tank.id, fuel: tank.name });
                    }}
                    className="h-9 flex-1 rounded-md border border-input bg-card px-2 text-sm text-foreground"
                    required
                  >
                    <option value="">Selecione o tanque de destino</option>
                    {s.tanks.map((tank, index) => (
                      <option key={tank.id} value={tank.id}>
                        Tanque {index + 1} — {tank.name}
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
                  <div className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                    Aspecto: <strong>LÍMPIDO, ISENTO DE IMPUREZAS</strong>
                  </div>
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
                {d.fuel ? (
                  <p
                    className={`mt-3 text-sm font-bold ${analysisFor(d).authorized ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {analysisFor(d).authorized ? "DESCARGA AUTORIZADA" : "DESCARGA NÃO AUTORIZADA"}
                    {analysisFor(d).issues.length > 0
                      ? ` — ${analysisFor(d).issues.join("; ")}`
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => setDrafts((ds) => [...ds, emptyDraft("", "")])}>
            <Plus className="mr-1 size-4" /> Combustível
          </Button>
          <p className="text-sm text-muted-foreground">Total: {fmtL(total)}</p>
        </div>

        <Button className="mt-3 w-full" disabled={!canSave} onClick={save}>
          <Truck className="mr-2 size-4" /> Salvar recebimento
        </Button>
        {!drafts.every((draft) => draft.tankId !== "") ? (
          <p className="mt-2 text-xs text-destructive">
            Selecione o tanque de destino em cada item antes de salvar o recebimento.
          </p>
        ) : null}
        {motorista.trim() === "" ||
        rgMotorista.trim() === "" ||
        placaCaminhao.trim() === "" ||
        responsavelAnalise.trim() === "" ? (
          <p className="mt-2 text-xs text-destructive">
            Informe motorista, RG do motorista, placa do caminhão e responsável pela análise antes
            de salvar.
          </p>
        ) : null}
        {drafts.every((draft) => draft.tankId !== "") &&
        !drafts.every((draft) => (parse(draft.qty) ?? 0) > 0) ? (
          <p className="mt-2 text-xs text-destructive">
            Informe a quantidade recebida em litros em cada item antes de salvar.
          </p>
        ) : null}
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
