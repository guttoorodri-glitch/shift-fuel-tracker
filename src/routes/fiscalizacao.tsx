import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Camera,
  ExternalLink,
  FilePlus2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  calculateFiscalDocuments,
  FISCAL_SOURCE_REFERENCES,
  FISCAL_ORGANIZATIONS,
  FISCAL_WHATSAPP_KEY,
  fiscalStatusColor,
  fiscalStatusLabel,
  formatFiscalDate,
  getFiscalAlertSummary,
  logFiscalWhatsApp,
  readFiscalDocuments,
  SUGGESTED_FISCAL_DOCUMENTS,
  useFiscalDocuments,
  writeFiscalDocuments,
  type FiscalDocument,
} from "@/lib/fiscalizacao";

export const Route = createFileRoute("/fiscalizacao")({
  head: () => ({
    meta: [
      { title: "FISCALIZAÇÃO - DOCUMENTOS E VENCIMENTOS — POSTO 10" },
      {
        name: "description",
        content: "CONTROLE DE DOCUMENTOS, DATAS DE VENCIMENTO E ALERTAS DE FISCALIZAÇÃO.",
      },
    ],
  }),
  component: FiscalizacaoPage,
});

const EMPTY_FORM = {
  orgao: "ANP",
  nomeDocumento: "",
  dataVencimento: "",
  responsavel: "",
  observacao: "",
};
const localTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const wasWhatsAppSentToday = (id: string) =>
  typeof window !== "undefined" &&
  window.localStorage.getItem(`ultimaNotificacao_whats_${id}`) === localTodayKey();

function watermarkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("NÃO FOI POSSÍVEL LER O ARQUIVO."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("O ARQUIVO SELECIONADO É INVÁLIDO."));
        return;
      }
      if (file.type === "application/pdf") {
        resolve(reader.result);
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error("NÃO FOI POSSÍVEL PROCESSAR A IMAGEM."));
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("NÃO FOI POSSÍVEL PREPARAR A IMAGEM."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataHora = new Date().toLocaleString("pt-BR");
        const bandHeight = Math.min(84, canvas.height);
        const padding = Math.max(10, Math.min(24, canvas.width * 0.02));
        context.fillStyle = "rgba(0,0,0,0.55)";
        context.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
        context.fillStyle = "#FFFFFF";
        context.textBaseline = "alphabetic";
        context.font = `bold ${Math.max(14, canvas.width * 0.04)}px Arial`;
        context.fillText("POSTO 10", padding, canvas.height - Math.min(46, bandHeight * 0.56));
        context.font = `${Math.max(11, canvas.width * 0.03)}px Arial`;
        context.fillText(dataHora, padding, canvas.height - Math.min(14, bandHeight * 0.15));
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function FiscalizacaoPage() {
  const { documents, error, refreshDocuments } = useFiscalDocuments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [editing, setEditing] = useState<FiscalDocument | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterOrg, setFilterOrg] = useState("TODOS");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [whatsAppSentToday, setWhatsAppSentToday] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setWhatsAppNumber(window.localStorage.getItem(FISCAL_WHATSAPP_KEY) ?? "");
  }, []);
  useEffect(() => {
    setWhatsAppSentToday(
      new Set(
        documents.filter((document) => wasWhatsAppSentToday(document.id)).map((doc) => doc.id),
      ),
    );
  }, [documents]);

  const calculatedDocuments = useMemo(() => calculateFiscalDocuments(documents), [documents]);
  const summary = getFiscalAlertSummary(calculatedDocuments);
  const orgs = useMemo(
    () => [...new Set([...FISCAL_ORGANIZATIONS, ...calculatedDocuments.map((doc) => doc.orgao)])],
    [calculatedDocuments],
  );
  const filteredDocuments = calculatedDocuments.filter((document) => {
    const matchesOrg = filterOrg === "TODOS" || document.orgao === filterOrg;
    const matchesStatus = filterStatus === "TODOS" || document.status === filterStatus;
    const matchesSearch =
      `${document.nomeDocumento} ${document.orgao} ${document.responsavel ?? ""}`
        .toLocaleUpperCase("pt-BR")
        .includes(search.trim().toLocaleUpperCase("pt-BR"));
    return matchesOrg && matchesStatus && matchesSearch;
  });

  const resetDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setRenewing(false);
    setForm(EMPTY_FORM);
    setFile(null);
  };

  const openNew = () => {
    setEditing(null);
    setRenewing(false);
    setForm(EMPTY_FORM);
    setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (document: FiscalDocument, renew = false) => {
    setEditing(document);
    setRenewing(renew);
    setForm({
      orgao: document.orgao,
      nomeDocumento: document.nomeDocumento,
      dataVencimento: renew ? "" : document.dataVencimento,
      responsavel: document.responsavel ?? "",
      observacao: document.observacao ?? "",
    });
    setFile(null);
    setDialogOpen(true);
  };

  const saveDocument = async () => {
    if (!form.nomeDocumento.trim()) {
      toast.error("INFORME O NOME DO DOCUMENTO.");
      return;
    }
    if (!form.dataVencimento) {
      toast.error("INFORME A DATA DE VENCIMENTO.");
      return;
    }
    if (renewing && !file) {
      toast.error("SELECIONE A NOVA FOTO OU O PDF DO DOCUMENTO RENOVADO.");
      return;
    }

    setSaving(true);
    try {
      const fotoUrl = file ? await watermarkImage(file) : editing?.fotoUrl;
      const updated: FiscalDocument = {
        id: editing?.id ?? crypto.randomUUID(),
        orgao: form.orgao.trim().toLocaleUpperCase("pt-BR"),
        nomeDocumento: form.nomeDocumento.trim().toLocaleUpperCase("pt-BR"),
        dataVencimento: form.dataVencimento,
        diasParaVencer: 0,
        status: "VERDE_OK",
        ...(form.responsavel.trim()
          ? { responsavel: form.responsavel.trim().toLocaleUpperCase("pt-BR") }
          : {}),
        ...(form.observacao.trim()
          ? { observacao: form.observacao.trim().toLocaleUpperCase("pt-BR") }
          : {}),
        ...(fotoUrl ? { fotoUrl } : {}),
      };
      const next = editing
        ? documents.map((document) => (document.id === editing.id ? updated : document))
        : [...documents, updated];
      writeFiscalDocuments(next);
      toast.success(renewing ? "DOCUMENTO RENOVADO E ATUALIZADO." : "DOCUMENTO SALVO.");
      resetDialog();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "NÃO FOI POSSÍVEL SALVAR. VERIFIQUE O ESPAÇO DE ARMAZENAMENTO DO NAVEGADOR.",
      );
    } finally {
      setSaving(false);
    }
  };

  const carregarDocumentosSugeridos = () => {
    try {
      const existingDocuments = readFiscalDocuments();
      const existing = new Set(
        existingDocuments.map((document) =>
          `${document.orgao.trim()}|${document.nomeDocumento.trim()}`.toLocaleUpperCase("pt-BR"),
        ),
      );
      const suggestions = SUGGESTED_FISCAL_DOCUMENTS.filter(
        (suggestion) =>
          !existing.has(
            `${suggestion.orgao.trim()}|${suggestion.nomeDocumento.trim()}`.toLocaleUpperCase(
              "pt-BR",
            ),
          ),
      ).map((suggestion) => ({
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `fiscal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        orgao: suggestion.orgao,
        nomeDocumento: suggestion.nomeDocumento,
        dataVencimento: "",
        diasParaVencer: Number.MAX_SAFE_INTEGER,
        status: "SEM_DATA" as const,
        observacao: "SUGESTÃO DE CONTROLE. CONFIRME A APLICABILIDADE COM O ÓRGÃO COMPETENTE.",
      }));

      if (suggestions.length === 0) {
        toast.info("TODOS OS DOCUMENTOS SUGERIDOS JÁ FORAM CARREGADOS.");
        setFilterOrg("TODOS");
        setFilterStatus("TODOS");
        setSearch("");
        return;
      }

      const saved = writeFiscalDocuments([...existingDocuments, ...suggestions]);
      refreshDocuments(saved);
      setFilterOrg("TODOS");
      setFilterStatus("TODOS");
      setSearch("");
      toast.success(
        `${suggestions.length} DOCUMENTOS SUGERIDOS CARREGADOS! AGORA INFORME AS DATAS DE VENCIMENTO.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? `NÃO FOI POSSÍVEL CARREGAR OS DOCUMENTOS: ${reason.message}`
          : "NÃO FOI POSSÍVEL CARREGAR OS DOCUMENTOS. VERIFIQUE O ARMAZENAMENTO DO NAVEGADOR.",
      );
    }
  };

  const deleteDocument = (document: FiscalDocument) => {
    if (!window.confirm(`EXCLUIR "${document.nomeDocumento}"?`)) return;
    try {
      writeFiscalDocuments(documents.filter((item) => item.id !== document.id));
      toast.success("DOCUMENTO EXCLUÍDO.");
    } catch {
      toast.error("NÃO FOI POSSÍVEL EXCLUIR O DOCUMENTO.");
    }
  };

  const sendWhatsApp = (document: FiscalDocument) => {
    const digits = whatsAppNumber.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits.slice(2) : digits;
    if (phone.length < 10) {
      toast.error("CADASTRE O NÚMERO DO WHATSAPP EM AJUSTES ANTES DE ENVIAR ALERTAS.");
      return;
    }
    const date = formatFiscalDate(document.dataVencimento);
    const message = `⚠️ ALERTA POSTO 10 - FISCALIZAÇÃO\nDOCUMENTO: ${document.nomeDocumento}\nÓRGÃO: ${document.orgao}\nVENCE EM: ${document.diasParaVencer} DIAS (${date})\nSTATUS: ${document.status}\nPROVIDENCIAR RENOVAÇÃO!`;
    const link = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    const opened = window.open(link, "_blank");
    if (!opened) {
      toast.error("O NAVEGADOR BLOQUEOU A NOVA ABA. PERMITA POP-UPS E TENTE NOVAMENTE.");
      return;
    }
    opened.opener = null;
    try {
      logFiscalWhatsApp(document, link);
      setWhatsAppSentToday((current) => new Set(current).add(document.id));
      toast.success("ALERTA REGISTRADO NO HISTÓRICO DE ENVIO.");
    } catch {
      toast.error("O LINK FOI ABERTO, MAS NÃO FOI POSSÍVEL SALVAR O LOG DE ENVIO.");
    }
  };

  const counts = {
    vencido: calculatedDocuments.filter((document) => document.status === "VENCIDO").length,
    roxo: calculatedDocuments.filter((document) => document.status === "ROXO_30").length,
    laranja: calculatedDocuments.filter((document) => document.status === "LARANJA_90").length,
    amarelo: calculatedDocuments.filter((document) => document.status === "AMARELO_180").length,
    semData: calculatedDocuments.filter((document) => document.status === "SEM_DATA").length,
    verde: calculatedDocuments.filter((document) => document.status === "VERDE_OK").length,
  };

  return (
    <AppShell title="FISCALIZAÇÃO" subtitle="DOCUMENTOS, VENCIMENTOS E ALERTAS">
      <Toaster position="top-right" />
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      <section className="mb-4 rounded-xl border border-[#b7791f] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-foreground">ALERTAS DE VENCIMENTO</h2>
            <p className="mt-1 text-xs text-muted-foreground">{summary.message}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <BellRing className="size-5 text-[#b7791f]" />
            {summary.dueWithin180} DOCUMENTOS COM ALERTA
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["SEM DATA", counts.semData, "#6B7280"],
            ["VENCIDOS", counts.vencido, "#E53E3E"],
            ["ATÉ 30 DIAS", counts.roxo, "#805AD5"],
            ["31 A 90 DIAS", counts.laranja, "#DD6B20"],
            ["91 A 180 DIAS", counts.amarelo, "#D69E2E"],
            ["OK", counts.verde, "#38A169"],
          ].map(([label, count, color]) => (
            <div
              key={label}
              className="rounded-lg border p-2 text-center text-xs font-bold"
              style={{ borderColor: color as string, color: color as string }}
            >
              {label}: {count}
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-[#b7791f] text-white hover:bg-[#9a6419]"
          onClick={carregarDocumentosSugeridos}
        >
          <FilePlus2 className="size-4" /> CARREGAR DOCUMENTOS SUGERIDOS
        </Button>
        <Button variant="outline" className="border-[#b7791f] text-[#8a5817]" onClick={openNew}>
          <Plus className="size-4" /> ADICIONAR NOVO DOCUMENTO
        </Button>
      </div>

      <section className="mb-4 rounded-xl border border-[#b7791f]/40 bg-white p-4">
        <h2 className="text-sm font-extrabold text-foreground">REFERÊNCIAS OFICIAIS CONSULTADAS</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          AS SUGESTÕES SÃO UM CHECKLIST EDITÁVEL, NÃO UMA LISTA UNIVERSAL DE EXIGÊNCIAS. CONFIRME
          APLICABILIDADE, VALIDADE E REGRAS ESTADUAIS/MUNICIPAIS COM O ÓRGÃO COMPETENTE.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {FISCAL_SOURCE_REFERENCES.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#8a5817] underline underline-offset-2"
              >
                {source.label}
                <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_1.5fr]">
        <div>
          <Label htmlFor="fiscal-org-filter">FILTRAR POR ÓRGÃO</Label>
          <select
            id="fiscal-org-filter"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={filterOrg}
            onChange={(event) => setFilterOrg(event.target.value)}
          >
            <option value="TODOS">TODOS OS ÓRGÃOS</option>
            {orgs.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fiscal-status-filter">FILTRAR POR STATUS</Label>
          <select
            id="fiscal-status-filter"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="TODOS">TODOS OS STATUS</option>
            <option value="SEM_DATA">SEM DATA</option>
            <option value="VENCIDO">VENCIDO</option>
            <option value="ROXO_30">ATÉ 30 DIAS</option>
            <option value="LARANJA_90">31 A 90 DIAS</option>
            <option value="AMARELO_180">91 A 180 DIAS</option>
            <option value="VERDE_OK">OK</option>
          </select>
        </div>
        <div>
          <Label htmlFor="fiscal-search">BUSCAR DOCUMENTO</Label>
          <Input
            id="fiscal-search"
            className="mt-1"
            placeholder="DIGITE NOME, ÓRGÃO OU RESPONSÁVEL"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      {filteredDocuments.length === 0 ? (
        <section className="rounded-xl border border-dashed border-[#b7791f] bg-card p-8 text-center">
          <ShieldCheck className="mx-auto size-10 text-[#b7791f]" />
          <p className="mt-2 text-sm font-bold">NENHUM DOCUMENTO ENCONTRADO</p>
          <p className="mt-1 text-xs text-muted-foreground">
            CARREGUE OS SUGERIDOS OU ADICIONE UM DOCUMENTO PARA COMEÇAR.
          </p>
        </section>
      ) : (
        <div className="grid gap-3">
          {filteredDocuments.map((document) => {
            const color = fiscalStatusColor(document.status);
            return (
              <article
                key={document.id}
                className={`rounded-xl border border-border border-l-[6px] bg-card p-4 shadow-sm ${
                  document.status === "AMARELO_180" ? "fiscalizacao-blink" : ""
                }`}
                style={{ borderLeftColor: color }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg text-foreground">
                        {document.nomeDocumento}
                      </h2>
                      {document.status === "VENCIDO" ? (
                        <AlertTriangle className="size-5" style={{ color }} />
                      ) : null}
                      {document.status === "SEM_DATA" ? (
                        <CalendarClock className="size-5" style={{ color }} />
                      ) : null}
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {fiscalStatusLabel(document)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {document.orgao} · VENCIMENTO: {formatFiscalDate(document.dataVencimento)}
                    </p>
                    {document.responsavel ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        RESPONSÁVEL: {document.responsavel}
                      </p>
                    ) : null}
                    {document.observacao ? (
                      <p className="mt-1 text-xs text-muted-foreground">{document.observacao}</p>
                    ) : null}
                  </div>
                  {document.fotoUrl ? (
                    <a
                      href={document.fotoUrl}
                      download={`${document.nomeDocumento.replace(/\s+/g, "-")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex size-16 items-center justify-center overflow-hidden rounded-md border border-[#b7791f] bg-muted"
                      aria-label="ABRIR ARQUIVO DO DOCUMENTO"
                    >
                      {document.fotoUrl.startsWith("data:image/") ? (
                        <img
                          src={document.fotoUrl}
                          alt={`ARQUIVO ${document.nomeDocumento}`}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-[#b7791f]">PDF</span>
                      )}
                    </a>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {document.status === "SEM_DATA" ? (
                    <Button
                      size="sm"
                      className="fiscalizacao-date-required bg-yellow-400 font-extrabold text-yellow-950 hover:bg-yellow-500"
                      onClick={() => openEdit(document)}
                    >
                      <CalendarClock className="size-4" /> ⚠️ INFORMAR DATA DE VENCIMENTO
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    className="bg-[#b7791f] text-white hover:bg-[#9a6419]"
                    onClick={() => openEdit(document, true)}
                  >
                    <RefreshCw className="size-4" /> RENOVEI
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(document)}>
                    <Pencil className="size-4" /> EDITAR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => deleteDocument(document)}
                  >
                    <Trash2 className="size-4" /> EXCLUIR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      (whatsAppNumber.replace(/\D/g, "").startsWith("55")
                        ? whatsAppNumber.replace(/\D/g, "").slice(2).length
                        : whatsAppNumber.replace(/\D/g, "").length) < 10 ||
                      whatsAppSentToday.has(document.id)
                    }
                    onClick={() => sendWhatsApp(document)}
                  >
                    {whatsAppSentToday.has(document.id)
                      ? "ALERTA ENVIADO HOJE"
                      : "ENVIAR ALERTA WHATSAPP"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : resetDialog())}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {renewing ? "RENOVAR DOCUMENTO" : editing ? "EDITAR DOCUMENTO" : "NOVO DOCUMENTO"}
            </DialogTitle>
            <DialogDescription>
              INFORME OS DADOS DO DOCUMENTO E ANEXE UMA FOTO OU PDF, SE DISPONÍVEL.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="fiscal-org">ÓRGÃO</Label>
              <select
                id="fiscal-org"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={orgs.includes(form.orgao) ? form.orgao : "__NOVO__"}
                onChange={(event) =>
                  setForm({
                    ...form,
                    orgao: event.target.value === "__NOVO__" ? "" : event.target.value,
                  })
                }
              >
                {orgs.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
                <option value="__NOVO__">ADICIONAR NOVO ÓRGÃO</option>
              </select>
              {!orgs.includes(form.orgao) ? (
                <Input
                  autoFocus
                  className="mt-2"
                  placeholder="DIGITE O NOVO ÓRGÃO"
                  value={form.orgao}
                  onChange={(event) => setForm({ ...form, orgao: event.target.value })}
                />
              ) : null}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fiscal-name">NOME DO DOCUMENTO</Label>
              <Input
                id="fiscal-name"
                placeholder="ADICIONAR NOVO DOCUMENTO NO ÓRGÃO"
                value={form.nomeDocumento}
                onChange={(event) => setForm({ ...form, nomeDocumento: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fiscal-date">DATA DE VENCIMENTO</Label>
              <Input
                id="fiscal-date"
                type="date"
                value={form.dataVencimento}
                onChange={(event) => setForm({ ...form, dataVencimento: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fiscal-owner">RESPONSÁVEL</Label>
              <Input
                id="fiscal-owner"
                placeholder="EX.: CONTADOR JOÃO"
                value={form.responsavel}
                onChange={(event) => setForm({ ...form, responsavel: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fiscal-observation">OBSERVAÇÃO</Label>
              <Input
                id="fiscal-observation"
                value={form.observacao}
                onChange={(event) => setForm({ ...form, observacao: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fiscal-file">FOTO OU PDF DO DOCUMENTO</Label>
              <Input
                id="fiscal-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {editing?.fotoUrl && !file ? (
                <p className="text-xs text-muted-foreground">ARQUIVO ATUAL SERÁ MANTIDO.</p>
              ) : null}
              {file ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Upload className="size-3" /> {file.name}
                </p>
              ) : null}
              {file?.type.startsWith("image/") ? (
                <p className="text-[10px] text-muted-foreground">
                  A IMAGEM RECEBERÁ MARCA D’ÁGUA POSTO 10 E DATA/HORA.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog} disabled={saving}>
              <X className="size-4" /> CANCELAR
            </Button>
            <Button
              className="bg-[#b7791f] text-white hover:bg-[#9a6419]"
              onClick={() => void saveDocument()}
              disabled={saving}
            >
              <CalendarClock className="size-4" />
              {saving ? "SALVANDO..." : "SALVAR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
