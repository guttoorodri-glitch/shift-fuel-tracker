import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardCheck,
  FileDown,
  FileText,
  Fuel,
  Gauge,
  HelpCircle,
  Lightbulb,
  Search,
  Shield,
  Share2,
  ShoppingBasket,
  Truck,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildContratoPdf,
  buildManualPdf,
  contratoFileName,
  manualFileName,
} from "@/lib/ajuda-pdf";
import { downloadBlob, sharePdf } from "@/lib/share-pdf";
import { PLAN_MENU_FEATURES, roleAllows } from "@/hooks/useSubscription";
import { useAppState } from "@/lib/store";
import type { AccessRole } from "@/lib/local-auth";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — Posto 10" },
      {
        name: "description",
        content: "Manual de uso, perfis de acesso e termo de responsabilidade do aplicativo.",
      },
    ],
  }),
  component: AjudaPage,
});

const CONTRACT_KEY = "posto-contract-accepted";
const PROFILE_OPTIONS: Array<{ id: AccessRole; name: string; description: string }> = [
  {
    id: "PROPRIETARIO",
    name: "PROPRIETÁRIO",
    description:
      "Acompanha os dados do posto, relatórios e caixa. Não altera dados operacionais e pode configurar permissões da equipe.",
  },
  {
    id: "GERENTE",
    name: "GERENTE",
    description:
      "Acessa os menus liberados pelo PROPRIETÁRIO e, por padrão, todos exceto USUÁRIOS DO POSTO.",
  },
  {
    id: "FRENTISTA",
    name: "FRENTISTA",
    description:
      "Acesso somente aos menus liberados pelo PROPRIETÁRIO, por padrão fiscalização e fechamento de caixa.",
  },
  {
    id: "TROCA-OLEO",
    name: "TROCA-ÓLEO",
    description:
      "Acesso somente aos menus liberados pelo PROPRIETÁRIO, por padrão troca de óleo e fiscalização.",
  },
];

const HELP_TOPICS = [
  {
    id: "dashboard",
    title: "DASHBOARD / VISÃO GERAL",
    icon: Gauge,
    what: "TELA INICIAL COM RESUMO DE VENDAS, ESTOQUE E ALERTAS.",
    how: [
      "MOSTRA OS DADOS OPERACIONAIS DO DIA, COMO VENDAS POR TURNO E COMBUSTÍVEL RESTANTE NOS TANQUES.",
      "USE OS INDICADORES E ALERTAS PARA IDENTIFICAR PENDÊNCIAS E DIVERGÊNCIAS.",
    ],
    tip: "USE NO INÍCIO DE CADA TURNO PARA CONFERIR SE HÁ INDICADORES OU ALERTAS QUE PRECISAM DE ATENÇÃO.",
  },
  {
    id: "recebimento",
    title: "RECEBIMENTO DE COMBUSTÍVEL - NOVO MIX QUE ZERA",
    icon: Truck,
    what: "CONTROLE DOS COMBUSTÍVEIS RECEBIDOS DA DISTRIBUIDORA, INCLUINDO GASOLINA COMUM E ADITIVADA.",
    how: [
      "INFORME A DATA, A DISTRIBUIDORA, A NOTA FISCAL E OS LITROS RECEBIDOS POR TANQUE.",
      "O MIX MENSAL É CALCULADO SOBRE OS RECEBIMENTOS DE GASOLINA COMUM E ADITIVADA COM DATA NO MÊS ATUAL.",
      "O MIX MENSAL CONSIDERA SOMENTE OS RECEBIMENTOS DATADOS NO MÊS ATUAL. NO DIA 1º, O CÁLCULO COMEÇA A CONSIDERAR O NOVO MÊS; ISSO NÃO APAGA O HISTÓRICO.",
      "EXEMPLO: 20.000 L DE GASOLINA COMUM + 10.000 L DE ADITIVADA = MIX DE 33,33% DE ADITIVADA.",
      "O MIX DOS ÚLTIMOS 30 DIAS, O MIX GERAL E A EVOLUÇÃO POR RECEBIMENTO AJUDAM A COMPARAR PERÍODOS.",
      "A META É EDITÁVEL E FICA SALVA NO NAVEGADOR COM A CHAVE POSTO10_META_MIX_COMPRA. O HISTÓRICO DE RECEBIMENTOS FICA NOS DADOS LOCAIS DO APLICATIVO.",
    ],
    tip: "SE O MIX DO MÊS ESTIVER ABAIXO DA META DEFINIDA, AVALIE O PLANEJAMENTO DE COMPRAS DE GASOLINA ADITIVADA.",
  },
  {
    id: "vendas",
    title: "RESUMO DO DIA / VENDAS - MIX DE VENDA",
    icon: Fuel,
    what: "CONTROLE DO QUE FOI MEDIDO E VENDIDO NA PISTA, ORGANIZADO POR COMBUSTÍVEL E TURNO.",
    how: [
      "REGISTRE AS MEDIÇÕES E OS LITROS VENDIDOS EM CADA TURNO.",
      "O RESUMO TOTALIZA OS COMBUSTÍVEIS CADASTRADOS E ATUALIZA OS VALORES DURANTE A DIGITAÇÃO.",
      "QUANDO GASOLINA COMUM E ADITIVADA ESTÃO CADASTRADAS, O MIX DE VENDA É CALCULADO COMO ADITIVADA DIVIDIDA PELO TOTAL DE GASOLINA.",
      "O RESUMO DO DIA MOSTRA O QUE FOI VENDIDO; O MIX DE RECEBIMENTO MOSTRA O QUE FOI COMPRADO.",
    ],
    tip: "COMPARE MIX DE COMPRA E MIX DE VENDA PARA ACOMPANHAR A PARTICIPAÇÃO DA GASOLINA ADITIVADA. CONSIDERE ESTOQUE, PROCURA E OPERAÇÃO ANTES DE AJUSTAR A OFERTA.",
  },
  {
    id: "checklist",
    title: "CHECK LIST - ROTINA DO GERENTE - FOTO COMPROBATÓRIA",
    icon: ClipboardCheck,
    what: "LISTA DE VERIFICAÇÕES OPERACIONAIS E DE CONFORMIDADE PARA A ROTINA DO GERENTE.",
    how: [
      "HOJE: TAREFAS DIÁRIAS. SEMANA: TAREFAS SEMANAIS, COMO VERIFICAÇÃO DE LACRES E ADESIVOS. MÊS: TAREFAS MENSAIS, COMO ORGANIZAÇÃO DE NOTAS, LAUDOS E DOCUMENTOS.",
      "3 MESES: TAREFAS TRIMESTRAIS. 6 MESES: TAREFAS SEMESTRAIS, COMO TESTE DE ESTANQUEIDADE QUANDO APLICÁVEL.",
      "AO CADASTRAR OU EDITAR UMA VERIFICAÇÃO, ATIVE EXIGIR FOTO COMPROBATÓRIA PARA TORNAR A FOTO OBRIGATÓRIA.",
      "SE A FOTO FOR EXIGIDA, A CONCLUSÃO SÓ É LIBERADA DEPOIS QUE UMA IMAGEM FOR TIRADA OU SELECIONADA.",
      "A IMAGEM RECEBE MARCA D’ÁGUA POSTO 10 E DATA/HORA, E FICA SALVA JUNTO À VERIFICAÇÃO NO APLICATIVO.",
      "USE O REGISTRO FOTOGRÁFICO COMO DOCUMENTAÇÃO INTERNA. ELE NÃO SUBSTITUI DOCUMENTOS OU EVIDÊNCIAS EXIGIDOS POR ÓRGÃOS FISCALIZADORES.",
    ],
    tip: "PARA CADASTRAR: ADICIONAR VERIFICAÇÃO > INFORMAR O TÍTULO > ESCOLHER A FREQUÊNCIA E A CLASSIFICAÇÃO > ATIVAR OU NÃO EXIGIR FOTO > SALVAR.",
  },
  {
    id: "metas",
    title: "METAS E COMISSÃO",
    icon: Trophy,
    what: "ÁREA PARA DEFINIR METAS, REGISTRAR RESULTADOS E ACOMPANHAR O DESEMPENHO DA EQUIPE.",
    how: [
      "CADASTRE OS FRENTISTAS E DEFINA METAS BASE OU PERSONALIZADAS.",
      "ESCOLHA O MODELO DE META CONFIGURADO EM AJUSTES: INDIVIDUAL POR FRENTISTA OU META POR EQUIPE.",
      "REGISTRE OS RESULTADOS DIÁRIOS PARA ACOMPANHAR ACUMULADO, PROGRESSO, FALTA PARA A META E RANKING.",
      "OS RESULTADOS SÃO CALCULADOS A PARTIR DAS METAS E DOS LANÇAMENTOS REGISTRADOS.",
    ],
    tip: "MANTENHA OS LANÇAMENTOS ATUALIZADOS E CONFIRA O PERÍODO SELECIONADO ANTES DE AVALIAR O RANKING.",
  },
  {
    id: "fiscalizacao",
    title: "📋 MENU FISCALIZAÇÃO - COMO NÃO LEVAR MULTA",
    icon: Shield,
    featured: true,
    what: "O MENU AJUDA A ACOMPANHAR DOCUMENTOS E VENCIMENTOS PARA REDUZIR O RISCO DE PENDÊNCIAS. ELE NÃO GARANTE CONFORMIDADE NEM SUBSTITUI A ORIENTAÇÃO DOS ÓRGÃOS COMPETENTES.",
    how: [
      "1. CARREGAR DOCUMENTOS SUGERIDOS: CLIQUE EM CARREGAR DOCUMENTOS SUGERIDOS PARA ADICIONAR À LISTA OS ITENS DE REFERÊNCIA DISPONÍVEIS NO APLICATIVO. ITENS NOVOS FICAM SEM DATA ATÉ VOCÊ EDITÁ-LOS. A LISTA É UM CHECKLIST INICIAL, NÃO UMA RELAÇÃO OFICIAL OU UNIVERSAL DE EXIGÊNCIAS. CONFIRME O QUE SE APLICA AO POSTO COM CADA ÓRGÃO E COM AS REGRAS DO SEU ESTADO E MUNICÍPIO.",
      "2. CORES DO SISTEMA (SEMÁFORO): VERMELHO = DOCUMENTO VENCIDO; ROXO = VENCE EM ATÉ 30 DIAS; LARANJA = VENCE EM 31 A 90 DIAS; AMARELO PISCANDO = VENCE EM 91 A 180 DIAS; VERDE = MAIS DE 180 DIAS; CINZA = DATA NÃO INFORMADA.",
      "3. ORDEM DA LISTA: OS DOCUMENTOS SÃO ORDENADOS DO VENCIMENTO MAIS PRÓXIMO PARA O MAIS DISTANTE. OS ITENS SEM DATA FICAM IDENTIFICADOS COMO PENDENTES.",
      "4. BOTÃO RENOVEI: USE RENOVEI PARA INFORMAR A NOVA DATA E ANEXAR O ARQUIVO ATUALIZADO. IMAGENS RECEBEM MARCA-D’ÁGUA POSTO 10 COM DATA E HORA; ARQUIVOS PDF SÃO ANEXADOS SEM MARCA-D’ÁGUA.",
      "5. NOTIFICAÇÕES: O SINO DO APP EXIBE O RESUMO DOS ALERTAS DE VENCIMENTO. PARA WHATSAPP, CADASTRE O NÚMERO EM CONFIGURAÇÕES E USE A AÇÃO DE ENVIAR ALERTA: O APP ABRE UMA MENSAGEM PREENCHIDA PARA VOCÊ REVISAR E ENVIAR. NÃO HÁ ENVIO AUTOMÁTICO PELO WHATSAPP.",
      "6. DICA DE OURO: NO INÍCIO DO MÊS, REVISE OS DOCUMENTOS VERDES E, SE FOR ÚTIL, GUARDE UM PRINT INTERNO PARA ACOMPANHAMENTO. O STATUS VERDE NÃO CERTIFICA CONFORMIDADE LEGAL; MANTENHA OS DOCUMENTOS E LICENÇAS EXIGIDOS PELOS ÓRGÃOS ATUALIZADOS.",
    ],
    tip: "MANTENHA AS DATAS E OS ARQUIVOS ATUALIZADOS, FAÇA BACKUPS E CONFIRME EXIGÊNCIAS E PRAZOS DIRETAMENTE COM OS ÓRGÃOS COMPETENTES.",
  },
  {
    id: "loja",
    title: "TROCA DE ÓLEO / LOJA / PRODUTOS",
    icon: ShoppingBasket,
    what: "CONTROLES PARA SERVIÇOS DE TROCA DE ÓLEO, PRODUTOS E VENDAS DA LOJA.",
    how: [
      "USE TROCA DE ÓLEO PARA CADASTRAR CLIENTES, SERVIÇOS, TÉCNICOS, COMISSÕES E LEMBRETES DISPONÍVEIS.",
      "USE CONTROLE DE PRODUTOS PARA MANTER O CADASTRO E REGISTRAR VENDAS E REPOSIÇÕES.",
      "CONFIRA OS RELATÓRIOS DISPONÍVEIS PARA ACOMPANHAR OS REGISTROS DE CADA ÁREA.",
    ],
    tip: "CADASTRE OS ITENS E RESPONSÁVEIS ANTES DE LANÇAR MOVIMENTAÇÕES PARA MANTER OS REGISTROS ORGANIZADOS.",
  },
  {
    id: "dicas",
    title: "DICAS GERAIS",
    icon: Lightbulb,
    what: "BOAS PRÁTICAS PARA USAR E PROTEGER AS INFORMAÇÕES DO SISTEMA.",
    how: [
      "A INTERFACE É APRESENTADA EM LETRAS MAIÚSCULAS PARA PADRONIZAR A LEITURA.",
      "OS DADOS DO APLICATIVO FICAM ARMAZENADOS NO NAVEGADOR OU DISPOSITIVO. LIMPAR OS DADOS DO NAVEGADOR PODE APAGAR INFORMAÇÕES LOCAIS.",
      "FAÇA BACKUPS REGULARES NO MENU BACKUP E GUARDE UMA CÓPIA EM OUTRO LOCAL.",
      "EM CASO DE FISCALIZAÇÃO, CONSULTE O CHECK LIST E OS REGISTROS COM FOTO COMO APOIO; SIGA TAMBÉM AS EXIGÊNCIAS OFICIAIS APLICÁVEIS.",
    ],
    tip: "DÚVIDAS? FALE COM O SUPORTE DO POSTO 10.",
  },
];

function AjudaPage() {
  const state = useAppState();
  const [search, setSearch] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLocaleUpperCase("pt-BR");
    if (!query) return HELP_TOPICS;
    return HELP_TOPICS.filter((topic) =>
      [topic.title, topic.what, ...topic.how, topic.tip]
        .join(" ")
        .toLocaleUpperCase("pt-BR")
        .includes(query),
    );
  }, [search]);

  useEffect(() => {
    const saved = window.localStorage.getItem(CONTRACT_KEY);
    if (saved) {
      setAccepted(true);
      setAcceptedAt(saved);
    }
  }, []);

  const aceitarContrato = (checked: boolean) => {
    setAccepted(checked);
    if (!checked) {
      setAcceptedAt(null);
      window.localStorage.removeItem(CONTRACT_KEY);
      return;
    }
    const timestamp = new Date().toLocaleString("pt-BR");
    setAcceptedAt(timestamp);
    window.localStorage.setItem(CONTRACT_KEY, timestamp);
  };

  const baixarManual = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildManualPdf(state);
      const name = manualFileName();
      downloadBlob(blob, name);
      setStatus(`PDF salvo como ${name}.`);
    } catch {
      setStatus("Não foi possível gerar o Manual em PDF.");
    } finally {
      setBusy(false);
    }
  };

  const compartilharManual = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildManualPdf(state);
      setStatus(
        await sharePdf(blob, manualFileName(), "Manual de uso e planos do aplicativo Posto 10."),
      );
    } catch {
      setStatus("Não foi possível compartilhar o Manual em PDF.");
    } finally {
      setBusy(false);
    }
  };

  const baixarContrato = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildContratoPdf(state, accepted, acceptedAt);
      const name = contratoFileName();
      downloadBlob(blob, name);
      setStatus(`Contrato salvo como ${name}.`);
    } catch {
      setStatus("Não foi possível gerar o Contrato em PDF.");
    } finally {
      setBusy(false);
    }
  };

  const compartilharContrato = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await buildContratoPdf(state, accepted, acceptedAt);
      setStatus(
        await sharePdf(blob, contratoFileName(), "Contrato de uso do aplicativo Posto 10."),
      );
    } catch {
      setStatus("Não foi possível compartilhar o Contrato em PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="AJUDA - MANUAL DO SISTEMA POSTO 10"
      subtitle="INSTRUÇÕES DOS MENUS E RECURSOS DO SISTEMA"
    >
      <section className="mb-5 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-red-950 shadow-sm">
        <h2 className="font-display text-xl font-bold">FAÇA SEMPRE UMA CÓPIA DE SEGURANÇA</h2>
        <p className="mt-2 text-sm font-bold leading-6">
          OS DADOS FICAM ARMAZENADOS NO SEU APARELHO. NÃO SOMOS RESPONSÁVEIS POR PERDA, EXCLUSÃO,
          DEFEITO OU INDISPONIBILIDADE DOS SEUS DADOS. FAÇA BACKUPS REGULARES E GUARDE UMA CÓPIA EM
          OUTRO LOCAL.
        </p>
      </section>

      <section className="mb-5">
        <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-[#b7791f] bg-white p-3">
          <Search className="size-5 shrink-0 text-[#b7791f]" />
          <Input
            type="search"
            aria-label="PESQUISAR AJUDA"
            placeholder="PESQUISAR AJUDA..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          <nav
            aria-label="TÓPICOS DO MANUAL"
            className="rounded-xl border-2 border-[#b7791f] bg-white p-3 lg:sticky lg:top-24"
          >
            <h2 className="mb-2 font-display text-lg text-foreground">TÓPICOS DO MANUAL</h2>
            <ul className="grid gap-1">
              {filteredTopics.map((topic) => {
                const Icon = topic.icon;
                return (
                  <li key={topic.id}>
                    <a
                      href={`#help-topic-${topic.id}`}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold text-foreground hover:bg-amber-50"
                    >
                      <Icon className="size-4 shrink-0 text-[#b7791f]" />
                      {topic.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="grid gap-3">
            {filteredTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article
                  id={`help-topic-${topic.id}`}
                  key={topic.id}
                  className={`scroll-mt-24 rounded-xl border-2 border-[#b7791f] bg-white p-4 shadow-sm ${
                    "featured" in topic && topic.featured
                      ? "border-4 bg-amber-50 shadow-md ring-2 ring-amber-200"
                      : ""
                  }`}
                >
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-display text-lg text-foreground">
                        <Icon className="size-5 shrink-0 text-[#b7791f]" />
                        {topic.title}
                      </span>
                      <span className="shrink-0 rounded-md bg-[#b7791f] px-3 py-2 text-[10px] font-bold text-white">
                        VER DETALHES
                      </span>
                    </summary>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-foreground">
                      <p>
                        <strong>O QUE É:</strong> {topic.what}
                      </p>
                      <div>
                        <strong>COMO FUNCIONA:</strong>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {topic.how.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                      </div>
                      <p className="rounded-lg bg-amber-50 p-3">
                        <strong>DICA:</strong> {topic.tip}
                      </p>
                    </div>
                  </details>
                </article>
              );
            })}
            {filteredTopics.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#b7791f] bg-white p-6 text-center text-sm text-muted-foreground">
                NENHUM TÓPICO ENCONTRADO. TENTE OUTRO TERMO.
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-[#b7791f] bg-amber-50 p-3 text-center text-sm font-bold">
          DÚVIDAS? FALE COM O SUPORTE DO POSTO 10
        </p>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">GUIA COMPLETO DO APLICATIVO</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          O Shift Fuel Tracker reúne os registros operacionais do posto. Entre com a senha do perfil
          correspondente para acessar seus menus. Os perfis não expiram.
        </p>
        <div className="mt-4 space-y-3">
          {PLAN_MENU_FEATURES.map((feature) => (
            <article key={feature.path} className="border-b border-border pb-3 last:border-0">
              <h3 className="font-semibold text-foreground">{feature.label}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-5 space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-amber-700" />
          <h2 className="font-display text-xl text-foreground">ACESSO AOS MENUS POR PERFIL</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Os menus variam conforme o perfil. No modo local de demonstração, os dados ficam neste
          navegador e os perfis não substituem a autorização segura no servidor.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="p-3">MENU</th>
                {PROFILE_OPTIONS.map((profile) => (
                  <th key={profile.id} className="p-3">
                    {profile.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_MENU_FEATURES.map((feature) => (
                <tr key={feature.path} className="border-t border-border">
                  <th className="p-3 font-medium text-foreground">{feature.label}</th>
                  {PROFILE_OPTIONS.map((profile) => (
                    <td key={profile.id} className="p-3 text-muted-foreground">
                      {roleAllows(profile.id, feature.path) ? "INCLUÍDO" : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-5 space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">PERFIS DE ACESSO</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {PROFILE_OPTIONS.map((profile) => {
            const availableCount = PLAN_MENU_FEATURES.filter((feature) =>
              roleAllows(profile.id, feature.path),
            ).length;
            return (
              <article key={profile.id} className="rounded-lg border border-amber-300 bg-white p-3">
                <h3 className="font-display text-lg">{profile.name}</h3>
                <p className="mt-2 text-xs leading-5">{profile.description}</p>
                <p className="mt-2 text-xs font-semibold">{availableCount} MENUS DISPONÍVEIS.</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">Termo de uso e responsabilidade</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground">
          Declaro estar ciente de que os dados são armazenados localmente neste aparelho. Sou
          responsável por manter cópias de segurança e proteger minhas credenciais. A utilização do
          aplicativo não substitui a conferência dos registros operacionais do posto.
        </p>
        <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            checked={accepted}
            onChange={(event) => aceitarContrato(event.target.checked)}
          />
          <span>
            Li e estou ciente da responsabilidade de proteger os dados e realizar cópias de
            segurança.
          </span>
        </label>
        {acceptedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">Ciência registrada em {acceptedAt}.</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">Manual em PDF</h2>
        <p className="text-xs text-muted-foreground">
          Um único arquivo com os menus, instruções e perfis de acesso.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void compartilharManual()}>
            <Share2 className="size-4" /> Compartilhar Manual
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void baixarManual()}>
            <FileDown className="size-4" /> Salvar Manual
          </Button>
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl text-foreground">Contrato em PDF</h2>
        <p className="text-xs text-muted-foreground">
          Arquivo separado para salvar e compartilhar pelo WhatsApp. O documento registra a ciência
          do usuário.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void compartilharContrato()}>
            <Share2 className="size-4" /> Compartilhar Contrato
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void baixarContrato()}>
            <FileDown className="size-4" /> Salvar Contrato
          </Button>
        </div>
      </section>
      {status ? (
        <p className="mt-4 rounded-lg border border-primary/40 bg-secondary p-3 text-xs text-foreground">
          {status}
        </p>
      ) : null}
    </AppShell>
  );
}
