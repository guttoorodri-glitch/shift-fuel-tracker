import { useEffect, useState } from "react";
import { Check, LockKeyhole, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtL } from "@/lib/store";

export function MeasureField({
  label,
  color,
  value,
  onSave,
  onDraftChange,
  placeholder = "Informar medida",
  readOnly = false,
}: {
  label: string;
  color?: string | undefined;
  value: number | undefined;
  onSave: (value: number) => void;
  onDraftChange?: (value: number | null | undefined) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(value === undefined);
  const [focusOnEdit, setFocusOnEdit] = useState(false);
  const [draft, setDraft] = useState(value !== undefined ? String(value) : "");

  useEffect(() => {
    if (!editing) setDraft(value !== undefined ? String(value) : "");
  }, [value, editing]);

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || draft.trim() === "") return;
    onDraftChange?.(undefined);
    onSave(parsed);
    setEditing(false);
  };

  if (readOnly) {
    return (
      <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: color ?? "var(--color-primary)" }}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className={`font-display text-lg tabular-nums ${
              value !== undefined && value < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {value !== undefined ? fmtL(value) : "—"}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <LockKeyhole className="size-3" />
            CALCULADO AUTOMATICAMENTE
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--color-primary)" }}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus={focusOnEdit}
            inputMode="decimal"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => {
              const nextDraft = e.target.value;
              const parsed = Number(nextDraft.replace(",", "."));
              setDraft(nextDraft);
              onDraftChange?.(nextDraft.trim() !== "" && Number.isFinite(parsed) ? parsed : null);
            }}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="h-9 w-28 text-right"
          />
          <Button size="icon" variant="default" className="size-9" onClick={commit}>
            <Check className="size-4" />
          </Button>
          {value !== undefined ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-9"
              onClick={() => {
                onDraftChange?.(undefined);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="font-display text-lg tabular-nums text-foreground">
            {value !== undefined ? fmtL(value) : "—"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-muted-foreground"
            aria-label={`Editar ${label}`}
            onClick={() => {
              setFocusOnEdit(true);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
