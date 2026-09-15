import type { AppState, Calibration } from "@/lib/store";
import { calibrationApproved, formatBR } from "@/lib/store";
import { companyName, drawPdfHeader } from "@/lib/pdf-header";

export function afericaoFileName(c: Calibration) {
  return `afericao-${c.date}.pdf`;
}

export async function buildAfericaoPdf(
  state: AppState,
  calibration: Calibration,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  const nl = (h = 14) => {
    y += h;
    if (y > pageH - margin - 60) {
      doc.addPage();
      y = margin;
    }
  };

  const text = (t: string, x: number, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(t, x, y);
  };

  // Cabeçalho com os dados cadastrais do posto
  y = drawPdfHeader(doc, state, "Relatório de aferição de bicos");


  text(`Data: ${formatBR(calibration.date)}`, margin, 11, true);
  nl(16);
  text(`Responsável: ${calibration.responsavel}`, margin, 11, true);
  nl(24);

  // Carimbo aprovado/reprovado
  const approved = calibrationApproved(calibration);
  const stampText = approved ? "AFERIÇÃO APROVADA" : "AFERIÇÃO REPROVADA";
  const stampColor: [number, number, number] = approved ? [22, 163, 74] : [220, 38, 38];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const stampW = doc.getTextWidth(stampText) + 24;
  const stampH = 28;
  const stampX = (pageW - stampW) / 2;
  doc.setDrawColor(...stampColor);
  doc.setLineWidth(2.5);
  doc.setTextColor(...stampColor);
  doc.roundedRect(stampX, y - 16, stampW, stampH, 6, 6);
  doc.roundedRect(stampX + 3, y - 13, stampW - 6, stampH - 6, 4, 4);
  doc.text(stampText, stampX + 12, y + 2);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.5);
  nl(stampH + 14);

  text(`Padrão aceito: entre -100 e +100 ml em todas as medições.`, margin, 9);
  nl(20);

  // Tabela de bicos
  const colBico = margin;
  const colFuel = margin + 110;
  const colLenta = margin + 300;
  const colRapida = margin + 400;

  const header = () => {
    doc.setDrawColor(180);
    doc.line(margin, y - 9, pageW - margin, y - 9);
    text("Bico", colBico, 9, true);
    text("Combustível", colFuel, 9, true);
    text("Lenta (ml)", colLenta, 9, true);
    text("Rápida (ml)", colRapida, 9, true);
    nl(14);
  };
  header();

  const items = calibration.items.filter(
    (i) => i.lenta !== undefined || i.rapida !== undefined,
  );

  if (items.length === 0) {
    text("Nenhuma medição registrada.", margin, 10);
    nl(14);
  }

  items.forEach((i, idx) => {
    if (y > pageH - margin - 70) {
      doc.addPage();
      y = margin;
      header();
    }
    const nozzle = state.nozzles?.find((n) => n.id === i.nozzleId);
    const name = nozzle?.name ?? "Bico";
    const fuel = nozzle?.fuel ?? "";
    const fmt = (v?: number) =>
      v === undefined ? "—" : `${v > 0 ? "+" : ""}${v}`;

    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin - 4, y - 9, pageW - 2 * margin + 8, 14, "F");
    }
    const out =
      (typeof i.lenta === "number" && Math.abs(i.lenta) > 100) ||
      (typeof i.rapida === "number" && Math.abs(i.rapida) > 100);
    text(name, colBico, 9, out);
    text(fuel, colFuel, 9);
    text(fmt(i.lenta), colLenta, 9);
    text(fmt(i.rapida), colRapida, 9);
    nl(14);
  });

  nl(16);
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  nl(20);

  // Campo de assinatura
  const sigY = Math.max(y, pageH - margin - 90);
  if (sigY > pageH - margin - 60) {
    doc.addPage();
  }
  doc.setPage(doc.getNumberOfPages());
  const lineW = 260;
  const lineX = (pageW - lineW) / 2;
  const lineY = Math.max(sigY, pageH - margin - 70);
  doc.setDrawColor(60);
  doc.line(lineX, lineY, lineX + lineW, lineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const respLabel = `Assinatura do responsável: ${calibration.responsavel}`;
  doc.text(respLabel, pageW / 2, lineY + 14, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(
    `${companyName(state)} · aferição de ${formatBR(calibration.date)}`,
    pageW / 2,
    lineY + 26,
    { align: "center" },
  );

  return doc.output("blob");
}
