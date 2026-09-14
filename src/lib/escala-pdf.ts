import type { AppState } from "@/lib/store";
import { dayStatus, formatBR, weekdayBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function monthLabelBR(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MESES[m - 1]} de ${y}`;
}

export function escalaFileName(month: string) {
  return `escala-${month}.pdf`;
}

function daysOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  return Array.from(
    { length: last },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

/** Escala mensal de todos os frentistas em A4 paisagem */
export async function buildEscalaPdf(state: AppState, month: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  let y = drawPdfHeader(doc, state, `Escala mensal — ${monthLabelBR(month)}`);

  const days = daysOfMonth(month);
  const nameW = 120;
  const gridW = pageW - margin * 2 - nameW;
  const cellW = gridW / days.length;
  const rowH = 18;

  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0);
    doc.text("Frentista", margin + 2, y + 8);
    days.forEach((d, i) => {
      const x = margin + nameW + i * cellW;
      doc.text(String(Number(d.slice(8))), x + cellW / 2, y + 4, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text(weekdayBR(d) ?? "", x + cellW / 2, y + 12, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(0);
    });
    y += rowH;
    doc.setDrawColor(150);
    doc.line(margin, y - 4, pageW - margin, y - 4);
  };

  header();

  const attendants = state.attendants;
  if (attendants.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum frentista cadastrado.", margin, y + 14);
  }

  attendants.forEach((a) => {
    if (y > pageH - margin - 60) {
      doc.addPage();
      y = margin + 10;
      header();
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(`${a.name} (T${a.shift} ${a.start}–${a.end})`.slice(0, 34), margin + 2, y + 12);

    days.forEach((d, i) => {
      const x = margin + nameW + i * cellW;
      const status = dayStatus(state, a, d);
      if (status === "falta") doc.setFillColor(168, 85, 247);
      else if (status === "folga") doc.setFillColor(217, 75, 90);
      else doc.setFillColor(238, 238, 238);
      doc.rect(x + 0.6, y + 2, cellW - 1.2, rowH - 4, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(status === "trabalho" ? 70 : 255);
      const label = status === "falta" ? "FAL" : status === "folga" ? "FOL" : `T${a.shift}`;
      doc.text(label, x + cellW / 2, y + 13, { align: "center" });
      doc.setTextColor(0);
    });

    y += rowH;
  });

  y += 18;
  if (y > pageH - margin - 40) {
    doc.addPage();
    y = margin + 20;
  }
  const legend: Array<[string, [number, number, number]]> = [
    ["Trabalho (turno)", [238, 238, 238]],
    ["Folga", [217, 75, 90]],
    ["Falta", [168, 85, 247]],
  ];
  let lx = margin;
  legend.forEach(([label, color]) => {
    doc.setFillColor(...color);
    doc.rect(lx, y - 8, 16, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(label, lx + 21, y);
    lx += doc.getTextWidth(label) + 46;
  });

  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(
    `Período: ${formatBR(days[0] as string)} a ${formatBR(days[days.length - 1] as string)}${
      state.sundayOff ? " · folga automática aos domingos" : ""
    }`,
    margin,
    y,
  );
  doc.setTextColor(0);

  drawPdfFooter(doc, state, monthLabelBR(month));
  return doc.output("blob");
}
