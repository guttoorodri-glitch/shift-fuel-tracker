import jsPDF from "jspdf";
import type { AppState } from "@/lib/store";
import { companyName, drawPdfFooter, drawPdfHeader } from "@/lib/pdf-header";
import {
  PIX_KEY,
  PLAN_MENU_FEATURES,
  PLAN_PRICES,
  type SubscriptionPlan,
  roleAllows,
} from "@/hooks/useSubscription";
import type { AccessRole } from "@/lib/local-auth";

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
    "MEDIDAS / VENDAS DIÁRIAS",
    [
      "Escolha a data e informe a medição inicial de cada tanque.",
      "Informe a medição de todos os tanques em cada turno configurado em Ajustes. Não é possível salvar o dia com turnos ou medições pendentes.",
      "Toque em Salvar vendas do dia para gravar as medições de todos os turnos.",
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
    "TAREFAS KANBAN",
    ["Crie tarefas, atribua responsáveis, defina prazo e mova os cartões entre os status."],
  ],
  [
    "CHECK LIST",
    [
      "Consulte as rotinas diárias, semanais, mensais e demais frequências.",
      "Marque cada item concluído no ciclo correspondente.",
    ],
  ],
  [
    "FECHAMENTO CAIXA",
    [
      "Escolha a data e o turno que será conferido. Os bicos são carregados do cadastro de Aferição.",
      "Informe litros e preço por litro de cada bico. O preço utiliza três casas decimais e o total é calculado automaticamente.",
      "Some manualmente os valores do mini mercado e produtos, informe todas as formas de recebimento e confira falta ou sobra de caixa.",
      "Informe o frentista caixa e a assinatura. Salve o fechamento ou gere e compartilhe o PDF pelo WhatsApp.",
    ],
  ],
  [
    "FECHAMENTO CAIXA",
    [
      "Escolha data e turno. O aplicativo carrega os bicos cadastrados em Aferição para lançar litros e preço de venda por litro, com três casas decimais.",
      "Some mini mercado e produtos vendidos, informe as formas de recebimento e confira se o caixa está certo, faltando ou sobrando.",
      "Informe o frentista caixa e a assinatura. Salve o fechamento, gere o PDF com os dados do posto ou compartilhe pelo WhatsApp.",
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
      "Configure quantidade de turnos, tanques, nomes, capacidades, preços de combustível e cores.",
      "Ajuste o tamanho das letras e altere a senha de acesso quando necessário.",
      "Os dados do posto aparecem no topo do aplicativo e nos PDFs.",
    ],
  ],
  [
    "AJUDA",
    [
      "Consulte as instruções de cada menu, compare os recursos liberados em cada plano e veja os valores de compra e renovação.",
      "Salve ou compartilhe separadamente o Manual e o Contrato em PDF.",
    ],
  ],
  [
    "Pagamentos",
    [
      "Escolha uma das três opções de acesso: TROCADOR DE ÓLEO, FRENTISTA ou GERENTE.",
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
  line(
    "AVISO: FAÇA SEMPRE UMA CÓPIA DE SEGURANÇA. OS DADOS FICAM NO SEU APARELHO. NÃO SOMOS RESPONSÁVEIS POR PERDA OU INDISPONIBILIDADE DOS SEUS DADOS.",
    11,
    true,
  );
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
  line(
    "Perfis de acesso disponíveis. As permissões de cada perfil são diferentes dos planos de cobrança:",
  );
  const profiles: Array<{ id: AccessRole; name: string }> = [
    { id: "PROPRIETARIO", name: "PROPRIETÁRIO" },
    { id: "GERENTE", name: "GERENTE" },
    { id: "FRENTISTA", name: "FRENTISTA" },
    { id: "TROCA-OLEO", name: "TROCA-OLEO" },
  ];
  for (const profile of profiles) {
    const allowedMenus = PLAN_MENU_FEATURES.filter((feature) =>
      roleAllows(profile.id, feature.path),
    )
      .map((feature) => feature.label)
      .join(", ");
    line(`${profile.name}: ${allowedMenus}.`);
  }
  line("Planos de assinatura, válidos por 30 dias:");
  const plans: Array<{ id: SubscriptionPlan; name: string }> = [
    { id: "troca-oleo", name: "TROCADOR DE ÓLEO" },
    { id: "frentista", name: "FRENTISTA" },
    { id: "gerente", name: "GERENTE" },
  ];
  for (const plan of plans) {
    line(`${plan.name}: R$ ${PLAN_PRICES[plan.id]} por 30 dias.`);
  }
  line(
    `Pagamento via PIX na chave ${PIX_KEY}. O valor e o QR Code mudam conforme a opção escolhida.`,
  );
  line(
    "Após pagar, toque em Já Fiz o PIX - Liberar Agora. Para renovar, escolha novamente o plano e repita o pagamento.",
  );

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
  line(`TROCADOR DE ÓLEO: R$ ${PLAN_PRICES["troca-oleo"]} por 30 dias.`);
  line(`FRENTISTA: R$ ${PLAN_PRICES.frentista} por 30 dias.`);
  line(`GERENTE: R$ ${PLAN_PRICES.gerente} por 30 dias.`);
  line(
    `O pagamento é feito pela chave PIX ${PIX_KEY}. A renovação deve ser realizada antes do fim do período para manter o acesso.`,
  );
  line(
    "O prazo começa na data de liberação da assinatura. Sem renovação, o aplicativo poderá entrar em período de tolerância e será bloqueado ao final desse período.",
  );
  line("O usuário é responsável por guardar suas credenciais e pode alterar a senha em Ajustes.");
  line(
    `Ciência registrada: ${contractAccepted ? "SIM" : "NÃO"}${acceptedAt ? ` — ${acceptedAt}` : ""}.`,
  );
  line(`Documento emitido para ${companyName(state)}.`);

  drawPdfFooter(doc, state, "Contrato de uso");
  return doc.output("blob");
}
