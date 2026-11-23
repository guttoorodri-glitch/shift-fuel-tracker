import jsPDF from "jspdf";
import type { AppState, OilChange } from "@/lib/store";
import { formatBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";

export function oilChangeFileName(change: OilChange) {
  const plate = (change.plate ?? "").replace(/[^a-zA-Z0-9]/g, "") || "veiculo";
  return `pedido-troca-oleo-${plate}.pdf`;
}

export async function buildOilChangePdf(state: AppState, change: OilChange, predictedDate: string): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  let y = drawPdfHeader(doc, state, "Pedido — Nova troca de óleo");
  const write = (text: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 510) as string[];
    for (const line of lines) {
      doc.text(line, margin, y);
      y += size + 7;
    }
  };
  write("DADOS DO CLIENTE E VEÍCULO", 13, true);
  write(`Nome: ${change.customerName}`);
  write(`Data de nascimento: ${change.birthDate ? formatBR(change.birthDate) : "Não informada"}`);
  write(`Telefone / WhatsApp: ${change.whatsapp}`);
  write(`Veículo: ${change.vehicle || "Não informado"} · Placa: ${change.plate || "Não informada"}`);
  write(`KM atual: ${(change.currentKm ?? change.mileage).toLocaleString("pt-BR")} km`);
  write(`Técnico responsável: ${change.technician || "Não informado"}`);
  y += 8;
  write("ITENS DA TROCA", 13, true);
  const quantities = change.itemQuantities ?? {};
  const values = change.itemValues ?? {};
  const items = [
    ["Óleo", quantities.oil ?? change.quantity, values.oil ?? change.totalValue],
    ["Filtro de óleo", quantities.oilFilter ?? (change.oilFilter ? 1 : 0), values.oilFilter ?? 0],
    ["Filtro de ar", quantities.airFilter ?? (change.airFilter ? 1 : 0), values.airFilter ?? 0],
    ["Filtro de combustível", quantities.fuelFilter ?? (change.fuelFilter ? 1 : 0), values.fuelFilter ?? 0],
    ["Filtro de ar condicionado", quantities.cabinFilter ?? (change.cabinFilter ? 1 : 0), values.cabinFilter ?? 0],
  ] as [string, number, number][];
  let total = 0;
  for (const [description, quantity, unitValue] of items) {
    if (quantity <= 0) continue;
    const itemTotal = quantity * unitValue;
    total += itemTotal;
    write(`${description} | Quantidade: ${quantity} | Valor unitário: ${unitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | Valor total: ${itemTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
  }
  if (change.otherServices) write(`Outros serviços: ${change.otherServices}`);
  if (change.observations) write(`Observações: ${change.observations}`);
  y += 10;
  write(`VALOR TOTAL DA TROCA: ${(total || change.totalValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 15, true);
  write(`Data prevista da próxima troca: ${formatBR(predictedDate)}`, 11, true);
  drawPdfFooter(doc, state, "Pedido de troca de óleo");
  return doc.output("blob");
}
