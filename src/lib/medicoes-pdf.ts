import type { AppState } from "@/lib/store";
import { estimatedLevel, fmtL, formatBR, totalSalesOfDay, weekdayBR } from "@/lib/store";

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

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  y = 26;
  text("POSTO 10", margin, 16, true);
  y = 44;
  text("Relatório de medições e vendas", margin, 10);
  doc.setTextColor(0, 0, 0);
  y = 84;
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
    nl(22);
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

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Posto 10 · página ${p} de ${pages}`, margin, pageH - 18);
  }

  return doc.output("blob");
}
