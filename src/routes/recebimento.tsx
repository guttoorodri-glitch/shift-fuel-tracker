import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Plus, Share2, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
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
import {
  buildPurchaseMixEvolution,
  calculatePurchaseMix,
  readMonthlyPurchaseMixHistory,
  saveMonthlyPurchaseMix,
  type MonthlyPurchaseMix,
} from "@/lib/purchase-mix";

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
const META_MIX_KEY = "posto10_meta_mix_compra";
const formatMix = (percentage: number) =>
  `${percentage.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type Draft = {
  fuel: string;
  qty: string;
  distribution: Record<string, string>;
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
  } else if (fuel.includes("diesel") && flash !== undefined && flash < 38) {
    issues.push("ponto de fulgor inferior a 38 °C");
  }
  return { authorized: issues.length === 0, issues };
};

const emptyDraft = (fuel = ""): Draft => ({
  fuel,
  qty: "",
  distribution: {},
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
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft()]);
  const [metaMix, setMetaMix] = useState("25");
  const [mixHistory, setMixHistory] = useState<MonthlyPurchaseMix[]>([]);
  const [currentDate, setCurrentDate] = useState(todayISO());

  useEffect(() => {
    const savedMeta = window.localStorage.getItem(META_MIX_KEY);
    if (savedMeta !== null) setMetaMix(savedMeta);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(todayISO()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const setDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const total = drafts.reduce((a, d) => a + (parse(d.qty) ?? 0), 0);

  const deliveries = useMemo(() => s.deliveries ?? [], [s.deliveries]);
  const normalizeFuel = (fuel: string) => fuel.trim().toLocaleUpperCase("pt-BR");
  const fuelOptions = [
    ...new Map(s.tanks.map((tank) => [normalizeFuel(tank.name), tank.name])).values(),
  ];
  const tanksForFuel = (fuel: string) =>
    s.tanks.filter((tank) => normalizeFuel(tank.name) === normalizeFuel(fuel));
  const currentTankLevel = (tankId: string) => {
    const tank = s.tanks.find((item) => item.id === tankId);
    if (!tank) return undefined;
    const opening = s.shiftMeasurements?.[date]?.[1]?.[tankId] ?? s.openings[date]?.[tankId];
    if (opening === undefined) return undefined;

    const received = deliveries
      .filter((delivery) => delivery.date === date)
      .flatMap((delivery) => delivery.items)
      .reduce((sum, item) => {
        if (item.tankId) return sum + (item.tankId === tankId ? item.qty : 0);
        const sameFuelTanks = s.tanks.filter((candidate) => candidate.name === item.fuel);
        return sum + (sameFuelTanks.length === 1 && sameFuelTanks[0]?.id === tankId ? item.qty : 0);
      }, 0);
    const sold = Object.values(s.sales[date] ?? {}).reduce(
      (sum, turn) => sum + (turn[tankId] ?? 0),
      0,
    );
    return opening + received - sold;
  };
  const distributionForDraft = (draft: Draft) => {
    const tanks = tanksForFuel(draft.fuel);
    if (tanks.length === 1) {
      const tank = tanks[0];
      return tank ? [{ tank, liters: parse(draft.qty) ?? 0 }] : [];
    }
    return tanks.map((tank) => ({ tank, liters: parse(draft.distribution[tank.id] ?? "") ?? 0 }));
  };
  const draftErrors = drafts.flatMap((draft, index) => {
    if (!draft.fuel) return [`Selecione o combustível do item ${index + 1}.`];
    const tanks = tanksForFuel(draft.fuel);
    const invoiceLiters = parse(draft.qty);
    if (invoiceLiters === undefined || invoiceLiters <= 0) {
      return [`Informe o total da nota para ${draft.fuel}.`];
    }
    if (tanks.length > 1) {
      const invalidAllocation = tanks.some((tank) => {
        const allocation = parse(draft.distribution[tank.id] ?? "");
        return allocation === undefined || allocation < 0;
      });
      if (invalidAllocation) {
        return [`INFORME LITROS ZERO OU POSITIVOS PARA CADA TANQUE DE ${draft.fuel}.`];
      }
      const distributed = distributionForDraft(draft).reduce((sum, item) => sum + item.liters, 0);
      if (Math.abs(distributed - invoiceLiters) > 0.01) {
        return [
          `SOMA DOS TANQUES (${fmtL(distributed)}) DIFERENTE DA NOTA (${fmtL(invoiceLiters)}) — CORRIJA.`,
        ];
      }
    }
    return distributionForDraft(draft).flatMap(({ tank, liters }) => {
      if (liters <= 0) return [];
      const current = currentTankLevel(tank.id);
      if (current === undefined) {
        return [`INFORME A MEDIÇÃO DO TURNO 1 DO TANQUE ${tank.name} PARA VALIDAR A CAPACIDADE.`];
      }
      const afterReceipt = current + liters;
      return afterReceipt > tank.capacity
        ? [
            `TANQUE ${String(s.tanks.findIndex((item) => item.id === tank.id) + 1).padStart(2, "0")} ULTRAPASSA CAPACIDADE MÁXIMA (${fmtL(tank.capacity)}) — ATUAL ${fmtL(current)} + ${fmtL(liters)} = ${fmtL(afterReceipt)}.`,
          ]
        : [];
    });
  });
  const canSave =
    distribuidora.trim() !== "" &&
    nf.trim() !== "" &&
    motorista.trim() !== "" &&
    rgMotorista.trim() !== "" &&
    placaCaminhao.trim() !== "" &&
    responsavelAnalise.trim() !== "" &&
    drafts.length > 0 &&
    drafts.every((draft) => draft.fuel !== "") &&
    draftErrors.length === 0;

  const currentMonth = currentDate.slice(0, 7);
  const firstRecentDate = (() => {
    const date = new Date(`${currentDate}T00:00:00`);
    date.setDate(date.getDate() - 29);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  })();
  const monthMix = useMemo(
    () =>
      calculatePurchaseMix(deliveries, s.tanks, (delivery) =>
        delivery.date.startsWith(currentMonth),
      ),
    [currentMonth, deliveries, s.tanks],
  );
  useEffect(() => {
    let history = readMonthlyPurchaseMixHistory();
    const completedMonths = [
      ...new Set(
        deliveries
          .map((delivery) => delivery.date.slice(0, 7))
          .filter((month) => month < currentMonth),
      ),
    ];
    for (const month of completedMonths) {
      if (history.some((entry) => entry.month === month)) continue;
      const finalMix = calculatePurchaseMix(deliveries, s.tanks, (delivery) =>
        delivery.date.startsWith(month),
      );
      if (finalMix.totalGasolineLiters <= 0) continue;
      const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      history = saveMonthlyPurchaseMix({
        month,
        commonLiters: finalMix.commonLiters,
        additiveLiters: finalMix.additiveLiters,
        percentage: finalMix.percentage,
        closedAt: `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999`,
      });
    }

    const currentDay = Number(currentDate.slice(8, 10));
    const daysInCurrentMonth = new Date(
      Number(currentMonth.slice(0, 4)),
      Number(currentMonth.slice(5, 7)),
      0,
    ).getDate();
    if (currentDay === daysInCurrentMonth && monthMix.totalGasolineLiters > 0) {
      const existingCurrentMonth = history.find((entry) => entry.month === currentMonth);
      history = saveMonthlyPurchaseMix(
        {
          month: currentMonth,
          commonLiters: monthMix.commonLiters,
          additiveLiters: monthMix.additiveLiters,
          percentage: monthMix.percentage,
          closedAt: existingCurrentMonth?.closedAt ?? new Date().toISOString(),
        },
        true,
      );
    }
    setMixHistory(history);
  }, [currentDate, currentMonth, deliveries, monthMix, s.tanks]);
  const recentMix = calculatePurchaseMix(
    deliveries,
    s.tanks,
    (delivery) => delivery.date >= firstRecentDate && delivery.date <= currentDate,
  );
  const generalMix = calculatePurchaseMix(deliveries, s.tanks);
  const evolution = buildPurchaseMixEvolution(deliveries, s.tanks);
  const parsedMetaMix = parse(metaMix) ?? 0;

  const save = () => {
    if (!canSave) return;
    const items: DeliveryItem[] = drafts.flatMap((draft) =>
      distributionForDraft(draft)
        .filter(({ liters }) => liters > 0)
        .map(({ tank, liters }) => ({
          fuel: draft.fuel,
          tankId: tank.id,
          qty: liters,
          temperatura: parse(draft.temperatura),
          densidade: parse(draft.densidade),
          densidade20: parse(draft.densidade20),
          teorAlcoolico: isEtanol(draft.fuel) ? parse(draft.teorAlcoolico) : undefined,
          etanolPct: isGasolina(draft.fuel) ? parse(draft.etanolPct) : undefined,
          fulgor: isDiesel(draft.fuel) ? parse(draft.fulgor) : undefined,
        })),
    );
    if (items.length === 0) return;
    const newDelivery = {
      date,
      distribuidora: distribuidora.trim(),
      nf: nf.trim(),
      totalNota: total,
      motorista: motorista.trim(),
      rgMotorista: rgMotorista.trim(),
      placaCaminhao: placaCaminhao.trim(),
      responsavelAnalise: responsavelAnalise.trim(),
      items,
    };
    const updatedMonthMix = calculatePurchaseMix(
      [...deliveries, { ...newDelivery, id: "preview", createdAt: new Date().toISOString() }],
      s.tanks,
      (delivery) => delivery.date.startsWith(currentMonth),
    );
    actions.addDelivery(newDelivery);
    toast.success(
      `Recebimento salvo! Novo Mix de Compra: ${formatMix(updatedMonthMix.percentage)}`,
    );
    setDistribuidora("");
    setNf("");
    setDrafts([emptyDraft()]);
  };

  return (
    <AppShell title="Recebimento Combustível" subtitle="Notas fiscais e análise da descarga">
      <Toaster position="top-right" />
      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">MIX DE COMPRA - GASOLINA</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground">COMUM</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
              {fmtL(monthMix.commonLiters)}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground">ADITIVADA</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
              {fmtL(monthMix.additiveLiters)}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground">MIX ADITIVADA</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-orange-600">
              {formatMix(monthMix.percentage)}
            </p>
          </div>
        </div>
        {monthMix.totalGasolineLiters === 0 ? (
          <p className="mt-4 text-center text-sm font-bold text-muted-foreground">
            SEM COMPRAS NESTE MÊS - MIX 0,0%
          </p>
        ) : null}
        <div
          className="relative mt-4 flex h-8 overflow-hidden rounded-full bg-gray-300"
          role="img"
          aria-label={`COMUM ${formatMix(100 - monthMix.percentage)}, ADITIVADA ${formatMix(monthMix.percentage)}`}
        >
          <div
            className="h-full bg-orange-500 transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, monthMix.percentage))}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-black">
            {formatMix(monthMix.percentage)}
          </span>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">HISTÓRICO MENSAL DO MIX</h2>
        {mixHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            NENHUM MÊS FECHADO COM COMPRAS DE GASOLINA.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2">MÊS</th>
                  <th className="p-2">COMUM</th>
                  <th className="p-2">ADITIVADA</th>
                  <th className="p-2">MIX FINAL</th>
                  <th className="p-2">DATA DE FECHAMENTO</th>
                </tr>
              </thead>
              <tbody>
                {mixHistory.map((entry) => {
                  const [year, month] = entry.month.split("-").map(Number);
                  const monthLabel = new Date(year ?? 2000, (month ?? 1) - 1).toLocaleDateString(
                    "pt-BR",
                    { month: "long", year: "numeric" },
                  );
                  return (
                    <tr key={entry.month} className="border-b last:border-0">
                      <td className="p-2 font-semibold">{monthLabel.toLocaleUpperCase("pt-BR")}</td>
                      <td className="p-2 tabular-nums">{fmtL(entry.commonLiters)}</td>
                      <td className="p-2 tabular-nums">{fmtL(entry.additiveLiters)}</td>
                      <td className="p-2 font-bold tabular-nums text-orange-600">
                        {formatMix(entry.percentage)}
                      </td>
                      <td className="p-2">{formatBR(entry.closedAt.slice(0, 10))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">MIX DE COMPRA - MÊS ATUAL</h2>
          <p className="mt-2 font-display text-3xl text-[#7c3aed]">
            {formatMix(monthMix.percentage)}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#7c3aed] transition-all"
              style={{ width: `${Math.min(100, monthMix.percentage)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {fmtL(monthMix.additiveLiters)} Aditivada de {fmtL(monthMix.totalGasolineLiters)} Total
          </p>
        </article>

        <article className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">MIX DE COMPRA - ÚLTIMOS 30 DIAS</h2>
          <p className="mt-2 font-display text-3xl text-[#7c3aed]">
            {formatMix(recentMix.percentage)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {fmtL(recentMix.additiveLiters)} Aditivada de {fmtL(recentMix.totalGasolineLiters)}{" "}
            Total
          </p>
        </article>

        <article className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">META MIX</h2>
          <div className="mt-2 flex items-center gap-2">
            <Input
              aria-label="Meta do mix de compra"
              className="w-28"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={metaMix}
              onChange={(event) => {
                setMetaMix(event.target.value);
                window.localStorage.setItem(META_MIX_KEY, event.target.value);
              }}
            />
            <span className="font-bold text-foreground">%</span>
          </div>
          <p
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold text-white ${
              monthMix.percentage >= parsedMetaMix ? "bg-green-600" : "bg-orange-500"
            }`}
          >
            {monthMix.percentage >= parsedMetaMix
              ? "META BATIDA"
              : `Falta ${formatMix(parsedMetaMix - monthMix.percentage)}`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Mix geral: {formatMix(generalMix.percentage)}
          </p>
        </article>
      </section>

      <section className="mb-5 rounded-xl border border-[#7c3aed]/50 bg-card p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">
          Evolução do Mix por Recebimento
        </h2>
        {evolution.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum recebimento de gasolina comum ou aditivada registrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2">Data</th>
                  <th className="p-2">Qtd Comum</th>
                  <th className="p-2">Qtd Aditivada</th>
                  <th className="p-2">Mix Acumulado</th>
                  <th className="p-2">Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {[...evolution].reverse().map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="p-2">{formatBR(entry.date)}</td>
                    <td className="p-2 tabular-nums">{fmtL(entry.commonLiters)}</td>
                    <td className="p-2 tabular-nums">{fmtL(entry.additiveLiters)}</td>
                    <td className="p-2 font-semibold tabular-nums text-[#7c3aed]">
                      {formatMix(entry.accumulatedPercentage)}
                    </td>
                    <td className="p-2">{entry.supplier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                    value={d.fuel}
                    onChange={(e) =>
                      setDraft(i, { fuel: e.target.value, qty: "", distribution: {} })
                    }
                    className="h-9 flex-1 rounded-md border border-input bg-card px-2 text-sm text-foreground"
                    required
                  >
                    <option value="">Selecione o combustível</option>
                    {fuelOptions
                      .filter(
                        (fuel) =>
                          fuel === d.fuel ||
                          !drafts.some(
                            (other, otherIndex) => otherIndex !== i && other.fuel === fuel,
                          ),
                      )
                      .map((fuel) => (
                        <option key={fuel} value={fuel}>
                          {fuel}
                        </option>
                      ))}
                  </select>
                  {drafts.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item do recebimento"
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
                    <Label>
                      {tanksForFuel(d.fuel).length > 1
                        ? "Total da nota (L)"
                        : "Quantidade recebida (L)"}
                    </Label>
                    <Input
                      inputMode="decimal"
                      value={d.qty}
                      onChange={(e) => setDraft(i, { qty: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <Label>TOTAL RECEBIDO</Label>
                    <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                      {fmtL(
                        distributionForDraft(d).reduce(
                          (sum, allocation) => sum + allocation.liters,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  {tanksForFuel(d.fuel).length > 1 ? (
                    <div className="col-span-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-bold text-amber-900">
                        ESTE COMBUSTÍVEL POSSUI {tanksForFuel(d.fuel).length} TANQUES. INFORME
                        QUANTO FOI PARA CADA TANQUE:
                      </p>
                      {tanksForFuel(d.fuel).map((tank) => {
                        const tankIndex = s.tanks.findIndex((item) => item.id === tank.id) + 1;
                        const current = currentTankLevel(tank.id);
                        return (
                          <div
                            key={tank.id}
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center"
                          >
                            <Label htmlFor={`delivery-${i}-${tank.id}`} className="text-xs">
                              TANQUE {String(tankIndex).padStart(2, "0")} —{" "}
                              {tank.name.toUpperCase()}
                              {" · ATUAL: "}
                              {current === undefined ? "SEM MEDIÇÃO" : fmtL(current)}
                              {" / "}
                              {fmtL(tank.capacity)}
                            </Label>
                            <Input
                              id={`delivery-${i}-${tank.id}`}
                              inputMode="decimal"
                              value={d.distribution[tank.id] ?? ""}
                              onChange={(event) =>
                                setDraft(i, {
                                  distribution: {
                                    ...d.distribution,
                                    [tank.id]: event.target.value,
                                  },
                                })
                              }
                              placeholder="Litros"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
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
          <Button variant="outline" onClick={() => setDrafts((ds) => [...ds, emptyDraft()])}>
            <Plus className="mr-1 size-4" /> Combustível
          </Button>
          <p className="text-right text-sm text-muted-foreground">TOTAL DA NOTA: {fmtL(total)}</p>
        </div>

        <Button className="mt-3 w-full" disabled={!canSave} onClick={save}>
          <Truck className="mr-2 size-4" /> Salvar recebimento
        </Button>
        {draftErrors.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs font-semibold text-destructive" role="alert">
            {draftErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
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
                    NF {d.nf} · {formatBR(d.date)} · TOTAL{" "}
                    {fmtL(d.totalNota ?? d.items.reduce((sum, item) => sum + item.qty, 0))}
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
                          {it.tankId
                            ? `TANQUE ${String(s.tanks.findIndex((tank) => tank.id === it.tankId) + 1).padStart(2, "0")} — ${it.fuel}`
                            : it.fuel}
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
              <DeliveryExportButtons delivery={d} state={s} />
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
