import jsPDF from "jspdf";
import type { AppState, Fechamento } from "@/lib/store";
import { formatBR } from "@/lib/store";
import { drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function fechamentoCaixaFileName(fechamento: Fechamento) {
  return `fechamento-caixa-${fechamento.data}-turno-${fechamento.turno}.pdf`;
}

export function buildFechamentoCaixaPdf(state: AppState, fechamento: Fechamento): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  let y = drawPdfHeader(doc, state, "Fechamento de caixa por turno");

  const line = (text: string, size = 10, bold = false, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, 510 - indent) as string[];
    for (const part of wrapped) {
      if (y > pageHeight - 55) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin + indent, y);
      y += size + 5;
    }
  };

  line(`Data: ${formatBR(fechamento.data)}    Turno: ${fechamento.turno}`, 11, true);
  line(`Frentista caixa: ${fechamento.frentistaNome || "Não informado"}`);
  y += 8;

  line("VENDAS DE COMBUSTÍVEL POR BICO", 12, true);
  for (const item of fechamento.itens.filter((entry) => entry.tipo === "combustivel" || entry.tipo === "venda")) {
    const quantity = item.litros ?? 0;
    const price = item.preco ?? 0;
    line(`${item.produto ?? "Bico"} · ${quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L × ${price.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}/L = ${currency(item.valor)}`, 9, false, 8);
  }
  if (!fechamento.itens.some((item) => item.tipo === "combustivel" || item.tipo === "venda")) {
    line("Nenhuma venda de combustível lançada.", 9, false, 8);
  }

  y += 6;
  line("MINI MERCADO E PRODUTOS", 12, true);
  for (const item of fechamento.itens.filter((entry) => entry.tipo === "produto")) {
    line(`${item.produto ?? "Produto"} · ${currency(item.valor)}`, 9, false, 8);
  }
  if (!fechamento.itens.some((item) => item.tipo === "produto")) {
    line("Nenhum produto lançado.", 9, false, 8);
  }

  y += 6;
  line("RECEBIMENTOS", 12, true);
  for (const item of fechamento.itens.filter((entry) => entry.tipo === "recebimento")) {
    line(`${item.formaNome ?? "Forma de recebimento"} · ${currency(item.valor)}`, 9, false, 8);
  }

  y += 8;
  line(`TOTAL VENDIDO: ${currency(fechamento.totalVendas)}`, 11, true);
  line(`TOTAL RECEBIDO: ${currency(fechamento.totalRecebido)}`, 11, true);
  const differenceLabel = fechamento.status === "faltando"
    ? `FALTA DE CAIXA: ${currency(Math.abs(fechamento.diferenca))}`
    : fechamento.status === "sobrando"
      ? `SOBRA DE CAIXA: ${currency(fechamento.diferenca)}`
      : "CAIXA CONFERIDO: SEM DIFERENÇA";
  if (fechamento.status === "faltando") doc.setTextColor(205, 35, 45);
  else if (fechamento.status === "sobrando") doc.setTextColor(35, 90, 195);
  else doc.setTextColor(20, 135, 75);
  line(differenceLabel, 14, true);
  doc.setTextColor(0, 0, 0);

  y += 28;
  if (y > pageHeight - 110) {
    doc.addPage();
    y = margin + 20;
  }
  doc.setDrawColor(70);
  doc.line(margin + 25, y, margin + 300, y);
  y += 14;
  line(fechamento.assinatura || fechamento.frentistaNome || "Assinatura do frentista caixa", 10, true);
  line("Assinatura do frentista caixa", 8);

  drawPdfFooter(doc, state, `Caixa ${formatBR(fechamento.data)} · turno ${fechamento.turno}`);
  return doc.output("blob");
}
