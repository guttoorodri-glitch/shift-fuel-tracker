type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[]; text?: string }) => boolean;
};

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Compartilha o PDF como anexo quando o aparelho permitir.
 * Sempre cai para o download + WhatsApp em qualquer falha.
 * Retorna a mensagem de situação para mostrar ao usuário.
 */
export async function sharePdf(
  blob: Blob,
  name: string,
  fallbackText: string,
): Promise<string> {
  const nav = navigator as ShareNavigator;
  try {
    const file = new File([blob], name, { type: "application/pdf" });
    if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file] });
      return "Escolha o WhatsApp na tela de compartilhamento.";
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    if (aborted) return "Compartilhamento cancelado.";
  }

  downloadBlob(blob, name);
  try {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${fallbackText} Anexe o arquivo ${name} salvo no aparelho.`)}`,
      "_blank",
      "noopener",
    );
  } catch {
    /* bloqueio de pop-up: o arquivo já foi salvo */
  }
  return `O PDF ${name} foi salvo — anexe-o na conversa do WhatsApp.`;
}
