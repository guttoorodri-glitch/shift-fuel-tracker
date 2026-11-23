import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  actions,
  todayISO,
  useAppState,
  type ChecklistFrequency,
  type ChecklistItem,
} from "@/lib/store";

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [
      { title: "CHECK LIST — Posto 10" },
      {
        name: "description",
        content: "Verificações diárias e periódicas de operação, segurança e gestão do posto.",
      },
      { property: "og:title", content: "CHECK LIST — Posto 10" },
      {
        property: "og:description",
        content: "Checklist editável de operação, segurança e conformidade do posto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChecklistPage,
});

const frequencies: Array<{
  id: ChecklistFrequency;
  label: string;
  shortLabel: string;
}> = [
  { id: "diario", label: "DIÁRIO", shortLabel: "HOJE" },
  { id: "semanal", label: "SEMANAL", shortLabel: "SEMANA" },
  { id: "mensal", label: "MENSAL", shortLabel: "MÊS" },
  { id: "trimestral", label: "A CADA 3 MESES", shortLabel: "3 MESES" },
  { id: "semestral", label: "A CADA 6 MESES", shortLabel: "6 MESES" },
];

const noChecklistItems: ChecklistItem[] = [];

function addPhotoWatermark(file: File): Promise<{ fotoUrl: string; fotoDataHora: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("A imagem não retornou um arquivo válido."));
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error("Falha ao processar a imagem."));
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const fotoDataHora = new Date().toLocaleString("pt-BR");
        const watermarkHeight = Math.min(80, canvas.height);
        const textPadding = Math.min(20, Math.max(8, canvas.width * 0.016));
        context.fillStyle = "rgba(0,0,0,0.5)";
        context.fillRect(0, canvas.height - watermarkHeight, canvas.width, watermarkHeight);
        context.fillStyle = "white";
        context.font = `bold ${Math.max(14, canvas.width * 0.04)}px Arial`;
        context.textBaseline = "alphabetic";
        context.fillText(
          "POSTO 10",
          textPadding,
          canvas.height - Math.min(45, watermarkHeight * 0.55),
        );
        context.font = `${Math.max(11, canvas.width * 0.03)}px Arial`;
        context.fillText(
          fotoDataHora,
          textPadding,
          canvas.height - Math.min(15, watermarkHeight * 0.15),
        );
        resolve({ fotoUrl: canvas.toDataURL("image/jpeg", 0.8), fotoDataHora });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function cycleKey(frequency: ChecklistFrequency, iso = todayISO()) {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  if (frequency === "diario") return iso;
  if (frequency === "mensal") return iso.slice(0, 7);
  if (frequency === "trimestral") return `${year}-T${Math.floor((month - 1) / 3) + 1}`;
  if (frequency === "semestral") return `${year}-S${month <= 6 ? 1 : 2}`;
  const date = new Date(year, month - 1, day);
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const emptyForm = {
  title: "",
  frequency: "diario" as ChecklistFrequency,
  requirement: "recomendado" as ChecklistItem["requirement"],
  requerFoto: false,
};

function ChecklistPage() {
  const state = useAppState();
  const items = state.checklistItems ?? noChecklistItems;
  const checks = state.checklistChecks ?? {};
  const [active, setActive] = useState<ChecklistFrequency>("diario");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const visible = items.filter((item) => item.frequency === active);
  const currentKey = cycleKey(active);
  const complete = visible.filter((item) => checks[item.id] === currentKey).length;
  const percent = visible.length ? Math.round((complete / visible.length) * 100) : 0;

  const closeForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setFormOpen(false);
  };

  const save = () => {
    const title = form.title.trim();
    if (!title) return;
    if (editing) actions.updateChecklistItem(editing, { ...form, title });
    else actions.addChecklistItem({ ...form, title });
    setActive(form.frequency);
    closeForm();
  };

  const edit = (item: ChecklistItem) => {
    setForm({
      title: item.title,
      frequency: item.frequency,
      requirement: item.requirement,
      requerFoto: item.requerFoto,
    });
    setEditing(item.id);
    setFormOpen(true);
  };

  const savePhoto = (item: ChecklistItem, file?: File) => {
    if (!file) return;
    void addPhotoWatermark(file)
      .then(({ fotoUrl, fotoDataHora }) => {
        actions.updateChecklistItem(item.id, { fotoUrl, fotoDataHora });
        toast.success(`FOTO SALVA PARA: ${item.title.toLocaleUpperCase("pt-BR")}`);
      })
      .catch(() => {
        toast.error("NÃO FOI POSSÍVEL PROCESSAR A FOTO. TENTE NOVAMENTE.");
      });
  };

  const toggleItem = (item: ChecklistItem, checked: boolean) => {
    if (!checked && item.requerFoto && !item.fotoUrl) {
      toast.error("ESTA TAREFA EXIGE FOTO COMPROBATÓRIA! TIRE A FOTO ANTES DE CONCLUIR.");
      return;
    }
    actions.toggleChecklistItem(item.id, currentKey);
  };

  return (
    <AppShell title="CHECK LIST" subtitle="Rotina do gerente">
      <Toaster position="top-right" />
      <div className="mb-4 grid grid-cols-5 gap-1 rounded-lg bg-muted p-1">
        {frequencies.map((frequency) => (
          <Button
            key={frequency.id}
            size="sm"
            variant={active === frequency.id ? "default" : "ghost"}
            className="h-auto min-w-0 px-1 py-2 text-[10px] leading-tight"
            onClick={() => setActive(frequency.id)}
          >
            {frequency.shortLabel}
          </Button>
        ))}
      </div>

      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl text-foreground">
              {frequencies.find((frequency) => frequency.id === active)?.label}
            </h1>
            <p className="text-xs text-muted-foreground">
              {complete} DE {visible.length} CONCLUÍDOS NESTE CICLO
            </p>
          </div>
          <span className="shrink-0 font-display text-2xl text-primary">{percent}%</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="PROGRESSO DO CHECKLIST"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      {formOpen ? (
        <ChecklistForm
          form={form}
          editing={editing !== null}
          onChange={setForm}
          onSave={save}
          onClose={closeForm}
        />
      ) : (
        <Button
          className="mb-4 w-full"
          onClick={() => {
            setForm({ ...emptyForm, frequency: active });
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> ADICIONAR VERIFICAÇÃO
        </Button>
      )}

      <ul className="grid gap-2">
        {visible.map((item) => {
          const checked = checks[item.id] === currentKey;
          const hasPhoto = Boolean(item.fotoUrl);
          return (
            <li
              key={item.id}
              className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span
                title={
                  item.requerFoto && !hasPhoto ? "TIRE A FOTO COMPROBATÓRIA PRIMEIRO" : undefined
                }
                onClick={() => {
                  if (item.requerFoto && !hasPhoto && !checked) toggleItem(item, checked);
                }}
              >
                <Button
                  size="icon"
                  variant={checked ? "default" : "outline"}
                  disabled={!checked && item.requerFoto && !hasPhoto}
                  className={`mt-0.5 size-9 shrink-0 ${
                    checked
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : item.requerFoto && !hasPhoto
                        ? "pointer-events-none cursor-not-allowed opacity-50"
                        : ""
                  }`}
                  onClick={() => toggleItem(item, checked)}
                  aria-label={checked ? "DESMARCAR VERIFICAÇÃO" : "MARCAR VERIFICAÇÃO"}
                >
                  <Check className={`size-5 ${checked ? "opacity-100" : "opacity-20"}`} />
                </Button>
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm leading-snug text-foreground ${checked ? "line-through opacity-60" : ""}`}
                >
                  {item.title.toLocaleUpperCase("pt-BR")}
                </p>
                {item.requerFoto ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                    <Camera className="size-3" /> 📸 EXIGE FOTO
                  </span>
                ) : null}
                <RequirementBadge requirement={item.requirement} />
                {item.requerFoto ? (
                  <div className="mt-2 space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#b7791f] bg-[#b7791f] px-3 py-2 text-xs font-bold text-white">
                      <Camera className="size-4" /> 📸 TIRAR FOTO OBRIGATÓRIA
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(event) => {
                          savePhoto(item, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {item.fotoUrl && item.fotoDataHora ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={item.fotoUrl}
                          alt={`FOTO DA VERIFICAÇÃO: ${item.title.toLocaleUpperCase("pt-BR")}`}
                          className="size-14 rounded border border-[#b7791f] object-cover"
                        />
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          FOTO: {item.fotoDataHora}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-semibold text-destructive">
                        FOTO OBRIGATÓRIA ANTES DE CONCLUIR
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => edit(item)}
                  aria-label="EDITAR VERIFICAÇÃO"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => actions.removeChecklistItem(item.id)}
                  aria-label="EXCLUIR VERIFICAÇÃO"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          NENHUMA VERIFICAÇÃO NESTA FREQUÊNCIA.
        </p>
      ) : null}

      <p className="mt-5 rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
        PRAZOS DE AFERIÇÃO, ESTANQUEIDADE E CONTROLES AMBIENTAIS PODEM VARIAR CONFORME OS
        EQUIPAMENTOS, A LICENÇA E AS REGRAS ESTADUAIS OU MUNICIPAIS. CONFIRME AS EXIGÊNCIAS LOCAIS.
      </p>
    </AppShell>
  );
}

function RequirementBadge({ requirement }: { requirement: ChecklistItem["requirement"] }) {
  const label =
    requirement === "obrigatorio"
      ? "OBRIGATÓRIO"
      : requirement === "condicional"
        ? "CONFORME LICENÇA/REGRA LOCAL"
        : "BOA PRÁTICA";
  const color =
    requirement === "obrigatorio"
      ? "text-destructive"
      : requirement === "condicional"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <span className={`mt-1 inline-block text-[10px] font-semibold uppercase ${color}`}>
      {label}
    </span>
  );
}

function ChecklistForm({
  form,
  editing,
  onChange,
  onSave,
  onClose,
}: {
  form: typeof emptyForm;
  editing: boolean;
  onChange: (form: typeof emptyForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="truncate font-display text-lg text-foreground">
          {editing ? "EDITAR VERIFICAÇÃO" : "NOVA VERIFICAÇÃO"}
        </h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="FECHAR FORMULÁRIO">
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="check-title">O QUE DEVE SER VERIFICADO?</Label>
          <Input
            id="check-title"
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            placeholder="DIGITE A VERIFICAÇÃO"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="check-frequency">FREQUÊNCIA</Label>
            <div className="relative">
              <select
                id="check-frequency"
                className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground"
                value={form.frequency}
                onChange={(event) =>
                  onChange({ ...form, frequency: event.target.value as ChecklistFrequency })
                }
              >
                {frequencies.map((frequency) => (
                  <option key={frequency.id} value={frequency.id}>
                    {frequency.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-muted-foreground" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="check-requirement">CLASSIFICAÇÃO</Label>
            <div className="relative">
              <select
                id="check-requirement"
                className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground"
                value={form.requirement}
                onChange={(event) =>
                  onChange({
                    ...form,
                    requirement: event.target.value as ChecklistItem["requirement"],
                  })
                }
              >
                <option value="obrigatorio">OBRIGATÓRIO</option>
                <option value="condicional">REGRA LOCAL</option>
                <option value="recomendado">BOA PRÁTICA</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.requerFoto}
          onClick={() => onChange({ ...form, requerFoto: !form.requerFoto })}
          className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-background p-3 text-left"
        >
          <span>
            <span className="block text-sm font-bold">EXIGIR FOTO COMPROBATÓRIA? *</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              SE MARCADO, SÓ SERÁ POSSÍVEL CONCLUIR COM FOTO
            </span>
          </span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              form.requerFoto ? "bg-[#b7791f]" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                form.requerFoto ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
        <Button onClick={onSave}>
          {editing ? "SALVAR ALTERAÇÕES" : "ADICIONAR AO CHECK LIST"}
        </Button>
      </div>
    </section>
  );
}
