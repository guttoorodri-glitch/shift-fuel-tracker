import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Pencil, Plus, Trash2, UserRoundPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FRENTISTAS_KEY,
  META_TYPE_KEY,
  METAS_DEFINICAO_KEY,
  METAS_PADRAO,
  VENDAS_METAS_KEY,
  cpfValido,
  formatDateBR,
  maskCpf,
  maskPhone,
  parseQuantidade,
  readTipoMeta,
  usePostoStorage,
  writeTipoMeta,
  writeLocalJson,
  type FrentistaMeta,
  type MetaDefinicao,
  type TipoMeta,
  type TipoMetaApuracao,
  type VendaMeta,
} from "@/lib/metas";
import { todayISO } from "@/lib/store";

export const Route = createFileRoute("/metas")({
  component: MetasPage,
});

const EMPTY_FRENTISTAS: FrentistaMeta[] = [];
const EMPTY_VENDAS: VendaMeta[] = [];
const TABS = ["Frentistas", "Definir Metas do Mês", "Lançamento Diário", "Ranking do Mês"] as const;
type Tab = (typeof TABS)[number];
type FormFields = Omit<FrentistaMeta, "id" | "ativo" | "metas">;
const EMPTY_FORM: FormFields = { nome: "", cpf: "", nascimento: "", whatsapp: "" };

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `meta-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function MetasPage() {
  const [frentistas, saveFrentistas] = usePostoStorage(FRENTISTAS_KEY, EMPTY_FRENTISTAS);
  const [metas, saveMetas] = usePostoStorage(METAS_DEFINICAO_KEY, METAS_PADRAO);
  const [vendas, saveVendas] = usePostoStorage(VENDAS_METAS_KEY, EMPTY_VENDAS);
  const [tipoMeta, setTipoMeta] = useState<TipoMetaApuracao>("individual");
  const [activeTab, setActiveTab] = useState<Tab>("Frentistas");
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState<FrentistaMeta | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [dailyDraft, setDailyDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTipoMeta(readTipoMeta());
    if (!window.localStorage.getItem(META_TYPE_KEY)) writeTipoMeta("individual");
    const handleModeChange = () => setTipoMeta(readTipoMeta());
    window.addEventListener(`posto10-storage:${META_TYPE_KEY}`, handleModeChange);
    window.addEventListener("storage", handleModeChange);
    return () => {
      window.removeEventListener(`posto10-storage:${META_TYPE_KEY}`, handleModeChange);
      window.removeEventListener("storage", handleModeChange);
    };
  }, []);

  useEffect(() => {
    if (!window.localStorage.getItem(METAS_DEFINICAO_KEY)) {
      writeLocalJson(METAS_DEFINICAO_KEY, METAS_PADRAO);
    }
  }, []);

  useEffect(() => {
    setDailyDraft(
      Object.fromEntries(
        metas.flatMap((goal) =>
          frentistas.map((attendant) => {
            const value =
              vendas.find(
                (sale) =>
                  sale.data === date &&
                  sale.frentistaId === attendant.id &&
                  sale.metaNome === goal.nome,
              )?.quantidade ?? "";
            return [`${attendant.id}:${goal.id}`, value === "" ? "" : String(value)];
          }),
        ),
      ),
    );
  }, [date, frentistas, metas, vendas]);

  const activeFrentistas = frentistas.filter((attendant) => attendant.ativo);
  const monthPrefix = date.slice(0, 7);
  const daysInMonth = date
    ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()
    : 0;
  const selectedDay = Number(date.slice(8, 10));
  const daysRemaining = Math.max(0, daysInMonth - selectedDay);

  const goalFor = (goal: MetaDefinicao, attendantId: string) =>
    tipoMeta === "equipe"
      ? goal.valorMensal / Math.max(activeFrentistas.length, 1)
      : (goal.valoresIndividuais[attendantId] ?? goal.valorMensal);

  const accumulatedFor = (attendantId: string, goalName: string) =>
    vendas
      .filter(
        (sale) =>
          sale.data.startsWith(monthPrefix) &&
          sale.frentistaId === attendantId &&
          sale.metaNome === goalName,
      )
      .reduce((total, sale) => total + sale.quantidade, 0);

  const draftValue = (attendantId: string, goal: MetaDefinicao) =>
    parseQuantidade(dailyDraft[`${attendantId}:${goal.id}`] ?? "");

  const goalProgress = (attendantId: string, goal: MetaDefinicao) => {
    const savedForSelectedDate =
      vendas.find(
        (sale) =>
          sale.data === date && sale.frentistaId === attendantId && sale.metaNome === goal.nome,
      )?.quantidade ?? 0;
    const accumulated =
      accumulatedFor(attendantId, goal.nome) - savedForSelectedDate + draftValue(attendantId, goal);
    const target = goalFor(goal, attendantId);
    return { accumulated, target, percent: target > 0 ? (accumulated / target) * 100 : 0 };
  };

  const updateGoal = (id: string, update: Partial<MetaDefinicao>) =>
    saveMetas(metas.map((goal) => (goal.id === id ? { ...goal, ...update } : goal)));

  const saveDaily = () => {
    const newSales: VendaMeta[] = [...vendas];
    for (const goal of metas) {
      for (const attendant of activeFrentistas) {
        const quantity = draftValue(attendant.id, goal);
        const index = newSales.findIndex(
          (sale) =>
            sale.data === date && sale.frentistaId === attendant.id && sale.metaNome === goal.nome,
        );
        const entry = {
          data: date,
          frentistaId: attendant.id,
          metaNome: goal.nome,
          quantidade: quantity,
        };
        if (index >= 0) newSales[index] = entry;
        else newSales.push(entry);
      }
    }
    saveVendas(newSales);
    setMessage("Lançamentos do dia salvos.");
  };

  const leaderboard = activeFrentistas
    .map((attendant) => {
      const percentages = metas.map((goal) => {
        const target = goalFor(goal, attendant.id);
        return target > 0 ? (accumulatedFor(attendant.id, goal.nome) / target) * 100 : 0;
      });
      const percent =
        percentages.length > 0
          ? percentages.reduce((total, value) => total + value, 0) / percentages.length
          : 0;
      const goalHit =
        metas.length > 0 &&
        metas.every((goal) => {
          const target = goalFor(goal, attendant.id);
          return target > 0 && accumulatedFor(attendant.id, goal.nome) >= target;
        });
      return { attendant, percent, goalHit };
    })
    .sort((a, b) => b.percent - a.percent || a.attendant.nome.localeCompare(b.attendant.nome));

  const openNewAttendant = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const saveAttendant = (fields: FormFields): string | undefined => {
    const cpfDigits = fields.cpf.replace(/\D/g, "");
    if (!cpfValido(cpfDigits)) {
      return "Informe um CPF válido.";
    }
    const duplicate = frentistas.some(
      (attendant) => attendant.cpf.replace(/\D/g, "") === cpfDigits && attendant.id !== editing?.id,
    );
    if (duplicate) {
      return "Já existe um frentista cadastrado com este CPF.";
    }
    const normalized = { ...fields, nome: fields.nome.trim().toLocaleUpperCase("pt-BR") };
    if (editing) {
      saveFrentistas(
        frentistas.map((attendant) =>
          attendant.id === editing.id ? { ...attendant, ...normalized } : attendant,
        ),
      );
    } else {
      saveFrentistas([...frentistas, { id: createId(), ...normalized, ativo: true, metas: {} }]);
    }
    setFormOpen(false);
    setMessage("");
    return undefined;
  };

  const createGoal = (name: string, type: TipoMeta, value: number) => {
    saveMetas([
      ...metas,
      {
        id: createId(),
        nome: name.trim(),
        tipo: type,
        valorMensal: value,
        valoresIndividuais: {},
      },
    ]);
    setNewGoalOpen(false);
  };

  const unitLabel = (goal: MetaDefinicao) =>
    goal.tipo === "reais" ? "R$" : goal.tipo === "litros" ? "L" : "un.";

  return (
    <AppShell title="Metas" subtitle="Equipe, objetivos mensais e desempenho">
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            className={activeTab === tab ? "bg-[#7c3aed] hover:bg-[#6d28d9]" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      {message ? (
        <p role="status" className="mb-4 rounded-lg border border-primary/30 bg-card p-3 text-sm">
          {message}
        </p>
      ) : null}

      {activeTab === "Frentistas" ? (
        <section className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-foreground">Cadastro de Frentistas</h2>
              <p className="text-xs text-muted-foreground">{frentistas.length} cadastrado(s)</p>
            </div>
            <Button
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={openNewAttendant}
            >
              <UserRoundPlus className="size-4" /> Novo Frentista
            </Button>
          </div>
          <div className="space-y-2">
            {frentistas.map((attendant) => (
              <div
                key={attendant.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{attendant.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    CPF {maskCpf(attendant.cpf)} · Nascimento {formatDateBR(attendant.nascimento)}
                  </p>
                </div>
                {attendant.whatsapp ? (
                  <a
                    className="inline-flex items-center gap-1 text-sm text-green-700"
                    href={`https://wa.me/55${attendant.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`WhatsApp de ${attendant.nome}`}
                  >
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                ) : null}
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={attendant.ativo}
                    onChange={(event) =>
                      saveFrentistas(
                        frentistas.map((item) =>
                          item.id === attendant.id
                            ? { ...item, ativo: event.target.checked }
                            : item,
                        ),
                      )
                    }
                    className="size-4 accent-[#7c3aed]"
                  />
                  {attendant.ativo ? "Ativo" : "Inativo"}
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${attendant.nome}`}
                  onClick={() => {
                    setEditing(attendant);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Excluir ${attendant.nome}`}
                  onClick={() => {
                    if (window.confirm(`Excluir ${attendant.nome}?`)) {
                      saveFrentistas(frentistas.filter((item) => item.id !== attendant.id));
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            {frentistas.length === 0 ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                Cadastre frentistas para começar a definir metas.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "Definir Metas do Mês" ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg text-foreground">Metas mensais</h2>
                <p className="text-xs text-muted-foreground">
                  Modo atual:{" "}
                  {tipoMeta === "individual"
                    ? "individual por frentista"
                    : "meta da equipe dividida entre ativos"}
                  .
                </p>
              </div>
              <Button
                className="bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => setNewGoalOpen(true)}
              >
                <Plus className="size-4" /> Nova Meta Personalizada
              </Button>
            </div>
            {metas.map((goal) => (
              <div key={goal.id} className="mb-3 rounded-lg border border-border p-3 last:mb-0">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
                  <div>
                    <p className="font-semibold text-foreground">{goal.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {goal.tipo === "reais"
                        ? "R$"
                        : goal.tipo === "litros"
                          ? "Litros"
                          : "Unidades"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {tipoMeta === "equipe" ? "Meta mensal da equipe" : "Meta base mensal"}
                    </Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min="0"
                      step="any"
                      value={goal.valorMensal}
                      onChange={(event) =>
                        updateGoal(goal.id, {
                          valorMensal: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  {!goal.padrao ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Excluir a meta ${goal.nome}?`)) {
                          saveMetas(metas.filter((item) => item.id !== goal.id));
                        }
                      }}
                      aria-label={`Excluir meta ${goal.nome}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
                {tipoMeta === "individual" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {activeFrentistas.map((attendant) => (
                      <label key={attendant.id} className="text-xs text-muted-foreground">
                        {attendant.nome}
                        <Input
                          className="mt-1"
                          type="number"
                          min="0"
                          step="any"
                          value={goal.valoresIndividuais[attendant.id] ?? goal.valorMensal}
                          onChange={(event) =>
                            updateGoal(goal.id, {
                              valoresIndividuais: {
                                ...goal.valoresIndividuais,
                                [attendant.id]: Math.max(0, Number(event.target.value) || 0),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                    {activeFrentistas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Cadastre e ative frentistas para personalizar metas individuais.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "Lançamento Diário" ? (
        <section className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-foreground">Lançamento Diário</h2>
              <p className="text-xs text-muted-foreground">
                Informe a quantidade vendida por meta e frentista.
              </p>
            </div>
            <div>
              <Label htmlFor="metas-date">Data</Label>
              <Input
                id="metas-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>
          {activeFrentistas.length === 0 || metas.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Cadastre frentistas ativos e defina pelo menos uma meta para lançar vendas.
            </p>
          ) : (
            <div className="space-y-5">
              {metas.map((goal) => (
                <div key={goal.id}>
                  <h3 className="mb-2 font-semibold text-foreground">{goal.nome}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="p-2">Frentista</th>
                          <th className="p-2">Meta</th>
                          <th className="p-2">Vendido Hoje</th>
                          <th className="p-2">Acumulado Mês</th>
                          <th className="p-2">Falta para Meta</th>
                          <th className="p-2">Meta Diária Necessária</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeFrentistas.map((attendant) => {
                          const progress = goalProgress(attendant.id, goal);
                          const missing = Math.max(0, progress.target - progress.accumulated);
                          const neededPerDay = daysRemaining > 0 ? missing / daysRemaining : 0;
                          return (
                            <tr key={attendant.id} className="border-b last:border-0">
                              <td className="p-2 font-medium">{attendant.nome}</td>
                              <td className="p-2 tabular-nums">
                                {progress.target.toLocaleString("pt-BR")} {unitLabel(goal)}
                              </td>
                              <td className="p-2">
                                <Input
                                  className="w-28"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={dailyDraft[`${attendant.id}:${goal.id}`] ?? ""}
                                  onChange={(event) =>
                                    setDailyDraft((current) => ({
                                      ...current,
                                      [`${attendant.id}:${goal.id}`]: event.target.value,
                                    }))
                                  }
                                  aria-label={`Vendido hoje: ${attendant.nome}, ${goal.nome}`}
                                />
                              </td>
                              <td className="p-2 tabular-nums">
                                {progress.accumulated.toLocaleString("pt-BR")} {unitLabel(goal)}
                              </td>
                              <td className="p-2 tabular-nums">
                                {missing.toLocaleString("pt-BR")} {unitLabel(goal)}
                              </td>
                              <td className="p-2 tabular-nums">
                                {neededPerDay.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}{" "}
                                {unitLabel(goal)}
                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-[#7c3aed]"
                                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {progress.percent.toLocaleString("pt-BR", {
                                    maximumFractionDigits: 1,
                                  })}
                                  %
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={saveDaily}>
                Salvar lançamentos do dia
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "Ranking do Mês" ? (
        <section className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
          <h2 className="mb-4 font-display text-lg text-foreground">
            Ranking do Mês · {monthPrefix}
          </h2>
          <div className="space-y-3">
            {leaderboard.map(({ attendant, percent, goalHit }, index) => {
              const medal = ["🥇", "🥈", "🥉"][index];
              const border = ["border-amber-400", "border-slate-400", "border-amber-700"][index];
              return (
                <article
                  key={attendant.id}
                  className={`rounded-xl p-4 ${
                    goalHit
                      ? "animate-[blinkBorder_1s_infinite_alternate] border-4 bg-[linear-gradient(135deg,#fff,#fffef0)]"
                      : `border-2 bg-card ${index < 3 ? border : "border-border"}`
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {medal ? (
                        <span
                          className="shrink-0 text-[36px] leading-none"
                          aria-label={`Lugar ${index + 1}`}
                        >
                          {medal}
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          {!medal ? `${index + 1}º · ` : null}
                          {attendant.nome}
                          {goalHit ? (
                            <span
                              className="ml-2 inline-block animate-[bounce_1s_infinite] text-[48px] leading-none [filter:drop-shadow(0_0_12px_gold)]"
                              title="Meta mensal batida"
                              aria-label="Troféu: meta mensal batida"
                            >
                              🏆
                            </span>
                          ) : null}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <p className="text-xs text-muted-foreground">
                            CPF {maskCpf(attendant.cpf)}
                          </p>
                          {goalHit ? (
                            <span className="mt-3 ml-2 inline-block rotate-[-5deg] scale-110 border-4 border-dashed border-[#16a34a] bg-[#dcfce7] px-[18px] py-[10px] text-center text-[22px] font-black tracking-[1px] text-[#15803d]">
                              PARABÉNS SUA META FOI BATIDA ESTE MÊS !!!
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <p className="font-display text-lg font-bold text-[#7c3aed]">
                      {percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da meta
                    </p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {metas.map((goal) => {
                      const accumulated = accumulatedFor(attendant.id, goal.nome);
                      const target = goalFor(goal, attendant.id);
                      return (
                        <p key={goal.id} className="text-xs text-muted-foreground">
                          {goal.nome}: {accumulated.toLocaleString("pt-BR")} /{" "}
                          {target.toLocaleString("pt-BR")} {unitLabel(goal)}
                        </p>
                      );
                    })}
                  </div>
                </article>
              );
            })}
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cadastre frentistas ativos para gerar o ranking.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0) scale(1) }
          50% { transform: translateY(-8px) scale(1.2) }
        }
        @keyframes blinkBorder {
          0% { border-color: #facc15; box-shadow: 0 0 5px #facc15 }
          50% { border-color: #ffea00; box-shadow: 0 0 20px #ffea00, 0 0 30px gold }
          100% { border-color: #facc15; box-shadow: 0 0 5px #facc15 }
        }
      `}</style>

      {formOpen ? (
        <AttendantModal
          initial={
            editing
              ? {
                  nome: editing.nome,
                  cpf: maskCpf(editing.cpf),
                  nascimento: editing.nascimento,
                  whatsapp: maskPhone(editing.whatsapp),
                }
              : EMPTY_FORM
          }
          onClose={() => setFormOpen(false)}
          onSave={saveAttendant}
        />
      ) : null}
      {newGoalOpen ? <GoalModal onClose={() => setNewGoalOpen(false)} onSave={createGoal} /> : null}
    </AppShell>
  );
}

function AttendantModal({
  initial,
  onClose,
  onSave,
}: {
  initial: FormFields;
  onClose: () => void;
  onSave: (fields: FormFields) => string | undefined;
}) {
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState("");
  const setField = (field: keyof FormFields, value: string) =>
    setFields((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendant-modal-title"
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-[#7c3aed]/50 bg-card p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!fields.nome.trim() || !fields.cpf || !fields.nascimento || !fields.whatsapp) {
            setError("Preencha todos os campos obrigatórios.");
            return;
          }
          const saveError = onSave(fields);
          if (saveError) setError(saveError);
        }}
      >
        <h2 id="attendant-modal-title" className="font-display text-xl text-foreground">
          {initial.nome ? "Editar Frentista" : "Novo Frentista"}
        </h2>
        <label className="block text-xs text-muted-foreground">
          Nome Completo *
          <Input
            className="mt-1"
            required
            value={fields.nome}
            onChange={(event) => setField("nome", event.target.value.toLocaleUpperCase("pt-BR"))}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          CPF *
          <Input
            className="mt-1"
            required
            inputMode="numeric"
            value={fields.cpf}
            onChange={(event) => setField("cpf", maskCpf(event.target.value))}
            placeholder="000.000.000-00"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Data de Nascimento *
          <Input
            className="mt-1"
            type="date"
            required
            value={fields.nascimento}
            onChange={(event) => setField("nascimento", event.target.value)}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Celular WhatsApp *
          <Input
            className="mt-1"
            required
            inputMode="tel"
            value={fields.whatsapp}
            onChange={(event) => setField("whatsapp", maskPhone(event.target.value))}
            placeholder="(00) 00000-0000"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1 bg-orange-500 text-white hover:bg-orange-600">
            Salvar
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

function GoalModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, type: TipoMeta, value: number) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TipoMeta>("unidades");
  const [value, setValue] = useState("0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
        className="w-full max-w-md space-y-3 rounded-xl border border-[#7c3aed]/50 bg-card p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onSave(name, type, Math.max(0, Number(value) || 0));
        }}
      >
        <h2 id="goal-modal-title" className="font-display text-xl text-foreground">
          Nova Meta Personalizada
        </h2>
        <label className="block text-xs text-muted-foreground">
          Nome da Meta
          <Input
            className="mt-1"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Tipo
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={type}
            onChange={(event) => setType(event.target.value as TipoMeta)}
          >
            <option value="litros">Litros</option>
            <option value="unidades">Unidades</option>
            <option value="reais">R$</option>
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Valor da Meta Mensal
          <Input
            className="mt-1"
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1 bg-orange-500 text-white hover:bg-orange-600">
            Adicionar Meta
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
