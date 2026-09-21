import jsPDF from "jspdf";
import type { AppState } from "@/lib/store";
import { companyName, drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";
import { PIX_KEY, PLAN_PRICES, SUBSCRIPTION_PRICE } from "@/hooks/useSubscription";

export function manualFileName() {
  return "manual-posto-10.pdf";
}

export function contratoFileName() {
  return "contrato-posto-10.pdf";
}

const sections: Array<[string, string[]]> = [
  [
    "Como começar e entrar",
    [
      "1. Entre usando o usuário do plano escolhido: troca-oleo, frentista ou gerente.",
      "2. A senha inicial é posto10. Depois do primeiro acesso, altere-a em Ajustes.",
      "3. O administrador entra com o acesso administrativo próprio.",
      "4. Em Ajustes, cadastre os dados do posto e revise tanques e turnos.",
      "5. Configure os bicos e os parâmetros de aferição antes de lançar medições.",
      "6. Use o menu Backup para guardar uma cópia dos dados no aparelho.",
    ],
  ],
  [
    "Medidas e vendas diárias",
    [
      "Escolha a data e informe a medição inicial de cada tanque.",
      "Lance as vendas de cada turno por tanque. O estoque estimado é atualizado na tela.",
      "Use a visualização Barras ou Tanques para acompanhar vendas e níveis estimados.",
    ],
  ],
  [
    "Relatório Vendas Combustível",
    [
      "Filtre o período usando as datas ou os atalhos de período.",
      "Consulte os totais de vendas agrupados por tanque e a evolução diária.",
      "Use Exportar PDF para salvar ou compartilhar o relatório via WhatsApp.",
    ],
  ],
  [
    "CONTROLE PRODUTOS",
    [
      "Cadastre produtos da loja, lance vendas por turno e registre reposições.",
      "Use Estoque para informar contagens físicas e acompanhar o saldo calculado.",
    ],
  ],
  [
    "Recebimento Combustível",
    [
      "Informe data, distribuidora e número da nota fiscal.",
      "Para cada item, selecione obrigatoriamente o tanque de destino e informe a quantidade em litros.",
      "O volume recebido é associado exatamente ao tanque escolhido e aparece no histórico.",
    ],
  ],
  [
    "Relatório LMC",
    [
      "Escolha o período para consultar o Livro de Movimentação de Combustíveis.",
      "As linhas são organizadas por tanque e, dentro de cada tanque, por data.",
      "O PDF pode ser salvo ou compartilhado via WhatsApp.",
    ],
  ],
  [
    "Aferição",
    [
      "Em Parâmetros, cadastre os bicos e selecione o tanque de origem de cada um.",
      "Configure um limite negativo e um positivo entre -200 e +200 ml.",
      "Em Aferir, informe a vazão lenta e rápida de cada bico cadastrado.",
      "A aferição aprovada aceita valores dentro do intervalo configurado.",
      "O volume usado sai e retorna ao mesmo tanque: a aferição não é venda nem perda no LMC.",
    ],
  ],
  [
    "Escala",
    [
      "Cadastre frentistas, horários e turnos.",
      "Na grade de folgas, toque no dia para alternar trabalho, folga e falta.",
      "Escolha o mês e compartilhe a escala mensal em PDF paisagem.",
    ],
  ],
  [
    "TAREFAS",
    ["Crie tarefas, atribua responsáveis, defina prazo e mova os cartões entre os status."],
  ],
  [
    "Check List",
    [
      "Consulte as rotinas diárias, semanais, mensais e demais frequências.",
      "Marque cada item concluído no ciclo correspondente.",
    ],
  ],
  [
    "Backup",
    [
      "Salve ou compartilhe o arquivo de backup regularmente.",
      "Para restaurar, selecione um arquivo JSON exportado pelo aplicativo.",
    ],
  ],
  [
    "Ajustes",
    [
      "Cadastre nome, bandeira, CNPJ, I.E., endereço, número, bairro, cidade, estado e telefone.",
      "Configure quantidade de turnos, tanques, nomes, capacidades e cores.",
      "Os dados do posto aparecem no topo do aplicativo e nos PDFs.",
    ],
  ],
  [
    "Pagamentos",
    [
      "Escolha uma das três opções de acesso: TROCA DE ÓLEO, FRENTISTA ou GERENTE.",
      "Confira o valor, use o QR Code ou copie o PIX Copia e Cola e, após pagar, toque em Já Fiz o PIX.",
      "A renovação segue o mesmo plano escolhido e libera mais 30 dias de acesso.",
    ],
  ],
  [
    "Troca de óleo",
    [
      "Cadastre clientes e veículos, registre serviços, produtos utilizados e observações.",
      "Acompanhe os próximos serviços e use os lembretes para manter o histórico de manutenção.",
    ],
  ],
];

function createDocument(state: AppState, title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = drawPdfHeader(doc, state, title);

  const line = (value: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(value, 510) as string[];
    for (const part of wrapped) {
      if (y > pageHeight - 55) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin, y);
      y += size + 5;
    }
  };

  return { doc, line, getY: () => y, setY: (value: number) => (y = value), pageHeight, margin };
}

export async function buildManualPdf(state: AppState): Promise<Blob> {
  const { doc, line, getY, setY, pageHeight, margin } = createDocument(
    state,
    "Manual de uso e planos do Posto 10",
  );
  line("Manual de uso do aplicativo", 16, true);
  setY(getY() + 8);
  for (const [title, items] of sections) {
    line(title, 12, true);
    for (const item of items) line(item, 9.5);
    setY(getY() + 7);
  }

  if (getY() > pageHeight - 180) {
    doc.addPage();
    setY(margin);
  }
  line("Compra e renovação", 14, true);
  line("Todos os planos funcionam por 30 dias e podem ser renovados pelo mesmo valor:");
  line(`TROCA DE ÓLEO: R$ ${PLAN_PRICES["troca-oleo"]} por 30 dias.`);
  line(`FRENTISTA: R$ ${PLAN_PRICES.frentista} por 30 dias.`);
  line(`GERENTE: R$ ${PLAN_PRICES.gerente} por 30 dias.`);
  line(`Pagamento via PIX na chave ${PIX_KEY}. O valor e o QR Code mudam conforme a opção escolhida.`);
  line("Após pagar, toque em Já Fiz o PIX - Liberar Agora. Para renovar, escolha novamente o plano e repita o pagamento.");
  line(`Referência do valor geral exibido no sistema: R$ ${SUBSCRIPTION_PRICE}.`);

  drawPdfFooter(doc, state, "Manual de uso e planos");
  return doc.output("blob");
}

export async function buildContratoPdf(
  state: AppState,
  contractAccepted: boolean,
  acceptedAt: string | null,
): Promise<Blob> {
  const { doc, line, getY, setY } = createDocument(state, "Contrato de uso do Posto 10");
  line("Contrato", 16, true);
  setY(getY() + 8);
  line("Este documento registra as condições de compra, renovação e uso do aplicativo.", 10);
  line("O usuário escolhe um plano de acesso e realiza o pagamento correspondente por PIX.");
  line(`TROCA DE ÓLEO: R$ ${PLAN_PRICES["troca-oleo"]} por 30 dias.`);
  line(`FRENTISTA: R$ ${PLAN_PRICES.frentista} por 30 dias.`);
  line(`GERENTE: R$ ${PLAN_PRICES.gerente} por 30 dias.`);
  line(`O pagamento é feito pela chave PIX ${PIX_KEY}. A renovação deve ser realizada antes do fim do período para manter o acesso.`);
  line("O prazo começa na data de liberação da assinatura. Sem renovação, o aplicativo poderá entrar em período de tolerância e será bloqueado ao final desse período.");
  line("O usuário é responsável por guardar suas credenciais e pode alterar a senha em Ajustes.");
  line(`Ciência registrada: ${contractAccepted ? "SIM" : "NÃO"}${acceptedAt ? ` — ${acceptedAt}` : ""}.`);
  line(`Documento emitido para ${companyName(state)}.`);

  drawPdfFooter(doc, state, "Contrato de uso");
  return doc.output("blob");
}
