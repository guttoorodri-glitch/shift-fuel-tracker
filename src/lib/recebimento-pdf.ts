import type { AppState, Delivery } from "@/lib/store";
import { fmtL, formatBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";

export function recebimentoFileName(delivery: Delivery) {
  const nf = delivery.nf.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `recebimento-${delivery.date}-nf-${nf || "sem-numero"}.pdf`;
}

export async function buildRecebimentoPdf(delivery: Delivery, state?: AppState): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = drawPdfHeader(doc, state, "Relatório de recebimento de combustíveis");

  const text = (value: string, x: number, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(value, x, y);
  };

  const next = (height = 14) => {
    y += height;
    if (y > pageH - margin - 30) {
      doc.addPage();
      y = margin;
    }
  };

  text(`Data: ${formatBR(delivery.date)}`, margin, 11, true);
  next(17);
  text(`Distribuidora: ${delivery.distribuidora}`, margin, 11, true);
  next(17);
  text(`Nota fiscal: ${delivery.nf}`, margin, 11, true);
  next(26);
  text(`Motorista: ${delivery.motorista || "Não informado"}`, margin, 9);
  next(14);
  text(`RG: ${delivery.rgMotorista || "Não informado"}`, margin, 9);
  next(14);
  text(`Placa do caminhão: ${delivery.placaCaminhao || "Não informada"}`, margin, 9);
  next(14);
  text(`Responsável pela análise: ${delivery.responsavelAnalise || "Não informado"}`, margin, 9);
  next(24);

  const fuelX = margin;
  const qtyX = pageW - margin - 95;
  doc.setDrawColor(170);
  doc.line(margin, y - 9, pageW - margin, y - 9);
  text("Combustível e análise da descarga", fuelX, 10, true);
  text("Quantidade", qtyX, 10, true);
  next(18);

  let total = 0;
  delivery.items.forEach((item, index) => {
    if (y > pageH - margin - 75) {
      doc.addPage();
      y = margin;
    }
    total += item.qty;
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin - 4, y - 11, pageW - margin * 2 + 8, 52, "F");
    }
    text(item.fuel, fuelX, 10, true);
    text(fmtL(item.qty), qtyX, 10, true);
    next(16);
    text("Aspecto: LÍMPIDO, ISENTO DE IMPUREZAS", fuelX, 8);
    next(13);

    const analyses = [
      item.temperatura !== undefined ? `Temperatura: ${item.temperatura} °C` : null,
      item.densidade !== undefined ? `Densidade: ${item.densidade}` : null,
      item.densidade20 !== undefined ? `Densidade a 20 °C: ${item.densidade20}` : null,
      item.teorAlcoolico !== undefined ? `Teor alcoólico: ${item.teorAlcoolico}%` : null,
      item.etanolPct !== undefined ? `Etanol na gasolina: ${item.etanolPct}%` : null,
      item.fulgor !== undefined ? `Ponto de fulgor: ${item.fulgor} °C` : null,
    ].filter((value): value is string => value !== null);

    doc.setTextColor(90);
    text(analyses.join("  ·  ") || "Análise não informada", fuelX, 8);
    doc.setTextColor(0);
    next(30);
  });

  doc.setDrawColor(120);
  doc.line(margin, y - 8, pageW - margin, y - 8);
  text(`TOTAL RECEBIDO: ${fmtL(total)}`, margin, 12, true);

  const hasIncomplete = delivery.items.some((item) => {
    const fuel = item.fuel.toLowerCase();
    const density = item.densidade20 ?? item.densidade;
    return (
      density === undefined ||
      (fuel.includes("etanol") && item.teorAlcoolico === undefined) ||
      (fuel.includes("diesel") && (item.fulgor === undefined || item.fulgor < 38))
    );
  });
  const stamp = hasIncomplete ? "DESCARGA NÃO AUTORIZADA" : "DESCARGA AUTORIZADA";
  const stampColor: [number, number, number] = hasIncomplete ? [220, 38, 38] : [22, 163, 74];
  doc.setTextColor(...stampColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(stamp, pageW / 2, y + 28, { align: "center" });
  doc.setTextColor(0, 0, 0);

  drawPdfFooter(doc, state, `NF ${delivery.nf}`);

  return doc.output("blob");
}
