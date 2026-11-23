import type { AppState } from "@/lib/store";
import { estimatedLevel, fmtL, formatBR, totalSalesOfDay, weekdayBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";
import { calculateDailySalesSummary } from "@/lib/daily-sales-summary";

function datesInRange(s: AppState, from: string, to: string) {
  const keys = new Set([...Object.keys(s.openings), ...Object.keys(s.sales)]);
  return [...keys].filter((d) => d >= from && d <= to).sort();
}

export function medicoesFileName(from: string, to: string) {
  return from === to ? `medicoes-${from}.pdf` : `medicoes-${from}_a_${to}.pdf`;
}

export async function buildMedicoesPdf(
  state: AppState,
  from: string,
  to: string,
  periodLabel: string,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  const nl = (h = 14) => {
    y += h;
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const text = (t: string, x: number, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(t, x, y);
  };

  y = drawPdfHeader(doc, state, "Relatório de medições e vendas");
  text(`Filtro: ${periodLabel}`, margin, 11, true);
  nl();
  text(`Período: ${formatBR(from)} a ${formatBR(to)}`, margin, 10);
  nl(20);

  const days = datesInRange(state, from, to);
  if (days.length === 0) {
    text("Nenhuma medição ou venda registrada no período.", margin, 10);
  }

  const shifts = Array.from({ length: state.shifts }, (_, i) => i + 1);
  const colTank = margin;
  const colOpen = margin + 150;
  const shiftW = 62;
  const colShift = (i: number) => colOpen + 70 + i * shiftW;
  const colTotal = () => colShift(shifts.length) + 10;

  const geralPorTanque: Record<string, number> = {};

  for (const date of days) {
    if (y > pageH - margin - 90) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(200);
    doc.line(margin, y - 8, pageW - margin, y - 8);
    text(`${formatBR(date)} — ${weekdayBR(date)}`, margin, 11, true);
    nl(16);

    text("Combustível", colTank, 8, true);
    text("Medição", colOpen, 8, true);
    shifts.forEach((sh, i) => text(`T${sh}`, colShift(i), 8, true));
    text("Total", colTotal(), 8, true);
    nl(13);

    let totalDia = 0;
    state.tanks.forEach((t, idx) => {
      const open = state.openings[date]?.[t.id];
      const sold = totalSalesOfDay(state, date, t.id);
      totalDia += sold;
      geralPorTanque[t.id] = (geralPorTanque[t.id] ?? 0) + sold;
      text(`${idx + 1}. ${t.name}`.slice(0, 26), colTank, 9);
      text(open !== undefined ? fmtL(open) : "—", colOpen, 9);
      shifts.forEach((sh, i) => {
        const v = state.sales[date]?.[sh]?.[t.id];
        text(v !== undefined ? fmtL(v) : "—", colShift(i), 9);
      });
      text(fmtL(sold), colTotal(), 9);
      nl(12);
      const level = estimatedLevel(state, date, t.id);
      if (level !== undefined) {
        doc.setTextColor(110);
        text(`estoque estimado ${fmtL(level)} de ${fmtL(t.capacity)}`, colTank + 10, 7);
        doc.setTextColor(0);
        nl(11);
      }
    });
    text(`Total vendido no dia: ${fmtL(totalDia)}`, colTank, 9, true);
    nl(16);

    const resumo = calculateDailySalesSummary(
      state.tanks,
      (shift, tankId) => state.sales[date]?.[shift]?.[tankId],
    );
    const cardX = margin;
    const cardW = pageW - margin * 2;
    const columnCount = Math.max(2, Math.floor(cardW / 100));
    const fuelColumns = columnCount - 1;
    const rowCount = Math.max(1, Math.ceil(resumo.fuels.length / fuelColumns));
    const rowHeight = 30;
    const cardH = 20 + rowCount * rowHeight;
    if (y - 8 + cardH > pageH - margin) {
      doc.addPage();
      y = margin + 8;
    }
    const cardY = y - 8;
    const cellW = cardW / columnCount;
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(1);
    doc.roundedRect(cardX, cardY, cardW, cardH, 5, 5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text("RESUMO DO DIA - TOTALIZADO", cardX + 8, cardY + 11);

    resumo.fuels.forEach((fuel, index) => {
      const row = Math.floor(index / fuelColumns);
      const column = index % fuelColumns;
      const centerX = cardX + cellW * column + cellW / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(55, 65, 81);
      doc.text(fuel.name.toLocaleUpperCase("pt-BR"), centerX, cardY + 25 + row * rowHeight, {
        align: "center",
        maxWidth: cellW - 8,
      });
      doc.setFontSize(9);
      doc.text(
        `${Math.round(fuel.liters).toLocaleString("pt-BR")} L`,
        centerX,
        cardY + 38 + row * rowHeight,
        { align: "center" },
      );
    });

    const totalX = cardX + cellW * (columnCount - 1);
    const totalY = cardY + 20 + (rowCount - 1) * rowHeight;
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(totalX, totalY, cellW, rowHeight, 5, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("TOTAL DO DIA", totalX + cellW / 2, totalY + 9, { align: "center" });
    doc.setFontSize(9);
    const totalLabelY = resumo.mixAditivada === null ? totalY + 23 : totalY + 20;
    doc.text(
      `${Math.round(resumo.totalGeralLitros).toLocaleString("pt-BR")} L`,
      totalX + cellW / 2,
      totalLabelY,
      { align: "center" },
    );
    if (resumo.mixAditivada !== null) {
      doc.setFontSize(6);
      doc.text(
        `Mix ${resumo.mixAditivada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
        totalX + cellW / 2,
        totalY + 28,
        { align: "center" },
      );
    }
    doc.setTextColor(0);
    nl(cardH + 10);
  }

  if (days.length > 0) {
    if (y > pageH - margin - 80) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(120);
    doc.line(margin, y - 8, pageW - margin, y - 8);
    text("Total do período por combustível", margin, 11, true);
    nl(16);
    let geral = 0;
    state.tanks.forEach((t, idx) => {
      const v = geralPorTanque[t.id] ?? 0;
      geral += v;
      text(`${idx + 1}. ${t.name}`.slice(0, 26), colTank, 9);
      text(fmtL(v), colOpen, 9);
      nl(12);
    });
    nl(4);
    text(`TOTAL GERAL: ${fmtL(geral)}`, colTank, 11, true);
  }

  drawPdfFooter(doc, state, `${formatBR(from)} a ${formatBR(to)}`);
  return doc.output("blob");
}
