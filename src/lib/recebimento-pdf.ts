import type { Delivery } from "@/lib/store";
import { fmtL, formatBR } from "@/lib/store";

export function recebimentoFileName(delivery: Delivery) {
  const nf = delivery.nf.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `recebimento-${delivery.date}-nf-${nf || "sem-numero"}.pdf`;
}

export async function buildRecebimentoPdf(delivery: Delivery): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = 36;

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

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  y = 26;
  text("POSTO 10", margin, 16, true);
  y = 44;
  text("Relatório de recebimento de combustíveis", margin, 10);
  doc.setTextColor(0, 0, 0);
  y = 84;

  text(`Data: ${formatBR(delivery.date)}`, margin, 11, true);
  next(17);
  text(`Distribuidora: ${delivery.distribuidora}`, margin, 11, true);
  next(17);
  text(`Nota fiscal: ${delivery.nf}`, margin, 11, true);
  next(26);

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

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Posto 10 · NF ${delivery.nf} · página ${page} de ${pages}`, margin, pageH - 18);
  }

  return doc.output("blob");
}