import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, fmtL, useAppState, type Tank } from "@/lib/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações dos Tanques — Posto" },
      {
        name: "description",
        content:
          "Configure cor, nome do combustível e capacidade de cada tanque, além da quantidade de turnos do posto.",
      },
      { property: "og:title", content: "Configurações dos Tanques — Posto" },
      {
        property: "og:description",
        content: "Cores, nomes e capacidades dos tanques e turnos do posto.",
      },
    ],
  }),
  component: ConfigPage,
});

const PALETTE = [
  "#e0b428",
  "#e2632c",
  "#3fa06a",
  "#3b82c4",
  "#a855f7",
  "#d94b5a",
  "#0f766e",
  "#94a3b8",
];

function ConfigPage() {
  const state = useAppState();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <AppShell title="Configurações" subtitle="Tanques e turnos">
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Quantidade de turnos
        </Label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Button
              key={n}
              variant={state.shifts === n ? "default" : "outline"}
              className="flex-1"
              onClick={() => actions.setShifts(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </section>

      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Tanques</h2>
        <Button
          size="sm"
          onClick={() => {
            const color = PALETTE[state.tanks.length % PALETTE.length] as string;
            actions.addTank({ name: "Novo combustível", color, capacity: 10000 });
          }}
        >
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Use as setas para definir a sequência: o Tanque 1 aparece primeiro em todas as telas.
      </p>

      <div className="space-y-3">
        {state.tanks.map((tank, i) =>
          editing === tank.id ? (
            <TankEditor key={tank.id} tank={tank} index={i} onDone={() => setEditing(null)} />
          ) : (
            <div
              key={tank.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex flex-col">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-7"
                  disabled={i === 0}
                  aria-label={`Mover ${tank.name} para cima`}
                  onClick={() => actions.moveTank(tank.id, -1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-7"
                  disabled={i === state.tanks.length - 1}
                  aria-label={`Mover ${tank.name} para baixo`}
                  onClick={() => actions.moveTank(tank.id, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg font-display text-base text-black/80"
                style={{ backgroundColor: tank.color }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  Tanque {i + 1} · {tank.name}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  Capacidade {fmtL(tank.capacity)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Editar ${tank.name}`}
                onClick={() => setEditing(tank.id)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Excluir ${tank.name}`}
                onClick={() => actions.removeTank(tank.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ),
        )}
      </div>

    </AppShell>
  );
}

function TankEditor({ tank, onDone }: { tank: Tank; onDone: () => void }) {
  const [name, setName] = useState(tank.name);
  const [capacity, setCapacity] = useState(String(tank.capacity));
  const [color, setColor] = useState(tank.color);

  return (
    <div className="space-y-3 rounded-xl border border-primary/50 bg-card p-4">
      <div>
        <Label className="text-xs text-muted-foreground">Nome do combustível</Label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Capacidade (litros)</Label>
        <Input
          className="mt-1"
          inputMode="decimal"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Cor do tanque</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => setColor(c)}
              className={`size-8 rounded-lg border-2 ${
                color === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            aria-label="Cor personalizada"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-8 rounded-lg border border-border bg-transparent"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          onClick={() => {
            actions.updateTank(tank.id, {
              name: name.trim() || tank.name,
              color,
              capacity: Number(capacity.replace(",", ".")) || tank.capacity,
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
