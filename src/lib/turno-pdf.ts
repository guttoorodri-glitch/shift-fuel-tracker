import type { AppState } from "@/lib/store";
import { estimatedLevel, fmtL, formatBR, totalSalesOfDay, weekdayBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";

export function turnoFileName(date: string) {
  return `turnos-${date}.pdf`;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [120, 120, 120];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relatório do dia: medidas iniciais, vendas por turno e gráficos */
export async function buildTurnoPdf(state: AppState, date: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = drawPdfHeader(doc, state, "Relatório do dia — medições e vendas por turno");

  const text = (t: string, x: number, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(t, x, y);
  };
  const nl = (h = 14) => {
    y += h;
    if (y > pageH - margin - 24) {
      doc.addPage();
      y = margin;
    }
  };
  const room = (needed: number) => {
    if (y + needed > pageH - margin - 24) {
      doc.addPage();
      y = margin;
    }
  };

  text(`${formatBR(date)} — ${weekdayBR(date)}`, margin, 12, true);
  nl(22);

  const shifts = Array.from({ length: state.shifts }, (_, i) => i + 1);
  const colTank = margin;
  const colOpen = margin + 150;
  const shiftW = 62;
  const colShift = (i: number) => colOpen + 70 + i * shiftW;
  const colTotal = colShift(shifts.length) + 6;

  doc.setDrawColor(170);
  doc.line(margin, y - 9, pageW - margin, y - 9);
  text("Combustível", colTank, 8.5, true);
  text("Medição inicial", colOpen, 8.5, true);
  shifts.forEach((sh, i) => text(`T${sh}`, colShift(i), 8.5, true));
  text("Total", colTotal, 8.5, true);
  nl(15);

  let totalDia = 0;
  state.tanks.forEach((t, idx) => {
    room(26);
    const open = state.openings[date]?.[t.id];
    const sold = totalSalesOfDay(state, date, t.id);
    totalDia += sold;
    text(`${idx + 1}. ${t.name}`.slice(0, 26), colTank, 9);
    text(open !== undefined ? fmtL(open) : "—", colOpen, 9);
    shifts.forEach((sh, i) => {
      const v = state.sales[date]?.[sh]?.[t.id];
      text(v !== undefined ? fmtL(v) : "—", colShift(i), 9);
    });
    text(fmtL(sold), colTotal, 9);
    nl(12);
    const level = estimatedLevel(state, date, t.id);
    doc.setTextColor(110);
    text(
      level !== undefined
        ? `estoque estimado ${fmtL(level)} de ${fmtL(t.capacity)}`
        : `sem medição inicial · capacidade ${fmtL(t.capacity)}`,
      colTank + 10,
      7,
    );
    doc.setTextColor(0);
    nl(13);
  });

  doc.setDrawColor(120);
  doc.line(margin, y - 6, pageW - margin, y - 6);
  nl(8);
  text(`Total vendido no dia: ${fmtL(totalDia)}`, colTank, 11, true);
  nl(28);

  // Gráfico de vendas por combustível
  const chartH = 130;
  room(chartH + 40);
  text("Vendas do dia por combustível", margin, 11, true);
  nl(10);
  const chartTop = y;
  const chartBottom = chartTop + chartH;
  const chartLeft = margin + 4;
  const chartRight = pageW - margin;
  doc.setDrawColor(200);
  doc.line(chartLeft, chartBottom, chartRight, chartBottom);

  const sales = state.tanks.map((t) => ({ t, v: totalSalesOfDay(state, date, t.id) }));
  const maxSale = Math.max(1, ...sales.map((s) => s.v));
  const slot = (chartRight - chartLeft) / Math.max(1, sales.length);
  sales.forEach((s, i) => {
    const barW = Math.min(46, slot * 0.6);
    const x = chartLeft + i * slot + (slot - barW) / 2;
    const h = (s.v / maxSale) * (chartH - 16);
    doc.setFillColor(...rgb(s.t.color));
    doc.rect(x, chartBottom - h, barW, h, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90);
    doc.text(s.t.name.slice(0, 14), x + barW / 2, chartBottom + 10, { align: "center" });
    doc.setFontSize(6.5);
    doc.setTextColor(40);
    doc.text(fmtL(s.v), x + barW / 2, chartBottom - h - 4, { align: "center" });
    doc.setTextColor(0);
  });
  y = chartBottom + 34;

  // Gráfico de estoque e vendas
  room(28 + state.tanks.length * 30);
  text("Estoque e vendas por tanque", margin, 11, true);
  nl(18);
  state.tanks.forEach((t, idx) => {
    room(30);
    const level = estimatedLevel(state, date, t.id);
    const sold = totalSalesOfDay(state, date, t.id);
    const pct = level !== undefined ? Math.min(1, level / t.capacity) : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(0);
    doc.text(`${idx + 1}. ${t.name}`.slice(0, 28), margin, y);
    doc.text(`vendido ${fmtL(sold)}`, pageW - margin, y, { align: "right" });
    const barY = y + 5;
    const barW = pageW - margin * 2;
    doc.setFillColor(232, 232, 232);
    doc.rect(margin, barY, barW, 9, "F");
    doc.setFillColor(...rgb(t.color));
    doc.rect(margin, barY, barW * pct, 9, "F");
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(
      level !== undefined
        ? `estoque estimado ${fmtL(level)} de ${fmtL(t.capacity)} (${Math.round(pct * 100)}%)`
        : `sem medição inicial · capacidade ${fmtL(t.capacity)}`,
      margin,
      barY + 19,
    );
    doc.setTextColor(0);
    y = barY + 28;
  });

  // Escala do dia
  room(60);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Frentistas por turno", margin, y);
  y += 16;
  shifts.forEach((sh) => {
    room(20);
    const names =
      state.attendants
        .filter((a) => a.shift === sh)
        .map((a) => `${a.name} (${a.start}–${a.end})`)
        .join(" · ") || "Nenhum frentista na escala";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Turno ${sh}: ${names}`.slice(0, 110), margin, y);
    y += 14;
  });

  drawPdfFooter(doc, state, formatBR(date));
  return doc.output("blob");
}
