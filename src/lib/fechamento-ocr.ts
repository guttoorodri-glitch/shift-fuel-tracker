import { createWorker } from "tesseract.js";
import type { FormaPagamento, Tank } from "@/lib/store";

export type OcrVenda = { produto: string; litros: number; confianca: number };
export type OcrRecebimento = { forma_id: string; forma_nome: string; valor: number; confianca: number };

const numberPattern = /(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+|\.\d+)?/g;

function numberValue(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  return Number(normalized);
}

export async function readFechamentoPhoto(
  file: File,
  combustiveis: Tank[],
  formas: FormaPagamento[],
  onProgress?: (value: number) => void,
) {
  const worker = await createWorker("por", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress?.(message.progress);
    },
  });
  try {
    const result = await worker.recognize(file);
    const text = result.data.text;
    const vendas: OcrVenda[] = [];
    const recebimentos: OcrRecebimento[] = [];
    for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      const numbers = line.match(numberPattern) ?? [];
      if (numbers.length === 0) continue;
      const lower = line.toLocaleLowerCase("pt-BR");
      const fuel = combustiveis.find((item) => lower.includes(item.name.toLocaleLowerCase("pt-BR")));
      if (fuel) {
        vendas.push({ produto: fuel.name, litros: numberValue(numbers[0] as string), confianca: 0.7 });
        continue;
      }
      const forma = formas.find((item) => lower.includes(item.nome.toLocaleLowerCase("pt-BR")));
      if (forma) {
        recebimentos.push({ forma_id: forma.id, forma_nome: forma.nome, valor: numberValue(numbers[numbers.length - 1] as string), confianca: 0.7 });
      }
    }
    return { text, vendas, recebimentos };
  } finally {
    await worker.terminate();
  }
}
