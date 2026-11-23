import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Cake, Download, Droplets, MessageCircle, Pencil, Share2, Trash2, UserRoundPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, formatBR, todayISO, useAppState, type OilChange, type OilCommissionConfig, type OilQuote } from "@/lib/store";
import { downloadBlob, sharePdf } from "@/lib/share-pdf";
import { buildOilCommissionPdf, oilCommissionFileName } from "@/lib/troca-oleo-comissao-pdf";
import { buildOilQuotePdf, oilQuoteFileName } from "@/lib/troca-oleo-orcamento-pdf";
import { buildOilChangePdf, oilChangeFileName } from "@/lib/troca-oleo-pedido-pdf";

export const Route = createFileRoute("/troca-oleo")({
  head: () => ({ meta: [{ title: "TROCA DE ÓLEO — Posto 10" }] }),
  component: TrocaOleoPage,
});

const TABS = [
  { id: "orcamento", label: "ORÇAMENTO" },
  { id: "nova-troca", label: "NOVA TROCA DE ÓLEO" },
  { id: "clientes", label: "CLIENTES / VENCIMENTOS" },
  { id: "aniversariantes", label: "ANIVERSARIANTES" },
  { id: "tecnico", label: "TÉCNICO EM LUBRIFICAÇÃO" },
  { id: "metas", label: "METAS E ALVO" },
  { id: "comissoes", label: "RELATÓRIO DE COMISSÕES" },
  { id: "lembretes", label: "LEMBRETES" },
] as const;

type Tab = "orcamento" | "nova-troca" | "clientes" | "aniversariantes" | "tecnico" | "metas" | "comissoes" | "lembretes";

const parseISO = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

const addDays = (value: string, days: number) => {
  const date = parseISO(value);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const numberValue = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const whatsappUrl = (phone: string, text: string) => {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

function metrics(lastChangeDate: string, currentKm: number, lastChangeKm: number, kmInterval: number) {
  const today = todayISO();
  const todayDate = parseISO(today);
  const lastDate = parseISO(lastChangeDate);
  const daysSince = Math.max(0, Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000));
  const kmDriven = Math.max(0, currentKm - lastChangeKm);
  const average = kmDriven / (daysSince === 0 ? 1 : daysSince);
  const kmRemaining = kmInterval - kmDriven;
  const kmRemainingDays = average > 0 ? kmRemaining / average : kmRemaining > 0 ? 9999 : 0;
  const kmDate = addDays(today, Math.max(0, Math.ceil(kmRemainingDays)));
  const timeDate = addDays(lastChangeDate, 180);
  const finalDate = kmDate <= timeDate ? kmDate : timeDate;
  const finalDays = Math.round((parseISO(finalDate).getTime() - todayDate.getTime()) / 86400000);
  const status = finalDays < 0 ? "Vencido" : finalDays <= 20 ? "Próximo do vencimento" : "Em dia";
  return { daysSince, kmDriven, average, kmRemaining, kmDate, timeDate, finalDate, finalDays, status };
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TrocaOleoPage() {
  const state = useAppState();
  const technicians = state.oilTechnicians ?? [];
  const quotes = state.oilQuotes ?? [];
  const changes = state.oilChanges ?? [];
  const [tab, setTab] = useState<Tab>("orcamento");
  const [status, setStatus] = useState("");

  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quote, setQuote] = useState({
    customerName: "", whatsapp: "", birthDate: "", vehicle: "", plate: "", currentKm: "", lastChangeKm: "",
    lastChangeDate: "", kmInterval: "10000", oilType: "", oilFilter: "", quoteValue: "", observations: "", technicianId: "",
  });

  const [changeId, setChangeId] = useState<string | null>(null);
  const [changeForm, setChangeForm] = useState({
    customerName: "", birthDate: "", whatsapp: "", vehicle: "", plate: "", currentKm: "", lastChangeKm: "",
    lastChangeDate: todayISO(), kmInterval: "10000", date: todayISO(), technicianId: "",
    oilQuantity: "", oilUnitValue: "", oilFilterQuantity: "1", oilFilterUnitValue: "",
    airFilterQuantity: "1", airFilterUnitValue: "", fuelFilterQuantity: "1", fuelFilterUnitValue: "",
    cabinFilterQuantity: "1", cabinFilterUnitValue: "", otherServices: "", observations: "",
  });

  const [customerFilter, setCustomerFilter] = useState("Todos");
  const [birthdayMonth, setBirthdayMonth] = useState(todayISO().slice(0, 7));
  const [birthdayFrom, setBirthdayFrom] = useState(todayISO().slice(0, 7) + "-01");
  const [birthdayTo, setBirthdayTo] = useState(todayISO());
  const [birthdayFilter, setBirthdayFilter] = useState("month");
  const [techForm, setTechForm] = useState({ fullName: "", mobilePhone: "", photoUrl: "" });
  const [commissionDraft, setCommissionDraft] = useState<OilCommissionConfig>(
    state.oilCommission ?? { salesGoal: 0, salesCommissionPct: 0, technicianGoal: 0, technicianCommissionPct: 0, mode: "percent" },
  );
  const [reportFrom, setReportFrom] = useState(todayISO().slice(0, 7) + "-01");
  const [reportTo, setReportTo] = useState(todayISO());
  const [reportTechnician, setReportTechnician] = useState("todos");

  useEffect(() => setCommissionDraft(state.oilCommission ?? commissionDraft), [state.oilCommission]);
  useEffect(() => {
    if (technicians.length && !quote.technicianId) setQuote((v) => ({ ...v, technicianId: technicians[0].id }));
  }, [technicians]);

  const resetQuote = () => {
    setQuoteId(null);
    setQuote({ customerName: "", whatsapp: "", birthDate: "", vehicle: "", plate: "", currentKm: "", lastChangeKm: "", lastChangeDate: "", kmInterval: "10000", oilType: "", oilFilter: "", quoteValue: "", observations: "", technicianId: technicians[0]?.id ?? "" });
  };

  const saveQuote = () => {
    const phone = quote.whatsapp.replace(/\D/g, "");
    const currentKm = Number(quote.currentKm.replace(/\D/g, ""));
    const lastChangeKm = Number(quote.lastChangeKm.replace(/\D/g, ""));
    const kmInterval = Number(quote.kmInterval.replace(/\D/g, ""));
    if (!quote.customerName.trim() || phone.length < 10 || !quote.birthDate || !quote.vehicle.trim() || !quote.plate.trim() || !quote.lastChangeDate || !Number.isFinite(currentKm) || !Number.isFinite(lastChangeKm) || !technicians.some((item) => item.id === quote.technicianId)) {
      setStatus("Preencha todos os dados obrigatórios e selecione um técnico.");
      return;
    }
    const payload = {
      customerName: quote.customerName.trim(), whatsapp: phone, birthDate: quote.birthDate, vehicle: quote.vehicle.trim(),
      plate: quote.plate.trim().toUpperCase(), currentKm, lastChangeKm, lastChangeDate: quote.lastChangeDate, kmInterval: kmInterval || 10000,
      oilType: quote.oilType.trim(), oilFilter: quote.oilFilter.trim(), quoteValue: numberValue(quote.quoteValue), observations: quote.observations.trim(),
      technicianId: quote.technicianId,
    };
    if (quoteId) actions.updateOilQuote(quoteId, payload);
    else actions.addOilQuote(payload);
    setStatus(quoteId ? "Orçamento atualizado." : "Orçamento salvo.");
    resetQuote();
  };

  const editQuote = (item: OilQuote) => {
    setQuoteId(item.id);
    setTab("orcamento");
    setQuote({ customerName: item.customerName, whatsapp: item.whatsapp, birthDate: item.birthDate, vehicle: item.vehicle, plate: item.plate, currentKm: String(item.currentKm), lastChangeKm: String(item.lastChangeKm), lastChangeDate: item.lastChangeDate, kmInterval: String(item.kmInterval), oilType: item.oilType, oilFilter: item.oilFilter, quoteValue: String(item.quoteValue), observations: item.observations, technicianId: (item as OilQuote & { technicianId?: string }).technicianId ?? technicians[0]?.id ?? "" });
  };

  const quotePdf = async (item: OilQuote, share: boolean) => {
    const blob = await buildOilQuotePdf(state, item, metrics(item.lastChangeDate, item.currentKm, item.lastChangeKm, item.kmInterval).finalDate);
    const name = oilQuoteFileName(item);
    if (share) setStatus(await sharePdf(blob, name, `Orçamento de troca de óleo para ${item.customerName}.`));
    else { downloadBlob(blob, name); setStatus(`PDF salvo: ${name}`); }
  };

  const changeItems = useMemo(() => [
    { key: "oil", label: "Óleo", quantity: numberValue(changeForm.oilQuantity), unit: numberValue(changeForm.oilUnitValue) },
    { key: "oilFilter", label: "Filtro de óleo", quantity: numberValue(changeForm.oilFilterQuantity), unit: numberValue(changeForm.oilFilterUnitValue) },
    { key: "airFilter", label: "Filtro de ar", quantity: numberValue(changeForm.airFilterQuantity), unit: numberValue(changeForm.airFilterUnitValue) },
    { key: "fuelFilter", label: "Filtro de combustível", quantity: numberValue(changeForm.fuelFilterQuantity), unit: numberValue(changeForm.fuelFilterUnitValue) },
    { key: "cabinFilter", label: "Filtro de ar condicionado", quantity: numberValue(changeForm.cabinFilterQuantity), unit: numberValue(changeForm.cabinFilterUnitValue) },
  ], [changeForm]);
  const changeTotal = changeItems.reduce((sum, item) => sum + item.quantity * item.unit, 0);

  const resetChange = () => setChangeForm({
    customerName: "", birthDate: "", whatsapp: "", vehicle: "", plate: "", currentKm: "", lastChangeKm: "", lastChangeDate: todayISO(), kmInterval: "10000",
    date: todayISO(), technicianId: technicians[0]?.id ?? "", oilQuantity: "", oilUnitValue: "", oilFilterQuantity: "1", oilFilterUnitValue: "",
    airFilterQuantity: "1", airFilterUnitValue: "", fuelFilterQuantity: "1", fuelFilterUnitValue: "", cabinFilterQuantity: "1", cabinFilterUnitValue: "",
    otherServices: "", observations: "",
  });

  const saveChange = () => {
    const phone = changeForm.whatsapp.replace(/\D/g, "");
    const selected = technicians.find((item) => item.id === changeForm.technicianId);
    if (!changeForm.customerName.trim() || !changeForm.birthDate || phone.length < 10 || !changeForm.vehicle.trim() || !changeForm.plate.trim() || !selected) {
      setStatus("Preencha os dados do cliente e veículo e selecione um técnico.");
      return;
    }
    const quantities: Record<string, number> = Object.fromEntries(changeItems.map((item) => [item.key, item.quantity]));
    const values: Record<string, number> = Object.fromEntries(changeItems.map((item) => [item.key, item.unit]));
    const payload = {
      customerName: changeForm.customerName.trim(), birthDate: changeForm.birthDate, whatsapp: phone, date: changeForm.lastChangeDate,
      lubricant: "Óleo", quantity: quantities.oil, technician: selected.fullName, technicianId: selected.id, totalValue: changeTotal,
      mileage: Number(changeForm.currentKm.replace(/\D/g, "")), vehicle: changeForm.vehicle.trim(), plate: changeForm.plate.trim().toUpperCase(),
      currentKm: Number(changeForm.currentKm.replace(/\D/g, "")), lastChangeKm: Number(changeForm.lastChangeKm.replace(/\D/g, "")),
      kmInterval: Number(changeForm.kmInterval.replace(/\D/g, "")) || 10000, itemQuantities: quantities, itemValues: values,
      otherServices: changeForm.otherServices.trim(), observations: changeForm.observations.trim(),
      oilFilter: quantities.oilFilter > 0, airFilter: quantities.airFilter > 0, fuelFilter: quantities.fuelFilter > 0, cabinFilter: quantities.cabinFilter > 0,
    };
    if (changeId) actions.updateOilChange(changeId, payload);
    else actions.addOilChange(payload);
    setStatus(changeId ? "Troca atualizada." : "Nova troca salva e aniversariante atualizado.");
    setChangeId(null);
    resetChange();
  };

  const editChange = (item: OilChange) => {
    setChangeId(item.id);
    setTab("nova-troca");
    setChangeForm({
      customerName: item.customerName, birthDate: item.birthDate ?? "", whatsapp: item.whatsapp, vehicle: item.vehicle ?? "", plate: item.plate ?? "",
      currentKm: String(item.currentKm ?? item.mileage), lastChangeKm: String(item.lastChangeKm ?? 0), lastChangeDate: item.date, kmInterval: String(item.kmInterval ?? 10000),
      date: item.date, technicianId: item.technicianId ?? technicians[0]?.id ?? "", oilQuantity: String(item.itemQuantities?.oil ?? item.quantity),
      oilUnitValue: String(item.itemValues?.oil ?? 0), oilFilterQuantity: String(item.itemQuantities?.oilFilter ?? (item.oilFilter ? 1 : 0)),
      oilFilterUnitValue: String(item.itemValues?.oilFilter ?? 0), airFilterQuantity: String(item.itemQuantities?.airFilter ?? (item.airFilter ? 1 : 0)),
      airFilterUnitValue: String(item.itemValues?.airFilter ?? 0), fuelFilterQuantity: String(item.itemQuantities?.fuelFilter ?? (item.fuelFilter ? 1 : 0)),
      fuelFilterUnitValue: String(item.itemValues?.fuelFilter ?? 0), cabinFilterQuantity: String(item.itemQuantities?.cabinFilter ?? (item.cabinFilter ? 1 : 0)),
      cabinFilterUnitValue: String(item.itemValues?.cabinFilter ?? 0), otherServices: item.otherServices ?? "", observations: item.observations ?? "",
    });
  };

  const changePdf = async (item: OilChange, share: boolean) => {
    const current = item.currentKm ?? item.mileage;
    const last = item.lastChangeKm ?? 0;
    const interval = item.kmInterval ?? 10000;
    const blob = await buildOilChangePdf(state, item, metrics(item.date, current, last, interval).finalDate);
    const name = oilChangeFileName(item);
    if (share) setStatus(await sharePdf(blob, name, `Pedido de troca de óleo para ${item.customerName}.`));
    else { downloadBlob(blob, name); setStatus(`PDF salvo: ${name}`); }
  };

  const unified = useMemo(() => [
    ...quotes.map((item) => ({ kind: "quote" as const, id: item.id, customerName: item.customerName, whatsapp: item.whatsapp, birthDate: item.birthDate, vehicle: item.vehicle, plate: item.plate, currentKm: item.currentKm, lastChangeKm: item.lastChangeKm, lastChangeDate: item.lastChangeDate, kmInterval: item.kmInterval, original: item })),
    ...changes.map((item) => ({ kind: "change" as const, id: item.id, customerName: item.customerName, whatsapp: item.whatsapp, birthDate: item.birthDate ?? "", vehicle: item.vehicle ?? "", plate: item.plate ?? "", currentKm: item.currentKm ?? item.mileage, lastChangeKm: item.lastChangeKm ?? 0, lastChangeDate: item.date, kmInterval: item.kmInterval ?? 10000, original: item })),
  ], [quotes, changes]);

  const filteredCustomers = unified.filter((item) => {
    const m = metrics(item.lastChangeDate, item.currentKm, item.lastChangeKm, item.kmInterval);
    if (customerFilter === "Vencidos") return m.status === "Vencido";
    if (customerFilter === "Vence em 20 dias") return m.status === "Próximo do vencimento";
    if (customerFilter === "Vence este mês") return m.finalDate.slice(0, 7) === todayISO().slice(0, 7);
    return true;
  });

  const birthdayCustomers = useMemo(() => {
    const unique = new Map<string>();
    unified.forEach((item) => {
      if (item.birthDate) unique.set(`${item.customerName.toLowerCase()}-${item.birthDate}`, item);
    });
    return [...unique.values()].filter((item) => {
      const monthDay = item.birthDate.slice(5);
      if (birthdayFilter === "today") return monthDay === todayISO().slice(5);
      if (birthdayFilter === "week") {
        const todayDate = parseISO(todayISO());
        const start = parseISO(todayISO());
        const end = parseISO(todayISO());
        end.setDate(end.getDate() + 7);
        const birthdayThisYear = parseISO(`${todayISO().slice(0, 4)}-${monthDay}`);
        return birthdayThisYear >= start && birthdayThisYear <= end;
      }
      if (birthdayFilter === "period") return monthDay >= birthdayFrom.slice(5) && monthDay <= birthdayTo.slice(5);
      return item.birthDate.slice(5, 7) === birthdayMonth.slice(5, 7);
    });
  }, [unified, birthdayFilter, birthdayMonth, birthdayFrom, birthdayTo]);

  const companyName = state.company?.name?.trim() || "Posto 10";
  const companyAddress = [state.company?.address, state.company?.number, state.company?.bairro, state.company?.city].filter(Boolean).join(", ");

  const companyWhatsappMessage = (item: typeof unified[number]) => `Caro cliente ${item.customerName}, verificamos em nosso sistema que a troca de óleo do seu veículo ${item.vehicle} placa ${item.plate} está próxima do vencimento. Aguardamos sua visita no ${companyName}, endereço ${companyAddress} para realizar a troca de óleo e filtro de seu veículo e garantir a sua segurança e da sua família com um de nossos especialistas.`;

  const saveTechnician = () => {
    if (!techForm.fullName.trim() || techForm.mobilePhone.replace(/\D/g, "").length < 10) {
      setStatus("Informe nome e telefone do técnico.");
      return;
    }
    actions.addOilTechnician({ fullName: techForm.fullName.trim(), mobilePhone: techForm.mobilePhone.replace(/\D/g, ""), photoUrl: techForm.photoUrl, registeredAt: todayISO() });
    setTechForm({ fullName: "", mobilePhone: "", photoUrl: "" });
    setStatus("Técnico cadastrado.");
  };

  const reportData = technicians.map((technician) => {
    const services = changes.filter((item) => item.date >= reportFrom && item.date <= reportTo && (item.technicianId === technician.id || item.technician === technician.fullName));
    const sales = services.reduce((sum, item) => sum + item.totalValue, 0);
    const liters = services.reduce((sum, item) => sum + (item.itemQuantities?.oil ?? item.quantity), 0);
    const filterCount = (key: "oilFilter" | "airFilter" | "fuelFilter" | "cabinFilter") => services.reduce((sum, item) => sum + (item.itemQuantities?.[key] ?? (item[key] ? 1 : 0)), 0);
    let commission = 0;
    if (commissionDraft.mode === "fixed") {
      commission = liters * (commissionDraft.fixedOilLiter ?? 0)
        + filterCount("oilFilter") * (commissionDraft.fixedOilFilter ?? 0)
        + filterCount("airFilter") * (commissionDraft.fixedAirFilter ?? 0)
        + filterCount("fuelFilter") * (commissionDraft.fixedFuelFilter ?? 0)
        + filterCount("cabinFilter") * (commissionDraft.fixedCabinFilter ?? 0);
    } else {
      const pct = sales >= (commissionDraft.technicianGoal || Infinity) ? commissionDraft.technicianCommissionPct : commissionDraft.salesCommissionPct;
      commission = sales * pct / 100;
    }
    return { technician, services, sales, liters, oilFilters: filterCount("oilFilter"), airFilters: filterCount("airFilter"), fuelFilters: filterCount("fuelFilter"), cabinFilters: filterCount("cabinFilter"), commission };
  }).filter((item) => reportTechnician === "todos" || item.technician.id === reportTechnician);

  const reportPdf = async (share: boolean) => {
    const blob = await buildOilCommissionPdf(state, reportFrom, reportTo, reportTechnician);
    const name = oilCommissionFileName(reportFrom, reportTo);
    if (share) setStatus(await sharePdf(blob, name, "Relatório de comissões dos técnicos em lubrificação."));
    else { downloadBlob(blob, name); setStatus(`PDF salvo: ${name}`); }
  };

  const reminders = [
    ...filteredCustomers.map((item) => ({ kind: "vencimento" as const, item })),
  ];
  const birthdayReminders = birthdayCustomers;

  return (
    <AppShell title="TROCA DE ÓLEO" subtitle="Orçamentos, clientes, técnicos e comissões">
      <nav className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Menu Troca de Óleo">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setTab(item.id); setStatus(""); }} className={`min-h-14 rounded-xl border px-3 py-3 text-sm font-bold transition ${tab === item.id ? "border-primary bg-primary text-primary-foreground shadow" : "border-border bg-card text-foreground hover:border-primary"}`}>
            {item.label}
          </button>
        ))}
      </nav>

      {status ? <p role="status" className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">{status}</p> : null}

      {tab === "orcamento" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">ORÇAMENTO</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do cliente" value={quote.customerName} onChange={(v) => setQuote((c) => ({ ...c, customerName: v }))} />
            <Field label="Telefone / WhatsApp" value={quote.whatsapp} onChange={(v) => setQuote((c) => ({ ...c, whatsapp: v }))} />
            <Field label="Data de nascimento do cliente" type="date" value={quote.birthDate} onChange={(v) => setQuote((c) => ({ ...c, birthDate: v }))} />
            <Field label="Veículo (marca / modelo)" value={quote.vehicle} onChange={(v) => setQuote((c) => ({ ...c, vehicle: v }))} />
            <Field label="Placa do veículo" value={quote.plate} onChange={(v) => setQuote((c) => ({ ...c, plate: v }))} />
            <Field label="KM atual do veículo" value={quote.currentKm} onChange={(v) => setQuote((c) => ({ ...c, currentKm: v }))} />
            <Field label="KM da última troca" value={quote.lastChangeKm} onChange={(v) => setQuote((c) => ({ ...c, lastChangeKm: v }))} />
            <Field label="Data da última troca" type="date" value={quote.lastChangeDate} onChange={(v) => setQuote((c) => ({ ...c, lastChangeDate: v }))} />
            <Field label="Quantos KM deveria rodar desde a última troca" value={quote.kmInterval} onChange={(v) => setQuote((c) => ({ ...c, kmInterval: v }))} />
            <Field label="Tipo de óleo" value={quote.oilType} onChange={(v) => setQuote((c) => ({ ...c, oilType: v }))} />
            <Field label="Filtro" value={quote.oilFilter} onChange={(v) => setQuote((c) => ({ ...c, oilFilter: v }))} />
            <Field label="Valor do orçamento (R$)" value={quote.quoteValue} onChange={(v) => setQuote((c) => ({ ...c, quoteValue: v }))} />
            <div>
              <Label>Técnico responsável</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3" value={quote.technicianId} onChange={(event) => setQuote((c) => ({ ...c, technicianId: event.target.value }))}>
                <option value="">Selecione</option>
                {technicians.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <textarea className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-3" value={quote.observations} onChange={(event) => setQuote((c) => ({ ...c, observations: event.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveQuote}>{quoteId ? "Atualizar orçamento" : "Salvar orçamento"}</Button>
            {quoteId ? <Button variant="outline" onClick={resetQuote}>Cancelar edição</Button> : null}
          </div>
        </section>
      ) : null}
      {tab === "nova-troca" ? (
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">NOVA TROCA DE ÓLEO</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do cliente" value={changeForm.customerName} onChange={(v) => setChangeForm((c) => ({ ...c, customerName: v }))} />
            <Field label="Data de aniversário do cliente" type="date" value={changeForm.birthDate} onChange={(v) => setChangeForm((c) => ({ ...c, birthDate: v }))} />
            <Field label="Telefone / WhatsApp" value={changeForm.whatsapp} onChange={(v) => setChangeForm((c) => ({ ...c, whatsapp: v }))} />
            <Field label="Veículo" value={changeForm.vehicle} onChange={(v) => setChangeForm((c) => ({ ...c, vehicle: v }))} />
            <Field label="Placa" value={changeForm.plate} onChange={(v) => setChangeForm((c) => ({ ...c, plate: v }))} />
            <Field label="KM atual" value={changeForm.currentKm} onChange={(v) => setChangeForm((c) => ({ ...c, currentKm: v }))} />
            <Field label="KM da última troca" value={changeForm.lastChangeKm} onChange={(v) => setChangeForm((c) => ({ ...c, lastChangeKm: v }))} />
            <Field label="Data da última troca" type="date" value={changeForm.lastChangeDate} onChange={(v) => setChangeForm((c) => ({ ...c, lastChangeDate: v }))} />
            <Field label="Quantos KM deveria rodar até a próxima troca" value={changeForm.kmInterval} onChange={(v) => setChangeForm((c) => ({ ...c, kmInterval: v }))} />
            <div>
              <Label>Técnico responsável</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3" value={changeForm.technicianId} onChange={(event) => setChangeForm((c) => ({ ...c, technicianId: event.target.value }))}>
                <option value="">Selecione</option>
                {technicians.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead><tr className="text-left"><th className="p-2">Item da troca</th><th className="p-2">Quantidade</th><th className="p-2">Valor unitário</th><th className="p-2">Valor total</th></tr></thead>
              <tbody>
                {[
                  ["oil", "Óleo (litros)", "oilQuantity", "oilUnitValue"],
                  ["oilFilter", "Filtro de óleo", "oilFilterQuantity", "oilFilterUnitValue"],
                  ["airFilter", "Filtro de ar", "airFilterQuantity", "airFilterUnitValue"],
                  ["fuelFilter", "Filtro de combustível", "fuelFilterQuantity", "fuelFilterUnitValue"],
                  ["cabinFilter", "Filtro de ar condicionado", "cabinFilterQuantity", "cabinFilterUnitValue"],
                ].map(([key, label, qtyKey, unitKey]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="p-2 font-medium">{label}</td>
                    <td className="p-2"><Input type="number" value={(changeForm as never as Record<string, string>)[qtyKey]} onChange={(event) => setChangeForm((c) => ({ ...c, [qtyKey]: event.target.value }))} /></td>
                    <td className="p-2"><Input type="number" value={(changeForm as never as Record<string, string>)[unitKey]} onChange={(event) => setChangeForm((c) => ({ ...c, [unitKey]: event.target.value }))} /></td>
                    <td className="p-2">{currency((numberValue((changeForm as never as Record<string, string>)[qtyKey]) || 0) * (numberValue((changeForm as never as Record<string, string>)[unitKey]) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Field label="Outros serviços" value={changeForm.otherServices} onChange={(v) => setChangeForm((c) => ({ ...c, otherServices: v }))} />
          <div><Label>Observações</Label><textarea className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3" value={changeForm.observations} onChange={(event) => setChangeForm((c) => ({ ...c, observations: event.target.value }))} /></div>
          <p className="text-lg font-bold">Valor total: {currency(changeTotal)}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button onClick={saveChange}>{changeId ? "Atualizar troca" : "Salvar nova troca"}</Button>
            {changeId ? <Button variant="outline" onClick={() => { setChangeId(null); resetChange(); }}>Cancelar edição</Button> : null}
          </div>
        </section>
      ) : null}
      {tab === "clientes" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl">CLIENTES / VENCIMENTOS</h2>
            <select className="h-10 rounded-md border border-input bg-background px-3" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
              <option>Todos</option><option>Vence em 20 dias</option><option>Vence este mês</option><option>Vencidos</option>
            </select>
          </div>
          <div className="grid gap-4">
            {filteredCustomers.map((item) => {
              const m = metrics(item.lastChangeDate, item.currentKm, item.lastChangeKm, item.kmInterval);
              const highlight = m.status === "Vencido" ? "border-red-500 bg-red-50 text-slate-950" : m.status === "Próximo do vencimento" ? "border-amber-400 bg-amber-50 text-slate-950" : "border-border bg-background";
              return (
                <article key={`${item.kind}-${item.id}`} className={`rounded-xl border p-5 ${highlight}`}>
                  <h3 className="text-xl font-bold">{item.customerName}</h3>
                  <p className="mt-1 font-semibold">{item.vehicle} · {item.plate}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <p><strong>KM atual:</strong><br />{item.currentKm.toLocaleString("pt-BR")} km</p>
                    <p><strong>Data prevista:</strong><br />{formatBR(m.finalDate)}</p>
                    <p><strong>Dias restantes:</strong><br />{m.finalDays}</p>
                    <p><strong>Status:</strong><br />{m.status}</p>
                    <p><strong>KM restante:</strong><br />{Math.max(0, m.kmRemaining).toLocaleString("pt-BR")} km</p>
                    <p><strong>Média KM/dia:</strong><br />{m.average.toFixed(1)}</p>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {m.finalDays <= 20 ? <Button className="bg-green-600 hover:bg-green-700" onClick={() => window.open(whatsappUrl(item.whatsapp, companyWhatsappMessage(item)), "_blank", "noopener")}><MessageCircle className="size-4" /> Enviar WhatsApp</Button> : null}
                    <Button variant="outline" onClick={() => item.kind === "quote" ? editQuote(item.original as OilQuote) : editChange(item.original as OilChange)}><Pencil className="size-4" /> Editar</Button>
                    <Button variant="outline" onClick={() => item.kind === "quote" ? void quotePdf(item.original as OilQuote, false) : void changePdf(item.original as OilChange, false)}><Download className="size-4" /> Gerar PDF</Button>
                    <Button variant="outline" onClick={() => item.kind === "quote" ? void quotePdf(item.original as OilQuote, true) : void changePdf(item.original as OilChange, true)}><Share2 className="size-4" /> PDF WhatsApp</Button>
                  </div>
                </article>
              );
            })}
            {filteredCustomers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cliente encontrado neste filtro.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "aniversariantes" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">ANIVERSARIANTES</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><Label>Filtro</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3" value={birthdayFilter} onChange={(event) => setBirthdayFilter(event.target.value)}><option value="month">Por mês</option><option value="period">Por período</option><option value="today">Hoje</option><option value="week">Esta semana</option></select></div>
            <Field label="Mês" type="month" value={birthdayMonth} onChange={setBirthdayMonth} />
            <Field label="Data inicial" type="date" value={birthdayFrom} onChange={setBirthdayFrom} />
            <Field label="Data final" type="date" value={birthdayTo} onChange={setBirthdayTo} />
          </div>
          <div className="grid gap-3">
            {birthdayCustomers.map((item) => {
              const age = parseISO(todayISO()).getFullYear() - parseISO(item.birthDate).getFullYear();
              const birthdayMessage = `Feliz aniversário ${item.customerName}! Que Deus abençoe você e sua família. Passa aqui no ${companyName} pra tomar um café com a gente! Equipe ${companyName}`;
              return (
                <article key={`${item.kind}-${item.id}`} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-bold">{item.customerName}</p><p className="text-sm text-muted-foreground">Nascimento: {formatBR(item.birthDate)} · Vai fazer {age} anos · {item.vehicle} · WhatsApp: {item.whatsapp}</p></div>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => window.open(whatsappUrl(item.whatsapp, birthdayMessage), "_blank", "noopener")}><Cake className="size-4" /> Enviar Parabéns</Button>
                </article>
              );
            })}
            {birthdayCustomers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aniversariante encontrado.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "tecnico" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">TÉCNICO EM LUBRIFICAÇÃO</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nome" value={techForm.fullName} onChange={(v) => setTechForm((c) => ({ ...c, fullName: v }))} />
            <Field label="Telefone" value={techForm.mobilePhone} onChange={(v) => setTechForm((c) => ({ ...c, mobilePhone: v }))} />
            <div><Label>Foto</Label><Input className="mt-1" type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setTechForm((c) => ({ ...c, photoUrl: String(reader.result ?? "") }));
              reader.readAsDataURL(file);
            }} /></div>
          </div>
          <Button onClick={saveTechnician}><UserRoundPlus className="size-4" /> Cadastrar técnico</Button>
          <div className="grid gap-3 sm:grid-cols-2">
            {technicians.map((item) => (
              <article key={item.id} className="flex items-center gap-3 rounded-xl border border-border p-4">
                {item.photoUrl ? <img src={item.photoUrl} alt="" className="size-16 rounded-full object-cover" /> : <div className="flex size-16 items-center justify-center rounded-full bg-muted"><Droplets /></div>}
                <div className="min-w-0"><p className="font-bold">{item.fullName}</p><p className="text-sm text-muted-foreground">{item.mobilePhone}</p></div>
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => actions.removeOilTechnician(item.id)} aria-label="Excluir técnico"><Trash2 className="size-4 text-destructive" /></Button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "metas" ? (
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">METAS E ALVO</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta do mês (R$)" value={String(commissionDraft.salesGoal)} onChange={(v) => setCommissionDraft((c) => ({ ...c, salesGoal: numberValue(v) }))} />
            <Field label="Alvo (R$)" value={String(commissionDraft.technicianGoal)} onChange={(v) => setCommissionDraft((c) => ({ ...c, technicianGoal: numberValue(v) }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-border p-4"><input type="radio" name="commission-mode" checked={commissionDraft.mode !== "fixed"} onChange={() => setCommissionDraft((c) => ({ ...c, mode: "percent" }))} /> <strong className="ml-2">OPÇÃO A — POR PORCENTAGEM</strong></label>
            <label className="rounded-xl border border-border p-4"><input type="radio" name="commission-mode" checked={commissionDraft.mode === "fixed"} onChange={() => setCommissionDraft((c) => ({ ...c, mode: "fixed" }))} /> <strong className="ml-2">OPÇÃO B — POR VALORES FIXOS</strong></label>
          </div>
          {commissionDraft.mode !== "fixed" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Percentual sobre o total até a meta (%)" value={String(commissionDraft.salesCommissionPct)} onChange={(v) => setCommissionDraft((c) => ({ ...c, salesCommissionPct: numberValue(v) }))} />
              <Field label="Percentual sobre o total acima do alvo (%)" value={String(commissionDraft.technicianCommissionPct)} onChange={(v) => setCommissionDraft((c) => ({ ...c, technicianCommissionPct: numberValue(v) }))} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Comissão por litro de óleo (R$)" value={String(commissionDraft.fixedOilLiter ?? 0)} onChange={(v) => setCommissionDraft((c) => ({ ...c, fixedOilLiter: numberValue(v) }))} />
              <Field label="Comissão por filtro de óleo (R$)" value={String(commissionDraft.fixedOilFilter ?? 0)} onChange={(v) => setCommissionDraft((c) => ({ ...c, fixedOilFilter: numberValue(v) }))} />
              <Field label="Comissão por filtro de ar (R$)" value={String(commissionDraft.fixedAirFilter ?? 0)} onChange={(v) => setCommissionDraft((c) => ({ ...c, fixedAirFilter: numberValue(v) }))} />
              <Field label="Comissão por filtro de combustível (R$)" value={String(commissionDraft.fixedFuelFilter ?? 0)} onChange={(v) => setCommissionDraft((c) => ({ ...c, fixedFuelFilter: numberValue(v) }))} />
              <Field label="Comissão por filtro de ar condicionado (R$)" value={String(commissionDraft.fixedCabinFilter ?? 0)} onChange={(v) => setCommissionDraft((c) => ({ ...c, fixedCabinFilter: numberValue(v) }))} />
            </div>
          )}
          <Button onClick={() => { actions.setOilCommission(commissionDraft); setStatus("Meta e regra de comissão salvas."); }}>Salvar metas e alvo</Button>
        </section>
      ) : null}

      {tab === "comissoes" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">RELATÓRIO DE COMISSÕES</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="De" type="date" value={reportFrom} onChange={setReportFrom} />
            <Field label="Até" type="date" value={reportTo} onChange={setReportTo} />
            <div><Label>Técnico</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3" value={reportTechnician} onChange={(event) => setReportTechnician(event.target.value)}><option value="todos">Todos</option>{technicians.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></div>
          </div>
          <div className="grid gap-3">
            {reportData.map((item) => (
              <article key={item.technician.id} className="rounded-xl border border-border p-4">
                <p className="text-lg font-bold">{item.technician.fullName}</p>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p>Total de trocas: <strong>{item.services.length}</strong></p><p>Litros de óleo: <strong>{item.liters}</strong></p><p>Total vendido: <strong>{currency(item.sales)}</strong></p><p>Comissão: <strong>{currency(item.commission)}</strong></p>
                  <p>Filtro óleo: <strong>{item.oilFilters}</strong></p><p>Filtro ar: <strong>{item.airFilters}</strong></p><p>Filtro combustível: <strong>{item.fuelFilters}</strong></p><p>Filtro ar condicionado: <strong>{item.cabinFilters}</strong></p>
                </div>
              </article>
            ))}
            {reportData.length === 0 ? <p className="text-sm text-muted-foreground">Cadastre técnicos para gerar o relatório.</p> : null}
          </div>
          <p className="font-bold">Total de comissões: {currency(reportData.reduce((sum, item) => sum + item.commission, 0))}</p>
          <div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => void reportPdf(false)}><Download className="size-4" /> Gerar PDF</Button><Button variant="outline" onClick={() => void reportPdf(true)}><Share2 className="size-4" /> Compartilhar PDF por WhatsApp</Button></div>
        </section>
      ) : null}

      {tab === "lembretes" ? (
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">LEMBRETES</h2>
          <div>
            <h3 className="mb-3 font-bold">Próximos vencimentos</h3>
            <div className="grid gap-3">
              {reminders.map(({ item }) => {
                const m = metrics(item.lastChangeDate, item.currentKm, item.lastChangeKm, item.kmInterval);
                if (m.status === "Em dia" && m.finalDays > 30) return null;
                return <article key={`reminder-${item.kind}-${item.id}`} className={`rounded-xl border p-4 ${m.status === "Vencido" ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"}`}><p className="font-bold">{item.customerName} · {item.vehicle} · {item.plate}</p><p className="text-sm">Vence em {formatBR(m.finalDate)} · {m.finalDays} dia(s) · {m.status}</p></article>;
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-3 font-bold">Próximos aniversários</h3>
            <div className="grid gap-3">
              {birthdayReminders.map((item) => <article key={`birthday-${item.kind}-${item.id}`} className="rounded-xl border border-pink-300 bg-pink-50 p-4 text-slate-950"><p className="font-bold">{item.customerName}</p><p className="text-sm">{formatBR(item.birthDate)} · {item.vehicle} · WhatsApp {item.whatsapp}</p></article>)}
              {birthdayReminders.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aniversário próximo.</p> : null}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
