import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      { title: "Check List do Gerente — Posto 10" },
      {
        name: "description",
        content: "Verificações diárias e periódicas de operação, segurança e gestão do posto.",
      },
      { property: "og:title", content: "Check List do Gerente — Posto 10" },
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
  { id: "diario", label: "Diário", shortLabel: "Hoje" },
  { id: "semanal", label: "Semanal", shortLabel: "Semana" },
  { id: "mensal", label: "Mensal", shortLabel: "Mês" },
  { id: "trimestral", label: "A cada 3 meses", shortLabel: "3 meses" },
  { id: "semestral", label: "A cada 6 meses", shortLabel: "6 meses" },
];

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
};

function ChecklistPage() {
  const state = useAppState();
  const items = state.checklistItems ?? [];
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
    });
    setEditing(item.id);
    setFormOpen(true);
  };

  return (
    <AppShell title="Check List" subtitle="Rotina do gerente">
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
              {complete} de {visible.length} concluídos neste ciclo
            </p>
          </div>
          <span className="shrink-0 font-display text-2xl text-primary">{percent}%</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progresso do checklist"
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
          <Plus className="size-4" /> Adicionar verificação
        </Button>
      )}

      <ul className="grid gap-2">
        {visible.map((item) => {
          const checked = checks[item.id] === currentKey;
          return (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Button
                size="icon"
                variant={checked ? "default" : "outline"}
                className="mt-0.5 size-9 shrink-0"
                onClick={() => actions.toggleChecklistItem(item.id, currentKey)}
                aria-label={checked ? "Desmarcar verificação" : "Marcar verificação"}
              >
                <Check className={`size-5 ${checked ? "opacity-100" : "opacity-20"}`} />
              </Button>
              <div className="min-w-0">
                <p
                  className={`text-sm leading-snug text-foreground ${checked ? "line-through opacity-60" : ""}`}
                >
                  {item.title}
                </p>
                <RequirementBadge requirement={item.requirement} />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => edit(item)}
                  aria-label="Editar verificação"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => actions.removeChecklistItem(item.id)}
                  aria-label="Excluir verificação"
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
          Nenhuma verificação nesta frequência.
        </p>
      ) : null}

      <p className="mt-5 rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
        Prazos de aferição, estanqueidade e controles ambientais podem variar conforme os
        equipamentos, a licença e as regras estaduais ou municipais. Confirme as exigências locais.
      </p>
    </AppShell>
  );
}

function RequirementBadge({ requirement }: { requirement: ChecklistItem["requirement"] }) {
  const label =
    requirement === "obrigatorio"
      ? "Obrigatório"
      : requirement === "condicional"
        ? "Conforme licença/regra local"
        : "Boa prática";
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
          {editing ? "Editar verificação" : "Nova verificação"}
        </h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar formulário">
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="check-title">O que deve ser verificado?</Label>
          <Input
            id="check-title"
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            placeholder="Digite a verificação"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="check-frequency">Frequência</Label>
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
            <Label htmlFor="check-requirement">Classificação</Label>
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
                <option value="obrigatorio">Obrigatório</option>
                <option value="condicional">Regra local</option>
                <option value="recomendado">Boa prática</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        <Button onClick={onSave}>
          {editing ? "Salvar alterações" : "Adicionar ao check list"}
        </Button>
      </div>
    </section>
  );
}
