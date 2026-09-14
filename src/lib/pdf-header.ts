import type jsPDF from "jspdf";
import type { AppState, Company } from "@/lib/store";
import { emptyCompany } from "@/lib/store";

export function companyOf(state?: Pick<AppState, "company">): Company {
  return { ...emptyCompany, ...(state?.company ?? {}) };
}

/** Nome curto do posto usado em rodapés e mensagens */
export function companyName(state?: Pick<AppState, "company">) {
  const name = companyOf(state).name.trim();
  return name === "" ? "Posto 10" : name;
}

/**
 * Desenha o cabeçalho padrão com os dados cadastrais do posto.
 * Retorna a coordenada y para o início do conteúdo.
 */
export function drawPdfHeader(
  doc: jsPDF,
  state: Pick<AppState, "company"> | undefined,
  subtitle: string,
): number {
  const c = companyOf(state);
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const lines = [
    [c.address, c.bairro].filter((v) => v.trim() !== "").join(" — "),
    [
      c.cnpj.trim() !== "" ? `CNPJ: ${c.cnpj}` : "",
      c.ie.trim() !== "" ? `Inscrição Estadual: ${c.ie}` : "",
      c.phone.trim() !== "" ? `Telefone: ${c.phone}` : "",
    ]
      .filter((v) => v !== "")
      .join("  ·  "),
  ].filter((v) => v.trim() !== "");

  const bandH = 46 + lines.length * 12;
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, bandH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(companyName(state).toUpperCase(), margin, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 38;
  for (const line of lines) {
    doc.text(line, margin, y);
    y += 12;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(subtitle, margin, Math.max(y, 40));
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  return bandH + 28;
}

/** Rodapé com o nome do posto e a numeração das páginas */
export function drawPdfFooter(
  doc: jsPDF,
  state: Pick<AppState, "company"> | undefined,
  extra = "",
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    const parts = [companyName(state), extra, `página ${p} de ${pages}`].filter(
      (v) => v.trim() !== "",
    );
    doc.text(parts.join(" · "), 36, pageH - 18);
    doc.setTextColor(0);
  }
  void pageW;
}
