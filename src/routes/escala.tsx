import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actions,
  shiftISO,
  todayISO,
  useAppState,
  weekdayBR,
  type Attendant,
} from "@/lib/store";

export const Route = createFileRoute("/escala")({
  head: () => ({
    meta: [
      { title: "Escala de Frentistas — Posto 10" },
      {
        name: "description",
        content:
          "Monte a escala do posto: turnos, nome e horário de cada frentista e marcação de folgas destacadas.",
      },
      { property: "og:title", content: "Escala de Frentistas — Posto 10" },
      {
        property: "og:description",
        content: "Turnos, horários e folgas dos frentistas em uma só tela.",
      },
    ],
  }),
  component: EscalaPage,
});

function EscalaPage() {
  const state = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(todayISO());
  const days = Array.from({ length: 7 }, (_, i) => shiftISO(weekStart, i));
  const shifts = Array.from({ length: state.shifts }, (_, i) => i + 1);

  return (
    <AppShell title="Escala" subtitle="Frentistas, horários e folgas">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Equipe</h2>
        <Button
          size="sm"
          onClick={() =>
            actions.addAttendant({
              name: "Novo frentista",
              shift: 1,
              start: "06:00",
              end: "14:00",
            })
          }
        >
          <Plus className="size-4" /> Frentista
        </Button>
      </div>

      <div className="mb-7 space-y-5">
        {shifts.map((shift) => (
          <div key={shift}>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Turno {shift}
            </p>
            <div className="space-y-2">
              {state.attendants.filter((a) => a.shift === shift).length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nenhum frentista neste turno.
                </p>
              ) : null}
              {state.attendants
                .filter((a) => a.shift === shift)
                .map((a) =>
                  editing === a.id ? (
                    <AttendantEditor
                      key={a.id}
                      attendant={a}
                      maxShift={state.shifts}
                      onDone={() => setEditing(null)}
                    />
                  ) : (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {a.start} — {a.end}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${a.name}`}
                        onClick={() => setEditing(a.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Excluir ${a.name}`}
                        onClick={() => actions.removeAttendant(a.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ),
                )}
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">Folgas</h2>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Semana anterior"
              onClick={() => setWeekStart(shiftISO(weekStart, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Próxima semana"
              onClick={() => setWeekStart(shiftISO(weekStart, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <label className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
          <input
            type="checkbox"
            className="size-4 accent-[var(--folga)]"
            checked={state.sundayOff ?? false}
            onChange={(e) => actions.setSundayOff(e.target.checked)}
          />
          Folgar aos domingos (todos os frentistas)
        </label>

        <p className="mb-3 text-xs text-muted-foreground">
          Toque em um dia para alternar: trabalho → folga (vermelho) → falta (roxo).
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Frentista
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="text-[11px] font-medium uppercase text-muted-foreground"
                  >
                    <span className="block">{weekdayBR(d)}</span>
                    <span className="block tabular-nums opacity-70">{d.slice(8)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.attendants.map((a) => (
                <tr key={a.id}>
                  <td className="max-w-[120px] truncate pr-2 text-xs text-foreground">
                    {a.name}
                  </td>
                  {days.map((d) => {
                    const off = a.folgas.includes(d);
                    return (
                      <td key={d}>
                        <button
                          type="button"
                          onClick={() => actions.toggleFolga(a.id, d)}
                          aria-label={`${off ? "Remover" : "Marcar"} folga de ${a.name} em ${d}`}
                          className={`h-9 w-full rounded-md border text-[10px] font-semibold uppercase transition-colors ${
                            off
                              ? "border-folga bg-folga text-folga-foreground"
                              : "border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          {off ? "Folga" : "T" + a.shift}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function AttendantEditor({
  attendant,
  maxShift,
  onDone,
}: {
  attendant: Attendant;
  maxShift: number;
  onDone: () => void;
}) {
  const [name, setName] = useState(attendant.name);
  const [shift, setShift] = useState(attendant.shift);
  const [start, setStart] = useState(attendant.start);
  const [end, setEnd] = useState(attendant.end);

  return (
    <div className="space-y-3 rounded-xl border border-primary/50 bg-card p-4">
      <div>
        <Label className="text-xs text-muted-foreground">Nome</Label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Entrada</Label>
          <Input
            className="mt-1"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Saída</Label>
          <Input
            className="mt-1"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Turno</Label>
        <div className="mt-1 flex gap-2">
          {Array.from({ length: maxShift }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              variant={shift === n ? "default" : "outline"}
              className="flex-1"
              onClick={() => setShift(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          onClick={() => {
            actions.updateAttendant(attendant.id, {
              name: name.trim() || attendant.name,
              shift,
              start,
              end,
            });
            onDone();
          }}
        >
          <Check className="size-4" /> Salvar
        </Button>
        <Button variant="outline" onClick={onDone}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
