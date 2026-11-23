import { useEffect, useState } from "react";

export const FISCAL_DOCUMENTS_KEY = "documentos_fiscalizacao";
export const FISCAL_NOTIFICATIONS_KEY = "notificacoes_fiscalizacao";
export const FISCAL_WHATSAPP_KEY = "posto10_whatsapp_fiscalizacao";
export const FISCAL_STORAGE_EVENT = "posto10:fiscalizacao";

export type FiscalStatus =
  "SEM_DATA" | "VENCIDO" | "ROXO_30" | "LARANJA_90" | "AMARELO_180" | "VERDE_OK";

export type FiscalDocument = {
  id: string;
  orgao: string;
  nomeDocumento: string;
  dataVencimento: string;
  diasParaVencer: number;
  status: FiscalStatus;
  responsavel?: string;
  fotoUrl?: string;
  observacao?: string;
};

export type FiscalNotification = {
  id: string;
  date: string;
  message: string;
  documentIds: string[];
  read: boolean;
};

export const SUGGESTED_FISCAL_DOCUMENTS: Array<{ orgao: string; nomeDocumento: string }> = [
  { orgao: "ANP", nomeDocumento: "CERTIFICADO DE POSTO REVENDEDOR ANP" },
  { orgao: "ANP", nomeDocumento: "CNPJ E INSCRIÇÃO ESTADUAL HABILITADOS" },
  { orgao: "ANP", nomeDocumento: "ADESIVO DE IDENTIFICAÇÃO DO POSTO" },
  { orgao: "ANP", nomeDocumento: "QUADRO DE AVISOS ANP" },
  { orgao: "ANP", nomeDocumento: "LIVRO LMC ATUALIZADO" },
  { orgao: "ANP", nomeDocumento: "LAUDO DE ESTANQUEIDADE" },
  { orgao: "ANP", nomeDocumento: "ENSAIO DE COMPRESSÃO DE MANGUEIRAS" },
  { orgao: "ANP", nomeDocumento: "CERTIFICADO DE TANQUES" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "AVCB - AUTO DE VISTORIA" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "BRIGADA DE INCÊNDIO" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "RECARGA EXTINTORES" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "ATESTADO PARA-RAIOS - SPDA" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "PLANO DE EMERGÊNCIA" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "ART DO ENGENHEIRO" },
  { orgao: "CORPO DE BOMBEIROS", nomeDocumento: "CERTIFICADO BRIGADA" },
  {
    orgao: "CETESB / MEIO AMBIENTE",
    nomeDocumento: "LICENÇA DE OPERAÇÃO AMBIENTAL VIGENTE",
  },
  { orgao: "CETESB", nomeDocumento: "CERTIFICADO DE COLETA ÓLEO USADO" },
  {
    orgao: "CETESB",
    nomeDocumento: "CERTIFICADO LIMPEZA CAIXA SEPARADORA ÁGUA E ÓLEO",
  },
  { orgao: "CETESB", nomeDocumento: "MANIFESTO DE RESÍDUOS - CADRI" },
  { orgao: "IBAMA / MEIO AMBIENTE", nomeDocumento: "LICENÇA IBAMA" },
  { orgao: "IBAMA / MEIO AMBIENTE", nomeDocumento: "CADASTRO TÉCNICO FEDERAL" },
  {
    orgao: "IBAMA / MEIO AMBIENTE",
    nomeDocumento: "CERTIFICADO DESTINAÇÃO EMBALAGENS",
  },
  { orgao: "CETESB / MEIO AMBIENTE", nomeDocumento: "CERTIFICADO DE COLETA DE ÓLEO USADO" },
  { orgao: "CETESB / MEIO AMBIENTE", nomeDocumento: "MANIFESTO DE RESÍDUOS" },
  {
    orgao: "CETESB / MEIO AMBIENTE",
    nomeDocumento: "CERTIFICADO DE LIMPEZA CAIXA SEPARADORA",
  },
  {
    orgao: "IMETRO / IPEM",
    nomeDocumento: "CERTIFICADO DE VERIFICAÇÃO DAS BOMBAS MEDIDORAS",
  },
  { orgao: "IMETRO / IPEM", nomeDocumento: "LACRE IMETRO" },
  { orgao: "IMETRO / IPEM", nomeDocumento: "AFERIÇÃO DE TANQUES" },
  { orgao: "IMETRO / IPEM", nomeDocumento: "ENSAIO DE ESTANQUEIDADE BOMBAS" },
  { orgao: "PREFEITURA", nomeDocumento: "ALVARÁ DE FUNCIONAMENTO" },
  { orgao: "PREFEITURA", nomeDocumento: "ALVARÁ VIGILÂNCIA SANITÁRIA" },
  { orgao: "PREFEITURA", nomeDocumento: "ALVARÁ PUBLICIDADE - LETREIRO" },
  { orgao: "PREFEITURA", nomeDocumento: "HABITE-SE" },
  { orgao: "TRABALHISTA / SEGURANÇA", nomeDocumento: "CERTIFICADO NR20 - INFLAMÁVEIS" },
  { orgao: "TRABALHISTA / SEGURANÇA", nomeDocumento: "ASO FUNCIONÁRIOS" },
  { orgao: "TRABALHISTA / SEGURANÇA", nomeDocumento: "PPRA / PGR" },
  { orgao: "TRABALHISTA / SEGURANÇA", nomeDocumento: "PCMSO" },
  { orgao: "OUTROS", nomeDocumento: "CERTIFICADO CURSO NR20" },
  { orgao: "OUTROS", nomeDocumento: "ASO FUNCIONÁRIOS" },
  { orgao: "OUTROS", nomeDocumento: "CERTIFICADO ANÁLISE ÁGUA POTÁVEL" },
  { orgao: "OUTROS", nomeDocumento: "CONTRATO MANUTENÇÃO FILTROS" },
  { orgao: "OUTROS", nomeDocumento: "CERTIFICADO LIMPEZA CAIXA D'ÁGUA" },
  { orgao: "OUTROS", nomeDocumento: "LAUDO ELÉTRICO" },
];

export const FISCAL_SOURCE_REFERENCES = [
  {
    label: "ANP - DOCUMENTOS PARA AUTORIZAÇÃO DE REVENDA",
    url: "https://www.gov.br/anp/pt-br/assuntos/distribuicao-e-revenda/revendedor/quero-ser-revendedor-2",
  },
  {
    label: "ANP - ADESIVO DE IDENTIFICAÇÃO E QUADRO DE AVISOS",
    url: "https://www.gov.br/anp/pt-br/assuntos/distribuicao-e-revenda/revendedor/quero-atualizar-meus-adesivos",
  },
  {
    label: "ANP - CONSULTA E CERTIFICADO DE POSTO REVENDEDOR",
    url: "https://www.gov.br/anp/pt-br/assuntos/distribuicao-e-revenda/revendedor/consulta-posto-web-1",
  },
  {
    label: "INMETRO - VERIFICAÇÃO DE INSTRUMENTOS DE MEDIÇÃO",
    url: "https://www.gov.br/inmetro/pt-br/assuntos/metrologia-legal/controle-legal-de-instrumentos-de-medicao/modalidades/verificacao",
  },
  {
    label: "MTE - NORMAS REGULAMENTADORAS VIGENTES",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/ctpp-nrs/normas-regulamentadoras-nrs",
  },
] as const;

export const FISCAL_ORGANIZATIONS = [
  "ANP",
  "CORPO DE BOMBEIROS",
  "CETESB / MEIO AMBIENTE",
  "IMETRO / IPEM",
  "PREFEITURA",
  "IBAMA / MEIO AMBIENTE",
  "TRABALHISTA / SEGURANÇA",
  "VIGILÂNCIA SANITÁRIA",
  "PROCON",
  "MEIO AMBIENTE",
  "OUTROS",
];

function localDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calculateFiscalDocument(doc: FiscalDocument, now = new Date()): FiscalDocument {
  if (!doc.dataVencimento) {
    return { ...doc, diasParaVencer: Number.MAX_SAFE_INTEGER, status: "SEM_DATA" };
  }
  const [year = NaN, month = NaN, day = NaN] = doc.dataVencimento.split("-").map(Number);
  const [todayYear = NaN, todayMonth = NaN, todayDay = NaN] = localDateISO(now)
    .split("-")
    .map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(todayYear) ||
    !Number.isInteger(todayMonth) ||
    !Number.isInteger(todayDay)
  ) {
    return { ...doc, diasParaVencer: Number.MAX_SAFE_INTEGER, status: "SEM_DATA" };
  }
  const days = Math.ceil(
    (Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000,
  );
  const status: FiscalStatus =
    days < 0
      ? "VENCIDO"
      : days <= 30
        ? "ROXO_30"
        : days <= 90
          ? "LARANJA_90"
          : days <= 180
            ? "AMARELO_180"
            : "VERDE_OK";
  return { ...doc, diasParaVencer: days, status };
}

export function calculateFiscalDocuments(documents: FiscalDocument[], now = new Date()) {
  return documents
    .map((document) => calculateFiscalDocument(document, now))
    .sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}

export function readFiscalDocuments(): FiscalDocument[] {
  const raw = window.localStorage.getItem(FISCAL_DOCUMENTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("A LISTA DE DOCUMENTOS DE FISCALIZAÇÃO ESTÁ INVÁLIDA.");
  }
  return calculateFiscalDocuments(parsed as FiscalDocument[]);
}

export function writeFiscalDocuments(documents: FiscalDocument[]) {
  const calculated = calculateFiscalDocuments(documents);
  window.localStorage.setItem(FISCAL_DOCUMENTS_KEY, JSON.stringify(calculated));
  window.dispatchEvent(new CustomEvent(FISCAL_STORAGE_EVENT));
  return calculated;
}

export function fiscalStatusColor(status: FiscalStatus) {
  switch (status) {
    case "SEM_DATA":
      return "#6B7280";
    case "VENCIDO":
      return "#E53E3E";
    case "ROXO_30":
      return "#805AD5";
    case "LARANJA_90":
      return "#DD6B20";
    case "AMARELO_180":
      return "#D69E2E";
    case "VERDE_OK":
      return "#38A169";
  }
}

export function fiscalStatusLabel(document: FiscalDocument) {
  if (!document.dataVencimento || document.status === "SEM_DATA") {
    return "INFORME A DATA DE VENCIMENTO";
  }
  if (document.status === "VENCIDO") {
    return `VENCIDO HÁ ${Math.abs(document.diasParaVencer)} DIAS`;
  }
  if (document.status === "VERDE_OK") return `OK - ${document.diasParaVencer} DIAS`;
  return `VENCE EM ${document.diasParaVencer} DIAS`;
}

export function getFiscalAlertSummary(documents: FiscalDocument[]) {
  const overdue = documents.filter((document) => document.status === "VENCIDO").length;
  const dueWithin30 = documents.filter(
    (document) => document.status === "ROXO_30" && document.diasParaVencer >= 0,
  ).length;
  const dueWithin180 = documents.filter((document) => document.diasParaVencer <= 180).length;
  return {
    overdue,
    dueWithin30,
    dueWithin180,
    message: `🔔 ${overdue} DOCUMENTOS VENCIDOS + ${dueWithin30} VENCEM EM ATÉ 30 DIAS`,
  };
}

function readNotifications(): FiscalNotification[] {
  const raw = window.localStorage.getItem(FISCAL_NOTIFICATIONS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("AS NOTIFICAÇÕES DE FISCALIZAÇÃO ESTÃO INVÁLIDAS.");
  return parsed as FiscalNotification[];
}

export function checkDailyFiscalNotifications(now = new Date()) {
  const documents = readFiscalDocuments();
  const due = documents.filter((document) => document.diasParaVencer <= 180);
  const date = localDateISO(now);
  const storedRaw = window.localStorage.getItem(FISCAL_DOCUMENTS_KEY);
  const calculatedRaw = JSON.stringify(documents);
  if (storedRaw !== calculatedRaw) {
    window.localStorage.setItem(FISCAL_DOCUMENTS_KEY, calculatedRaw);
  }

  if (due.length > 0) {
    const notifications = readNotifications();
    if (!notifications.some((notification) => notification.date === date)) {
      const summary = getFiscalAlertSummary(documents);
      notifications.unshift({
        id: `${date}-fiscalizacao`,
        date,
        message: summary.message,
        documentIds: due.map((document) => document.id),
        read: false,
      });
      window.localStorage.setItem(
        FISCAL_NOTIFICATIONS_KEY,
        JSON.stringify(notifications.slice(0, 100)),
      );
    }
  }

  window.dispatchEvent(new CustomEvent(FISCAL_STORAGE_EVENT));
  return documents;
}

export function logFiscalWhatsApp(
  document: FiscalDocument,
  link: string,
  date = localDateISO(new Date()),
) {
  const key = "log_whatsapp_fiscalizacao";
  const raw = window.localStorage.getItem(key);
  const previous = raw ? (JSON.parse(raw) as Array<Record<string, string>>) : [];
  window.localStorage.setItem(
    key,
    JSON.stringify([
      { documentoId: document.id, nomeDocumento: document.nomeDocumento, data: date, link },
      ...previous,
    ]),
  );
  window.localStorage.setItem(`ultimaNotificacao_whats_${document.id}`, date);
}

export function useFiscalDocuments() {
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshDocuments = (nextDocuments?: FiscalDocument[]) => {
    if (nextDocuments) {
      setDocuments(nextDocuments);
      setError(null);
      return;
    }
    try {
      setDocuments(readFiscalDocuments());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "NÃO FOI POSSÍVEL LER OS DOCUMENTOS.");
    }
  };

  useEffect(() => {
    const refresh = () => {
      try {
        setDocuments(readFiscalDocuments());
        setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "NÃO FOI POSSÍVEL LER OS DOCUMENTOS.");
      }
    };
    refresh();
    window.addEventListener(FISCAL_STORAGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FISCAL_STORAGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { documents, error, refreshDocuments };
}

export function formatFiscalDate(date: string) {
  if (!date) return "DATA NÃO INFORMADA";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
