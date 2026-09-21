import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Gauge, Plus, Share2, Trash2 } from "lucide-react";
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
  type AppState,
  type Calibration,
  type CalibrationItem,
} from "@/lib/store";
import { afericaoFileName, buildAfericaoPdf } from "@/lib/afericao-pdf";

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

const sanitizeAfericaoInput = (value: string) => {
  const sign = value.trimStart().startsWith("-") ? "-" : "";
  return `${sign}${value.replace(/[^0-9]/g, "")}`;
};

const parseAfericao = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-") return undefined;
  const number = Number(trimmed);
  return Number.isInteger(number) ? number : undefined;
};

const allowedMessage = (values: number[]) =>
  `Valor não permitido. Informe um valor entre ${Math.min(...values)} e ${Math.max(...values)}.`;

const isInvalidAfericao = (value: string, allowed: number[]) => {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const parsed = parseAfericao(trimmed);
  if (parsed === undefined || allowed.length !== 2) return true;
  return parsed < Math.min(...allowed) || parsed > Math.max(...allowed);
};

function Stamp({ approved }: { approved: boolean }) {
  return (
    <div
      className={`inline-flex -rotate-6 items-center justify-center rounded-lg border-4 px-4 py-2 font-display text-lg uppercase tracking-widest ${
        approved
          ? "border-[var(--aprovado)] text-[var(--aprovado)]"
          : "border-destructive text-destructive"
      }`}
      style={{ boxShadow: "inset 0 0 0 2px currentColor" }}
    >
      {approved ? "Aferição aprovada" : "Aferição reprovada"}
    </div>
  );
}

function ExportButtons({ state, calibration }: { state: AppState; calibration: Calibration }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const gerar = () => buildAfericaoPdf(state, calibration);

  // Prepara o arquivo antes do toque, para que o compartilhamento
  // aconteça no mesmo gesto do usuário (exigência dos navegadores).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const blob = await buildAfericaoPdf(state, calibration);
        if (alive)
          fileRef.current = new File([blob], afericaoFileName(calibration), {
            type: "application/pdf",
          });
      } catch {
        /* ignora — o botão gera novamente se preciso */
      }
    })();
    return () => {
      alive = false;
    };
  }, [state, calibration]);

  const baixar = async () => {
    setBusy(true);
    try {
      const blob = await gerar();
      const name = afericaoFileName(calibration);
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

  const enviarWhatsApp = () => {
    const name = afericaoFileName(calibration);
    const nav = navigator as Navigator & {
      canShare?: (d: { files?: File[] }) => boolean;
    };
    const cached = fileRef.current;

    // Caminho principal: arquivo já pronto, compartilhado no mesmo toque.
    if (cached && nav.share && nav.canShare?.({ files: [cached] })) {
      setStatus("Escolha o WhatsApp na tela de compartilhamento.");
      // Somente o arquivo: com texto junto, o WhatsApp descarta o anexo.
      nav.share({ files: [cached] }).catch(() => setStatus(null));
      return;
    }

    void (async () => {
      setBusy(true);
      try {
        const blob = await gerar();
        const file = new File([blob], name, { type: "application/pdf" });
        fileRef.current = file;
        if (nav.share && nav.canShare?.({ files: [file] })) {
          try {
            await nav.share({ files: [file] });
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
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        window.open(
          `https://wa.me/?text=${encodeURIComponent(
            `Aferição do Posto 10 — ${formatBR(calibration.date)}. Anexe o arquivo ${name} salvo no aparelho.`,
          )}`,
          "_blank",
        );
        setStatus(`O PDF ${name} foi salvo — anexe-o na conversa do WhatsApp.`);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" disabled={busy} onClick={() => void enviarWhatsApp()}>
          <Share2 className="size-4" /> WhatsApp
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void baixar()}>
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

function AfericaoPage() {
  const state = useAppState();
  const nozzles = state.nozzles ?? [];
  const calibrations = state.calibrations ?? [];
  const tanks = state.tanks;

  const [tab, setTab] = useState<"aferir" | "parametros" | "historico">("aferir");
  const [nozzleForm, setNozzleForm] = useState({ name: "", fuel: "" });
  const [nozzleError, setNozzleError] = useState<string | null>(null);
  const [negativeParameter, setNegativeParameter] = useState("");
  const [positiveParameter, setPositiveParameter] = useState("");
  const [parameterError, setParameterError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [values, setValues] = useState<Record<string, { lenta: string; rapida: string }>>({});

  useEffect(() => setDate(todayISO()), []);
  useEffect(() => {
    const negative = state.allowedAfericoes.find((value) => value < 0);
    const positive = state.allowedAfericoes.find((value) => value > 0);
    setNegativeParameter(negative === undefined ? "" : String(negative));
    setPositiveParameter(positive === undefined ? "" : String(positive));
  }, [state.allowedAfericoes]);

  const items: CalibrationItem[] = useMemo(
    () =>
      nozzles.map((n) => ({
        nozzleId: n.id,
        lenta: parseAfericao(values[n.id]?.lenta ?? ""),
        rapida: parseAfericao(values[n.id]?.rapida ?? ""),
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
  const approved = calibrationApproved(preview, state.allowedAfericoes);

  const setVal = (id: string, key: "lenta" | "rapida", v: string) =>
    setValues((prev) => ({
      ...prev,
      [id]: {
        lenta: prev[id]?.lenta ?? "",
        rapida: prev[id]?.rapida ?? "",
        [key]: sanitizeAfericaoInput(v),
      },
    }));

  const [saveError, setSaveError] = useState<string | null>(null);

  const save = () => {
    if (!date) {
      setSaveError("Informe a data da aferição.");
      return;
    }
    if (!responsavel.trim()) {
      setSaveError("Informe o nome do responsável pela aferição.");
      return;
    }
    if (state.allowedAfericoes.length !== 2) {
      setSaveError("Configure um parâmetro negativo e outro positivo na aba Parâmetros.");
      return;
    }
    if (
      nozzles.some(
        (nozzle) => !tanks.some((tank) => tank.id === nozzle.tankId || tank.name === nozzle.fuel),
      )
    ) {
      setSaveError("Informe o tanque de origem em todos os bicos na aba Parâmetros.");
      return;
    }
    const invalid = Object.values(values).some((value) =>
      [value.lenta, value.rapida].some((item) => {
        const trimmed = item.trim();
        const parsed = parseAfericao(trimmed);
        if (trimmed === "") return false;
        if (parsed === undefined || state.allowedAfericoes.length !== 2) return true;
        const minimum = Math.min(...state.allowedAfericoes);
        const maximum = Math.max(...state.allowedAfericoes);
        return parsed < minimum || parsed > maximum;
      }),
    );
    if (invalid) {
      setSaveError(allowedMessage(state.allowedAfericoes));
      return;
    }
    if (!filled) {
      setSaveError("Informe pelo menos um resultado de vazão lenta ou rápida.");
      return;
    }
    setSaveError(null);
    actions.addCalibration({
      date,
      responsavel: responsavel.trim(),
      items: items.filter((i) => i.lenta !== undefined || i.rapida !== undefined),
    });
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
            ["parametros", "Parâmetros"],
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

      {tab === "parametros" ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="font-display text-lg text-foreground">
                Configurar Parâmetros de Aferição
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure exatamente dois resultados permitidos em ml: um negativo e um positivo.
                Ambos devem estar entre -200 e +200. A vazão lenta e a vazão rápida usam estes
                parâmetros no lançamento.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Parâmetro negativo</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  placeholder="Ex.: -50"
                  value={negativeParameter}
                  onChange={(e) => {
                    setNegativeParameter(sanitizeAfericaoInput(e.target.value));
                    setParameterError(null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Parâmetro positivo</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  placeholder="Ex.: 50"
                  value={positiveParameter}
                  onChange={(e) => {
                    setPositiveParameter(sanitizeAfericaoInput(e.target.value));
                    setParameterError(null);
                  }}
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const negative = parseAfericao(negativeParameter);
                const positive = parseAfericao(positiveParameter);
                if (
                  negative === undefined ||
                  negative >= 0 ||
                  negative < -200 ||
                  negative > 200 ||
                  positive === undefined ||
                  positive <= 0 ||
                  positive < -200 ||
                  positive > 200
                ) {
                  setParameterError(
                    "Configure um valor negativo e outro positivo entre -200 e +200",
                  );
                  return;
                }
                if (negative === positive) {
                  setParameterError("Os parâmetros devem ser diferentes.");
                  return;
                }
                actions.setAllowedAfericoes([negative, positive]);
                setParameterError(null);
              }}
            >
              Salvar parâmetros
            </Button>
            {parameterError ? <p className="text-xs text-destructive">{parameterError}</p> : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg text-foreground">Parâmetros configurados</p>
            {state.allowedAfericoes.length === 2 ? (
              <p className="text-sm tabular-nums text-foreground">
                Negativo: {state.allowedAfericoes[0]} · Positivo: {state.allowedAfericoes[1]}
              </p>
            ) : (
              <p className="text-sm text-destructive">
                Configure os dois parâmetros para liberar o lançamento de aferições.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Aferições são testes de medição: o combustível sai e retorna ao mesmo tanque e não
              gera perda, falta ou venda no estoque.
            </p>
          </div>
        </section>
      ) : null}

      {tab === "parametros" ? (
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
                <Label>Tanque de origem / combustível</Label>
                <select
                  value={nozzleForm.fuel}
                  onChange={(e) => {
                    setNozzleForm((f) => ({ ...f, fuel: e.target.value }));
                    setNozzleError(null);
                  }}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  required
                >
                  <option value="">Selecione o tanque</option>
                  {tanks.map((tank, index) => (
                    <option key={tank.id} value={tank.name}>
                      Tanque {index + 1} — {tank.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const fuel = nozzleForm.fuel.trim();
                const tank = tanks.find((item) => item.name === fuel);
                if (!tank) {
                  setNozzleError("Informe o tanque de onde o combustível será retirado.");
                  return;
                }
                actions.addNozzle({
                  name: nozzleForm.name.trim() || `Bico ${nozzles.length + 1}`,
                  fuel,
                  tankId: tank.id,
                });
                setNozzleForm({ name: "", fuel: "" });
                setNozzleError(null);
              }}
            >
              <Plus className="size-4" /> Adicionar bico
            </Button>
            {tanks.length === 0 ? (
              <p className="text-xs text-destructive">
                Cadastre ao menos um tanque antes de cadastrar um bico.
              </p>
            ) : null}
            {nozzleError ? <p className="text-xs text-destructive">{nozzleError}</p> : null}
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
                    value={tanks.find((tank) => tank.id === n.tankId)?.id ?? ""}
                    onChange={(e) => {
                      const tank = tanks.find((item) => item.id === e.target.value);
                      if (tank) actions.updateNozzle(n.id, { fuel: tank.name, tankId: tank.id });
                    }}
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    style={{ color: fuelColor(state, n.fuel) ?? undefined }}
                    aria-label={`Combustível do ${n.name}`}
                  >
                    <option value="">Selecionar tanque</option>
                    {tanks.map((tank, index) => (
                      <option key={tank.id} value={tank.id}>
                        Tanque {index + 1} — {tank.name}
                      </option>
                    ))}
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
              Cadastre os bicos na aba "Parâmetros" para iniciar a aferição.
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
                        inputMode="numeric"
                        pattern="-?[0-9]*"
                        placeholder="0"
                        value={values[n.id]?.lenta ?? ""}
                        onChange={(e) => setVal(n.id, "lenta", e.target.value)}
                        aria-invalid={
                          values[n.id]?.lenta.trim() !== "" &&
                          isInvalidAfericao(values[n.id]?.lenta ?? "", state.allowedAfericoes)
                        }
                      />
                      {values[n.id]?.lenta.trim() !== "" &&
                      isInvalidAfericao(values[n.id]?.lenta ?? "", state.allowedAfericoes) ? (
                        <p className="text-xs text-destructive">
                          {allowedMessage(state.allowedAfericoes)}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vazão rápida (ml)</Label>
                      <Input
                        inputMode="numeric"
                        pattern="-?[0-9]*"
                        placeholder="0"
                        value={values[n.id]?.rapida ?? ""}
                        onChange={(e) => setVal(n.id, "rapida", e.target.value)}
                        aria-invalid={
                          values[n.id]?.rapida.trim() !== "" &&
                          isInvalidAfericao(values[n.id]?.rapida ?? "", state.allowedAfericoes)
                        }
                      />
                      {values[n.id]?.rapida.trim() !== "" &&
                      isInvalidAfericao(values[n.id]?.rapida ?? "", state.allowedAfericoes) ? (
                        <p className="text-xs text-destructive">
                          {allowedMessage(state.allowedAfericoes)}
                        </p>
                      ) : null}
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

              <div className="sticky bottom-2 space-y-2">
                {saveError ? (
                  <p className="rounded-lg border border-destructive/50 bg-card p-2 text-center text-xs text-destructive">
                    {saveError}
                  </p>
                ) : null}
                <Button className="h-12 w-full text-base" onClick={save}>
                  Salvar aferição
                </Button>
              </div>
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
                  <Stamp approved={calibrationApproved(c, state.allowedAfericoes)} />
                </div>

                <div className="mb-3 text-sm">
                  {c.items
                    .filter((i) => i.lenta !== undefined || i.rapida !== undefined)
                    .map((i) => (
                      <div
                        key={i.nozzleId}
                        className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {nozzleName(i.nozzleId)}
                          <span
                            style={{
                              color:
                                fuelColor(state, nozzleFuel(i.nozzleId)) ??
                                "var(--muted-foreground)",
                            }}
                          >
                            {" · "}
                            {nozzleFuel(i.nozzleId)}
                          </span>
                        </span>

                        <span className="tabular-nums text-muted-foreground">
                          L: {i.lenta ?? "—"} / R: {i.rapida ?? "—"}
                        </span>
                      </div>
                    ))}
                </div>

                <ExportButtons state={state} calibration={c} />
              </div>
            ))
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
