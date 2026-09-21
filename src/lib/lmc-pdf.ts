import jsPDF from "jspdf";
import type { AppState, LmcRow } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";
import { formatBR, fmtL } from "@/lib/store";

export function lmcFileName(from: string, to: string) {
  return from === to ? `lmc-${from}.pdf` : `lmc-${from}_a_${to}.pdf`;
}

const text = (value: number | undefined, percent = false) => {
  if (value === undefined) return "—";
  return percent ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : fmtL(value);
};

export async function buildLmcPdf(
  state: AppState,
  rows: LmcRow[],
  from: string,
  to: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  let y = drawPdfHeader(doc, state, "Relatório LMC");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 28;
  const columns = [
    { label: "Data", width: 55 },
    { label: "Combustível", width: 105 },
    { label: "Físico inicial", width: 78 },
    { label: "Vendas T1+T2", width: 78 },
    { label: "Recebimento", width: 78 },
    { label: "Escritural", width: 78 },
    { label: "Físico dia seguinte", width: 88 },
    { label: "Diferença LMC", width: 82 },
    { label: "%", width: 45 },
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const left = Math.max(margin, (pageWidth - tableWidth) / 2);
  const rowHeight = 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Período: ${formatBR(from)} a ${formatBR(to)}`, left, y);
  y += 18;

  const drawHeader = () => {
    doc.setFillColor(35, 40, 48);
    doc.setTextColor(255, 255, 255);
    doc.rect(left, y, tableWidth, rowHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    let x = left;
    for (const column of columns) {
      doc.text(column.label, x + 4, y + 14, { maxWidth: column.width - 8 });
      x += column.width;
    }
    y += rowHeight;
  };

  let previousTankId: string | null = null;
  const drawRow = (row: LmcRow, index: number) => {
    if (row.tankId !== previousTankId) {
      if (y + rowHeight > doc.internal.pageSize.getHeight() - 35) {
        doc.addPage();
        y = 36;
        drawHeader();
      }
      doc.setFillColor(225, 229, 235);
      doc.setTextColor(30, 35, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.rect(left, y, tableWidth, rowHeight, "F");
      doc.text(`Tanque: ${row.fuel}`, left + 4, y + 14);
      y += rowHeight;
      previousTankId = row.tankId;
    }
    if (y + rowHeight > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage();
      y = 36;
      drawHeader();
    }
    doc.setFillColor(index % 2 === 0 ? 248 : 238, index % 2 === 0 ? 249 : 241, 250);
    doc.setTextColor(row.divergent ? 180 : 30, row.divergent ? 35 : 35, row.divergent ? 35 : 40);
    doc.rect(left, y, tableWidth, rowHeight, "F");
    doc.setFont("helvetica", row.divergent ? "bold" : "normal");
    doc.setFontSize(7.5);
    const values = [
      formatBR(row.date),
      row.fuel,
      text(row.opening),
      text(row.sales),
      text(row.received),
      text(row.bookStock),
      text(row.nextPhysical),
      text(row.difference),
      text(row.lossPercent, true),
    ];
    let x = left;
    values.forEach((value, valueIndex) => {
      const column = columns[valueIndex];
      const alignRight = valueIndex >= 2;
      doc.text(value, alignRight ? x + column.width - 4 : x + 4, y + 14, {
        align: alignRight ? "right" : "left",
        maxWidth: column.width - 8,
      });
      x += column.width;
    });
    y += rowHeight;
  };

  drawHeader();
  rows.forEach(drawRow);
  if (rows.length === 0) {
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Nenhum registro encontrado no período.", left, y + 14);
  }

  drawPdfFooter(doc, state, "LMC");
  return doc.output("blob");
}
