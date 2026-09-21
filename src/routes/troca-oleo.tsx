import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Droplets, MessageCircle, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, formatBR, todayISO, useAppState } from "@/lib/store";

export const Route = createFileRoute("/troca-oleo")({
  head: () => ({ meta: [{ title: "TROCA DE ÓLEO — Posto 10" }] }),
  component: TrocaOleoPage,
});

const message = (name: string, date: string) =>
  `Olá, ${name}! Sua troca de óleo está próxima do vencimento por prazo de 6 meses (${formatBR(date)}). Recomendamos verificar a kilometragem na etiqueta colada no vidro do carro. Estamos aqui de braços abertos aguardando você cliente especial para realizar novamente o serviço de troca de óleo no seu veículo.`;

const whatsappUrl = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

function TrocaOleoPage() {
  const state = useAppState();
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [date, setDate] = useState(todayISO());
  const [lubricant, setLubricant] = useState("");
  const [quantity, setQuantity] = useState("");
  const [technician, setTechnician] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [mileage, setMileage] = useState("");
  const [filters, setFilters] = useState({
    oilFilter: false,
    airFilter: false,
    fuelFilter: false,
    cabinFilter: false,
  });
  const [error, setError] = useState<string | null>(null);
  const commission = state.oilCommission ?? {
    salesGoal: 0,
    salesCommissionPct: 0,
    technicianGoal: 0,
    technicianCommissionPct: 0,
  };
  const [commissionDraft, setCommissionDraft] = useState(commission);
  const changes = state.oilChanges ?? [];
  const today = todayISO();

  const save = () => {
    const qty = Number(quantity.replace(",", "."));
    const total = Number(totalValue.replace(",", "."));
    const km = Number(mileage.replace(/\D/g, ""));
    const phone = whatsapp.replace(/\D/g, "");
    if (
      !customerName.trim() ||
      phone.length < 10 ||
      !date ||
      !lubricant.trim() ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !technician.trim() ||
      !Number.isFinite(total) ||
      total < 0 ||
      !Number.isFinite(km) ||
      km < 0
    ) {
      setError(
        "Preencha nome, WhatsApp com DDD, data, óleo, quantidade, técnico, valor e kilometragem.",
      );
      return;
    }
    actions.addOilChange({
      customerName: customerName.trim(),
      whatsapp: phone,
      date,
      lubricant: lubricant.trim(),
      quantity: qty,
      technician: technician.trim(),
      totalValue: total,
      mileage: km,
      ...filters,
    });
    setCustomerName("");
    setWhatsapp("");
    setLubricant("");
    setQuantity("");
    setTechnician("");
    setTotalValue("");
    setMileage("");
    setFilters({ oilFilter: false, airFilter: false, fuelFilter: false, cabinFilter: false });
    setError(null);
  };

  return (
    <AppShell title="TROCA DE ÓLEO" subtitle="Clientes e lembretes de manutenção">
      <section className="mb-5 space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Droplets className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Nova troca de óleo</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do cliente" value={customerName} onChange={setCustomerName} />
          <Field
            label="WhatsApp com DDD"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="(19) 99999-9999"
          />
          <div>
            <Label>Data da troca</Label>
            <Input
              className="mt-1"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Field
            label="Óleo lubrificante utilizado"
            value={lubricant}
            onChange={setLubricant}
            placeholder="Ex.: 5W30 sintético"
          />
          <Field
            label="Quantidade de óleo (L)"
            value={quantity}
            onChange={setQuantity}
            inputMode="decimal"
          />
          <Field label="Técnico responsável" value={technician} onChange={setTechnician} />
          <Field
            label="Valor total da troca (R$)"
            value={totalValue}
            onChange={setTotalValue}
            inputMode="decimal"
          />
          <Field
            label="Kilometragem atual"
            value={mileage}
            onChange={setMileage}
            inputMode="numeric"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Filtros trocados</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {(
              [
                ["oilFilter", "Óleo"],
                ["airFilter", "Ar"],
                ["fuelFilter", "Combustível"],
                ["cabinFilter", "Ar condicionado"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-border p-2"
              >
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, [key]: e.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" onClick={save}>
          Salvar troca de óleo
        </Button>
      </section>
      <section className="mb-5 space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">Metas e comissões</h2>
        <p className="text-xs text-muted-foreground">
          A comissão é considerada quando o total atingir a meta configurada.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Meta de vendas (R$)"
            value={String(commissionDraft.salesGoal)}
            onChange={(value) =>
              setCommissionDraft((current) => ({
                ...current,
                salesGoal: Number(value.replace(",", ".")) || 0,
              }))
            }
            inputMode="decimal"
          />
          <Field
            label="Comissão vendedor (%)"
            value={String(commissionDraft.salesCommissionPct)}
            onChange={(value) =>
              setCommissionDraft((current) => ({
                ...current,
                salesCommissionPct: Number(value.replace(",", ".")) || 0,
              }))
            }
            inputMode="decimal"
          />
          <Field
            label="Meta do técnico (R$)"
            value={String(commissionDraft.technicianGoal)}
            onChange={(value) =>
              setCommissionDraft((current) => ({
                ...current,
                technicianGoal: Number(value.replace(",", ".")) || 0,
              }))
            }
            inputMode="decimal"
          />
          <Field
            label="Comissão técnico (%)"
            value={String(commissionDraft.technicianCommissionPct)}
            onChange={(value) =>
              setCommissionDraft((current) => ({
                ...current,
                technicianCommissionPct: Number(value.replace(",", ".")) || 0,
              }))
            }
            inputMode="decimal"
          />
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => actions.setOilCommission(commissionDraft)}
        >
          Salvar metas e comissões
        </Button>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">Lembretes de 150 dias</h2>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma troca cadastrada.</p>
        ) : (
          changes.map((change) => {
            const due = change.reminderDate <= today;
            return (
              <div
                key={change.id}
                className={`rounded-xl border p-4 ${due ? "border-amber-400 bg-amber-50 text-slate-900" : "border-border bg-background"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{change.customerName}</p>
                    <p className="text-xs">
                      Troca: {formatBR(change.date)} · Lembrete: {formatBR(change.reminderDate)}
                    </p>
                    <p className="mt-1 text-sm">
                      {change.lubricant} · {change.quantity} L · R${" "}
                      {(change.totalValue ?? 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      · Técnico: {change.technician || "Não informado"} ·{" "}
                      {change.mileage.toLocaleString("pt-BR")} km
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir troca"
                    onClick={() => actions.removeOilChange(change.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                {due ? (
                  <Button
                    className="mt-3 w-full bg-green-600 hover:bg-green-700"
                    onClick={() =>
                      window.open(
                        whatsappUrl(
                          change.whatsapp,
                          message(change.customerName, change.reminderDate),
                        ),
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    <MessageCircle className="size-4" /> Enviar lembrete por WhatsApp
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Lembrete disponível em {formatBR(change.reminderDate)}.
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
