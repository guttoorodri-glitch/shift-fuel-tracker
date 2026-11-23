import jsPDF from "jspdf";
import type { AppState, OilQuote } from "@/lib/store";
import { formatBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";

export function oilQuoteFileName(quote: OilQuote) {
  const plate = quote.plate.replace(/[^a-zA-Z0-9]/g, "") || "veiculo";
  return `orcamento-troca-oleo-${plate}.pdf`;
}

export async function buildOilQuotePdf(state: AppState, quote: OilQuote, predictedDate: string): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  let y = drawPdfHeader(doc, state, "Orçamento — Troca de óleo");

  const write = (text: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 510) as string[];
    for (const line of lines) {
      doc.text(line, margin, y);
      y += size + 7;
    }
  };

  write("DADOS DO CLIENTE", 13, true);
  write(`Nome: ${quote.customerName}`);
  write(`Data de nascimento: ${formatBR(quote.birthDate)}`);
  write(`Telefone / WhatsApp: ${quote.whatsapp}`);
  const technician = state.oilTechnicians?.find((item) => item.id === quote.technicianId);
  write(`Técnico responsável: ${technician?.fullName || "Não informado"}`);
  y += 8;

  write("VEÍCULO", 13, true);
  write(`Veículo: ${quote.vehicle}`);
  write(`Placa: ${quote.plate}`);
  write(`KM atual: ${quote.currentKm.toLocaleString("pt-BR")} km`);
  write(`Data da última troca: ${formatBR(quote.lastChangeDate)}`);
  write(`Previsão da próxima troca: ${formatBR(predictedDate)}`, 11, true);
  y += 8;

  write("ITENS DO ORÇAMENTO", 13, true);
  write(`Óleo: ${quote.oilType || "Não informado"}`);
  write(`Filtro: ${quote.oilFilter || "Não informado"}`);
  if (quote.observations.trim()) write(`Observações: ${quote.observations}`);
  y += 10;
  write(`VALOR TOTAL: ${quote.quoteValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 15, true);
  y += 12;
  write(`Validade do orçamento: 7 dias (até ${formatBR(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))})`, 11, true);

  drawPdfFooter(doc, state, "Orçamento de troca de óleo");
  return doc.output("blob");
}
