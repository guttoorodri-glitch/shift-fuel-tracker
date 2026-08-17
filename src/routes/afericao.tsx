import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Gauge, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actions,
  calibrationApproved,
  fuelColor,
  formatBR,
  todayISO,
  useAppState,
  type Calibration,
  type CalibrationItem,
} from "@/lib/store";

export const Route = createFileRoute("/afericao")({
  head: () => ({
    meta: [
      { title: "Aferição de Bicos — Posto 10" },
      {
        name: "description",
        content:
          "Cadastre os bicos do posto e registre a aferição na vazão lenta e rápida com carimbo de aprovação automático.",
      },
      { property: "og:title", content: "Aferição de Bicos — Posto 10" },
      {
        property: "og:description",
        content: "Aferição de bicos com resultado aprovado ou reprovado por bico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AfericaoPage,
});

const parse = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? undefined : n;
};

function Stamp({ approved }: { approved: boolean }) {
  return (
    <div
      className={`inline-flex -rotate-6 items-center justify-center rounded-lg border-4 px-4 py-2 font-display text-lg uppercase tracking-widest ${
        approved
          ? "border-[var(--folga)] text-[var(--folga)]"
          : "border-destructive text-destructive"
      }`}
      style={{ boxShadow: "inset 0 0 0 2px currentColor" }}
    >
      {approved ? "Aferição aprovada" : "Aferição reprovada"}
    </div>
  );
}

function AfericaoPage() {
  const state = useAppState();
  const nozzles = state.nozzles ?? [];
  const calibrations = state.calibrations ?? [];
  const tankNames = state.tanks.map((t) => t.name);


  const [tab, setTab] = useState<"aferir" | "bicos" | "historico">("aferir");
  const [nozzleForm, setNozzleForm] = useState({ name: "", fuel: "" });

  const [date, setDate] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [values, setValues] = useState<Record<string, { lenta: string; rapida: string }>>({});

  useEffect(() => setDate(todayISO()), []);

  const items: CalibrationItem[] = useMemo(
    () =>
      nozzles.map((n) => ({
        nozzleId: n.id,
        lenta: parse(values[n.id]?.lenta ?? ""),
        rapida: parse(values[n.id]?.rapida ?? ""),
      })),
    [nozzles, values],
  );

  const filled = items.some((i) => i.lenta !== undefined || i.rapida !== undefined);
  const preview: Calibration = {
    id: "preview",
    date,
    responsavel,
    items,
    createdAt: "",
  };
  const approved = calibrationApproved(preview);

  const setVal = (id: string, key: "lenta" | "rapida", v: string) =>
    setValues((prev) => ({
      ...prev,
      [id]: { lenta: prev[id]?.lenta ?? "", rapida: prev[id]?.rapida ?? "", [key]: v },
    }));

  const save = () => {
    if (!responsavel.trim() || !filled) return;
    actions.addCalibration({ date, responsavel: responsavel.trim(), items });
    setValues({});
    setResponsavel("");
    setTab("historico");
  };

  const nozzleName = (id: string) => nozzles.find((n) => n.id === id)?.name ?? "Bico";
  const nozzleFuel = (id: string) => nozzles.find((n) => n.id === id)?.fuel ?? "";

  return (
    <AppShell title="Aferição" subtitle="Bicos, vazão lenta e rápida">
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            ["aferir", "Aferir"],
            ["bicos", "Bicos"],
            ["historico", "Histórico"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bicos" ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="font-display text-lg text-foreground">Cadastrar bico</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bico</Label>
                <Input
                  placeholder={`Bico ${nozzles.length + 1}`}
                  value={nozzleForm.name}
                  onChange={(e) => setNozzleForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Combustível</Label>
                <Input
                  placeholder="Ex.: Etanol"
                  value={nozzleForm.fuel}
                  onChange={(e) => setNozzleForm((f) => ({ ...f, fuel: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const fuel = nozzleForm.fuel.trim();
                if (!fuel) return;
                actions.addNozzle({
                  name: nozzleForm.name.trim() || `Bico ${nozzles.length + 1}`,
                  fuel,
                });
                setNozzleForm({ name: "", fuel: "" });
              }}
            >
              <Plus className="size-4" /> Adicionar bico
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg text-foreground">
              Bicos cadastrados ({nozzles.length})
            </p>
            {nozzles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum bico cadastrado ainda.</p>
            ) : (
              nozzles.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 border-b border-border/60 py-3 last:border-0"
                >
                  <Gauge
                    className="size-4 shrink-0"
                    style={{ color: fuelColor(state, n.fuel) ?? "var(--muted-foreground)" }}
                  />
                  <Input
                    value={n.name}
                    onChange={(e) => actions.updateNozzle(n.id, { name: e.target.value })}
                    className="h-9 w-24 shrink-0"
                  />
                  <select
                    value={tankNames.includes(n.fuel) ? n.fuel : "__custom"}
                    onChange={(e) => {
                      if (e.target.value !== "__custom")
                        actions.updateNozzle(n.id, { fuel: e.target.value });
                    }}
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    style={{ color: fuelColor(state, n.fuel) ?? undefined }}
                    aria-label={`Combustível do ${n.name}`}
                  >
                    {tankNames.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {tankNames.includes(n.fuel) ? null : (
                      <option value="__custom">{n.fuel || "Selecionar"}</option>
                    )}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 text-destructive"
                    aria-label={`Excluir ${n.name}`}
                    onClick={() => actions.removeNozzle(n.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}


      {tab === "aferir" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input
                placeholder="Nome"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              />
            </div>
          </div>

          {nozzles.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Cadastre os bicos na aba "Bicos" para iniciar a aferição.
            </p>
          ) : (
            <div className="space-y-3">
              {nozzles.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-border bg-card p-4 border-l-4"
                  style={{ borderLeftColor: fuelColor(state, n.fuel) ?? "var(--border)" }}
                >
                  <p className="font-display text-lg text-foreground">{n.name}</p>
                  <p
                    className="mb-3 text-[11px] uppercase tracking-widest"
                    style={{ color: fuelColor(state, n.fuel) ?? "var(--muted-foreground)" }}
                  >
                    {n.fuel}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Vazão lenta (ml)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={values[n.id]?.lenta ?? ""}
                        onChange={(e) => setVal(n.id, "lenta", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vazão rápida (ml)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={values[n.id]?.rapida ?? ""}
                        onChange={(e) => setVal(n.id, "rapida", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {filled ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5">
                  <Stamp approved={approved} />
                  <p className="text-center text-xs text-muted-foreground">
                    Padrão aceito: entre -100 e +100 ml em todas as medições.
                  </p>
                </div>
              ) : null}

              <Button
                className="w-full"
                disabled={!filled || !responsavel.trim()}
                onClick={save}
              >
                Salvar aferição
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {tab === "historico" ? (
        <section className="space-y-3">
          {calibrations.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Nenhuma aferição registrada.
            </p>
          ) : (
            calibrations.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg text-foreground">{formatBR(c.date)}</p>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Resp.: {c.responsavel}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 text-destructive"
                    aria-label="Excluir aferição"
                    onClick={() => actions.removeCalibration(c.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="mb-3 flex justify-center">
                  <Stamp approved={calibrationApproved(c)} />
                </div>

                <div className="text-sm">
                  {c.items
                    .filter((i) => i.lenta !== undefined || i.rapida !== undefined)
                    .map((i) => (
                      <div
                        key={i.nozzleId}
                        className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {nozzleName(i.nozzleId)}
                          <span className="text-muted-foreground"> · {nozzleFuel(i.nozzleId)}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          L: {i.lenta ?? "—"} / R: {i.rapida ?? "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
