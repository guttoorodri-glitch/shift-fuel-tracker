import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, formatBR, useAppState, type Task, type TaskStatus } from "@/lib/store";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas Kanban — Posto 10" },
      {
        name: "description",
        content:
          "Agende e acompanhe as tarefas do posto em um quadro kanban com as colunas a fazer, fazendo e feito.",
      },
      { property: "og:title", content: "Tarefas Kanban — Posto 10" },
      {
        property: "og:description",
        content: "Quadro de tarefas do posto: a fazer, fazendo e feito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

const columns: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "afazer", label: "A fazer", accent: "border-l-muted-foreground/50" },
  { id: "fazendo", label: "Fazendo", accent: "border-l-primary" },
  { id: "feito", label: "Feito", accent: "border-l-[var(--folga)]" },
];

const emptyForm = { title: "", note: "", due: "", assignee: "" };

function TarefasPage() {
  const state = useAppState();
  const tasks = state.tasks ?? [];
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = () => {
    const title = form.title.trim();
    if (!title) return;
    const payload = {
      title,
      note: form.note.trim() || undefined,
      due: form.due || undefined,
      assignee: form.assignee.trim() || undefined,
    };
    if (editing) actions.updateTask(editing, payload);
    else actions.addTask({ ...payload, status: "afazer" });
    setForm(emptyForm);
    setEditing(null);
    setOpen(false);
  };

  const startEdit = (t: Task) => {
    setForm({
      title: t.title,
      note: t.note ?? "",
      due: t.due ?? "",
      assignee: t.assignee ?? "",
    });
    setEditing(t.id);
    setOpen(true);
  };

  const move = (t: Task, dir: -1 | 1) => {
    const i = columns.findIndex((c) => c.id === t.status);
    const next = columns[i + dir];
    if (next) actions.setTaskStatus(t.id, next.id);
  };

  return (
    <AppShell title="Tarefas" subtitle="Quadro kanban">
      {open ? (
        <section className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {editing ? "Editar tarefa" : "Nova tarefa"}
            </p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setEditing(null);
                setForm(emptyForm);
              }}
              aria-label="Fechar formulário"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">Tarefa</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Aferir bomba 3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="task-due">Data</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.due}
                  onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-assignee">Responsável</Label>
                <Input
                  id="task-assignee"
                  value={form.assignee}
                  onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                  placeholder="Nome"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-note">Observação</Label>
              <Input
                id="task-note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Detalhes"
              />
            </div>
            <Button onClick={submit}>{editing ? "Salvar" : "Adicionar tarefa"}</Button>
          </div>
        </section>
      ) : (
        <Button className="mb-4 w-full" onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" /> Nova tarefa
        </Button>
      )}

      <div className="grid gap-4">
        {columns.map((col) => {
          const list = tasks.filter((t) => t.status === col.id);
          return (
            <section key={col.id} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  {col.label}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {list.length}
                </span>
              </div>

              {list.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Nenhuma tarefa aqui.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {list.map((t) => (
                    <li
                      key={t.id}
                      className={`rounded-lg border border-border border-l-4 bg-background p-3 ${col.accent}`}
                    >
                      <p
                        className={`text-sm font-medium text-foreground ${
                          t.status === "feito" ? "line-through opacity-70" : ""
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.note ? (
                        <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t.due ? <span>{formatBR(t.due)}</span> : null}
                        {t.assignee ? <span>{t.assignee}</span> : null}
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={col.id === "afazer"}
                          onClick={() => move(t, -1)}
                          aria-label="Mover para a coluna anterior"
                        >
                          <ArrowLeft className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={col.id === "feito"}
                          onClick={() => move(t, 1)}
                          aria-label="Mover para a próxima coluna"
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(t)}
                          aria-label="Editar tarefa"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => actions.removeTask(t.id)}
                          aria-label="Excluir tarefa"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
