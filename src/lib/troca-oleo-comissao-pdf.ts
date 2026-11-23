import jsPDF from "jspdf";
import type { AppState, OilChange, OilTechnician } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";
import { formatBR } from "@/lib/store";

export function oilCommissionFileName(from: string, to: string) {
  return `comissoes-lubrificacao-${from}-a-${to}.pdf`;
}

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function buildOilCommissionPdf(
  state: AppState,
  from: string,
  to: string,
  selectedTechnicianId: string,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const config = state.oilCommission ?? {
    salesGoal: 0,
    salesCommissionPct: 0,
    technicianGoal: 0,
    technicianCommissionPct: 0,
    mode: "percent",
    fixedOilLiter: 0,
    fixedOilFilter: 0,
    fixedAirFilter: 0,
    fixedFuelFilter: 0,
    fixedCabinFilter: 0,
  };
  const technicians = (state.oilTechnicians ?? []).filter(
    (technician) => selectedTechnicianId === "todos" || technician.id === selectedTechnicianId,
  );
  const changes = (state.oilChanges ?? []).filter((change) => change.date >= from && change.date <= to);
  let y = drawPdfHeader(doc, state, "Relatório de comissões de lubrificação");

  const write = (text: string, size = 10, bold = false, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 510 - indent) as string[];
    for (const line of lines) {
      if (y > pageHeight - 64) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y);
      y += size + 5;
    }
  };

  write(`Período: ${formatBR(from)} a ${formatBR(to)}`, 11, true);
  write(`Valor da meta: ${currency(config.salesGoal)} · Comissão meta: ${config.salesCommissionPct}%`);
  write(`Valor do alvo: ${currency(config.technicianGoal)} · Comissão alvo: ${config.technicianCommissionPct}%`);
  y += 8;

  if (technicians.length === 0) {
    write("Nenhum técnico em lubrificação cadastrado para este relatório.");
  }

  for (const technician of technicians) {
    const technicianChanges = changes.filter(
      (change) => change.technicianId === technician.id || change.technician === technician.fullName,
    );
    const totalSales = technicianChanges.reduce((sum, change) => sum + (change.totalValue || 0), 0);
    const liters = technicianChanges.reduce((sum, change) => sum + (change.itemQuantities?.oil ?? change.quantity), 0);
    const count = (key: "oilFilter" | "airFilter" | "fuelFilter" | "cabinFilter") =>
      technicianChanges.reduce((sum, change) => sum + (change.itemQuantities?.[key] ?? (change[key] ? 1 : 0)), 0);
    const commissionRate = totalSales > config.technicianGoal
      ? config.technicianCommissionPct
      : config.salesCommissionPct;
    const commission = config.mode === "fixed"
      ? liters * (config.fixedOilLiter ?? 0)
        + count("oilFilter") * (config.fixedOilFilter ?? 0)
        + count("airFilter") * (config.fixedAirFilter ?? 0)
        + count("fuelFilter") * (config.fixedFuelFilter ?? 0)
        + count("cabinFilter") * (config.fixedCabinFilter ?? 0)
      : (totalSales * commissionRate) / 100;

    if (y > pageHeight - 220) {
      doc.addPage();
      y = margin;
    }
    write(technician.fullName.toUpperCase(), 13, true);
    write(`CPF: ${technician.cpf} · RG: ${technician.rg}`);
    write(`Celular: ${technician.mobilePhone} · Data do registro: ${formatBR(technician.registeredAt)}`);
    write(`Serviços no período: ${technicianChanges.length} · Total vendido: ${currency(totalSales)}`);
    write(config.mode === "fixed"
      ? `Regra fixa · Litros: ${liters} · Comissão: ${currency(commission)}`
      : `Faixa aplicada: ${commissionRate}% (${totalSales > config.technicianGoal ? "acima do alvo" : "até o alvo"}) · Comissão: ${currency(commission)}`, 11, true);
    y += 5;

    for (const change of technicianChanges) {
      write(`${formatBR(change.date)} · ${change.customerName} · ${change.lubricant} · ${change.quantity} L · ${change.mileage.toLocaleString("pt-BR")} km · ${currency(change.totalValue)}`, 9, false, 8);
    }

    y += 10;
    if (y > pageHeight - 160) {
      doc.addPage();
      y = margin;
    }
    write("RECIBO DE COMISSÃO", 11, true);
    write(config.mode === "fixed"
      ? `Recebi de ${state.company?.name || "Posto 10"} o valor de ${currency(commission)}, calculado pela regra de valores fixos por litro e filtros, referente à comissão de lubrificação do período de ${formatBR(from)} a ${formatBR(to)}.`
      : `Recebi de ${state.company?.name || "Posto 10"} o valor de ${currency(commission)}, calculado à taxa de ${commissionRate}% (${totalSales > config.technicianGoal ? "comissão alvo" : "comissão meta"}), referente à comissão de lubrificação do período de ${formatBR(from)} a ${formatBR(to)}.`, 10);
    y += 35;
    doc.setDrawColor(80);
    doc.line(margin + 25, y, margin + 285, y);
    y += 14;
    write(technician.fullName, 9, true);
    write(`CPF: ${technician.cpf} · Assinatura do técnico em lubrificação`, 8);
    y += 24;
  }

  if (technicians.length > 0 && changes.length === 0) {
    write("Nenhuma troca de óleo foi registrada no período selecionado.");
  }

  drawPdfFooter(doc, state, `Comissões ${formatBR(from)} a ${formatBR(to)}`);
  return doc.output("blob");
}
