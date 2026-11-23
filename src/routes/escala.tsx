import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useAppState } from "@/lib/store";

type Turno = {
  id: string;
  nome: string;
  entrada: string;
  saida: string;
  descanso: 40 | 60;
};

type Frentista = { id: string; nome: string; turnoId: string };
type StatusDia = "TRABALHO" | "FOLGA" | "FALTA" | "JUSTIFICADA";
type StatusEscalaLivre = "TRABALHA" | "FOLGA" | "FERIAS" | "ATESTADO";
type TipoEscala = "6x1" | "12x36" | "5x2" | "livre";
type Escala = Record<string, Record<number, StatusDia>>;
type EscalaLivre = Record<string, Record<number, StatusEscalaLivre>>;
type Confirmacao = { titulo: string; onSim: () => void } | null;

const TURNOS_INICIAIS: Turno[] = [
  { id: "manha", nome: "MANHÃ", entrada: "06:00", saida: "14:20", descanso: 60 },
  { id: "tarde", nome: "TARDE", entrada: "14:00", saida: "22:20", descanso: 60 },
  { id: "noite", nome: "NOITE", entrada: "22:00", saida: "06:20", descanso: 60 },
  { id: "inter", nome: "INTER", entrada: "08:00", saida: "16:00", descanso: 40 },
];

const FRENTISTAS_INICIAIS: Frentista[] = Array.from({ length: 6 }, (_, index) => ({
  id: `frentista-${index + 1}`,
  nome: "",
  turnoId: TURNOS_INICIAIS[index % TURNOS_INICIAIS.length]?.id ?? "manha",
}));

const STATUS: StatusDia[] = ["TRABALHO", "FOLGA", "FALTA", "JUSTIFICADA"];
const INICIAIS_STATUS: Record<StatusDia, string> = {
  TRABALHO: "T",
  FOLGA: "F",
  FALTA: "A",
  JUSTIFICADA: "J",
};
const STATUS_ESCALA_LIVRE: StatusEscalaLivre[] = ["TRABALHA", "FOLGA", "FERIAS", "ATESTADO"];
const INICIAIS_STATUS_LIVRE: Record<StatusEscalaLivre, string> = {
  TRABALHA: "T",
  FOLGA: "F",
  FERIAS: "V",
  ATESTADO: "A",
};
const LABEL_STATUS_LIVRE: Record<StatusEscalaLivre, string> = {
  TRABALHA: "TRABALHA",
  FOLGA: "FOLGA",
  FERIAS: "FÉRIAS",
  ATESTADO: "ATESTADO",
};
const COR_STATUS_LIVRE: Record<StatusEscalaLivre, string> = {
  TRABALHA: "bg-green-600 text-white",
  FOLGA: "bg-gray-400 text-black",
  FERIAS: "bg-blue-600 text-white",
  ATESTADO: "bg-red-600 text-white",
};
const CHAVE_ESCALA_LIVRE = (mes: number, ano: number) => `escala_livre_${mes}_${ano}`;

function calculaSaida(entrada: string, descanso: number): string {
  const [h, m] = entrada.split(":").map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return "";

  let total = h * 60 + m;
  total += 8 * 60 + (descanso === 60 ? 20 : 0);
  total %= 24 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function getUltimoDia(mes: number, ano: number): number {
  return new Date(ano, mes, 0).getDate();
}

export const Route = createFileRoute("/escala")({
  component: EscalaPage,
});

function EscalaPage() {
  const { company } = useAppState();
  const [hydrated, setHydrated] = useState(false);
  const [mesAno, setMesAno] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [frentistas, setFrentistas] = useState<Frentista[]>([]);
  const [tipoEscala, setTipoEscala] = useState<TipoEscala>("6x1");
  const [escala, setEscala] = useState<Escala>({});
  const [escalaLivre, setEscalaLivre] = useState<EscalaLivre>({});
  const [statusLivreSelecionado, setStatusLivreSelecionado] =
    useState<StatusEscalaLivre>("TRABALHA");
  const [arrastandoLivre, setArrastandoLivre] = useState(false);
  const [proximoTurnoId, setProximoTurnoId] = useState(5);
  const [proximoFrentistaId, setProximoFrentistaId] = useState(7);
  const [solicitarImpressao, setSolicitarImpressao] = useState(false);
  const [urlWhatsApp, setUrlWhatsApp] = useState("");
  const [statusCompartilhamento, setStatusCompartilhamento] = useState("");
  const [avisoEscala, setAvisoEscala] = useState("");
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);

  const [anoTexto, mesTexto] = mesAno.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const ultimoDia = mes > 0 && ano > 0 ? getUltimoDia(mes, ano) : 0;
  const dias = Array.from({ length: ultimoDia }, (_, index) => index + 1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setTurnos(TURNOS_INICIAIS);
    setFrentistas(FRENTISTAS_INICIAIS);
    const hoje = new Date();
    setMesAno(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !mesAno) return;
    setEscala({});
    try {
      const saved = window.localStorage.getItem(CHAVE_ESCALA_LIVRE(mes, ano));
      setEscalaLivre(saved ? (JSON.parse(saved) as EscalaLivre) : {});
      setAvisoEscala("");
    } catch {
      setEscalaLivre({});
      setAvisoEscala("NÃO FOI POSSÍVEL CARREGAR A ESCALA LIVRE SALVA.");
    }
  }, [hydrated, mesAno, mes, ano]);

  useEffect(() => {
    const pararArraste = () => setArrastandoLivre(false);
    window.addEventListener("pointerup", pararArraste);
    window.addEventListener("pointercancel", pararArraste);
    return () => {
      window.removeEventListener("pointerup", pararArraste);
      window.removeEventListener("pointercancel", pararArraste);
    };
  }, []);

  useEffect(() => {
    if (!solicitarImpressao || typeof window === "undefined") return;
    window.print();
    setSolicitarImpressao(false);
  }, [solicitarImpressao]);

  useEffect(() => {
    if (!urlWhatsApp || typeof window === "undefined") return;
    window.open(urlWhatsApp, "_blank");
    setUrlWhatsApp("");
  }, [urlWhatsApp]);

  function getDiaSemana(dia: number): string {
    const diasDaSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
    return diasDaSemana[new Date(ano, mes - 1, dia).getDay()] ?? "";
  }
  const referenciaMes = mesAno ? `${mesTexto}/${anoTexto}` : "";
  const indiceIntermediario = turnos.findIndex(
    (turno) =>
      turno.id === "inter" ||
      ["INTER", "INTERMEDIARIO"].includes(turno.nome.trim().toLocaleUpperCase("pt-BR")),
  );
  const turnosNaOrdemDaEscala = [...turnos];
  if (indiceIntermediario >= 0) {
    const [intermediario] = turnosNaOrdemDaEscala.splice(indiceIntermediario, 1);
    if (intermediario)
      turnosNaOrdemDaEscala.splice(Math.min(1, turnosNaOrdemDaEscala.length), 0, intermediario);
  }

  const atualizarTurno = (turnoId: string, alteracoes: Partial<Turno>) => {
    setTurnos((atuais) =>
      atuais.map((turno) => {
        if (turno.id !== turnoId) return turno;
        const atualizado = { ...turno, ...alteracoes };
        if ("entrada" in alteracoes || "descanso" in alteracoes) {
          atualizado.saida = calculaSaida(atualizado.entrada, atualizado.descanso);
        }
        return atualizado;
      }),
    );
  };

  const adicionarTurno = () => {
    const id = `turno-${proximoTurnoId}`;
    setTurnos((atuais) => [
      ...atuais,
      {
        id,
        nome: `TURNO ${proximoTurnoId}`,
        entrada: "00:00",
        saida: calculaSaida("00:00", 40),
        descanso: 40,
      },
    ]);
    setProximoTurnoId((atual) => atual + 1);
  };

  const removerTurno = (turnoId: string) => {
    if (turnos.length <= 1) return;
    const restantes = turnos.filter((turno) => turno.id !== turnoId);
    const turnoFallback = restantes[0];
    if (!turnoFallback) return;

    setTurnos(restantes);
    setFrentistas((atuais) =>
      atuais.map((frentista) =>
        frentista.turnoId === turnoId ? { ...frentista, turnoId: turnoFallback.id } : frentista,
      ),
    );
  };

  const solicitarRemocaoTurno = (turno: Turno) => {
    setConfirmacao({
      titulo: `Remover o turno ${turno.nome}?`,
      onSim: () => removerTurno(turno.id),
    });
  };

  const solicitarRemocaoFrentista = (frentista: Frentista) => {
    setConfirmacao({
      titulo: `Remover ${frentista.nome.trim() || "este frentista"}?`,
      onSim: () => {
        setFrentistas((atuais) => atuais.filter((item) => item.id !== frentista.id));
        setEscala((atual) => {
          const novaEscala = { ...atual };
          delete novaEscala[frentista.id];
          return novaEscala;
        });
      },
    });
  };

  const adicionarFrentista = () => {
    setFrentistas((atuais) => [
      ...atuais,
      {
        id: `frentista-${proximoFrentistaId}`,
        nome: "",
        turnoId: turnos[0]?.id ?? "",
      },
    ]);
    setProximoFrentistaId((atual) => atual + 1);
  };

  const gerarEscala = () => {
    if (!ultimoDia || tipoEscala === "livre") return;

    const gerada: Escala = {};
    frentistas.forEach((frentista, index) => {
      const diasFrentista: Record<number, StatusDia> = {};

      if (tipoEscala === "6x1") {
        dias.forEach((dia) => {
          diasFrentista[dia] = (dia - 1 + (index % 7)) % 7 === 6 ? "FOLGA" : "TRABALHO";
        });

        const domingos = dias.filter((dia) => new Date(ano, mes - 1, dia).getDay() === 0);
        if (domingos.length > 0 && !domingos.some((dia) => diasFrentista[dia] === "FOLGA")) {
          const domingoGarantido = domingos[index % domingos.length];
          if (domingoGarantido !== undefined) diasFrentista[domingoGarantido] = "FOLGA";
        }
      } else if (tipoEscala === "5x2") {
        const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
        const folgasPorSemana = [
          [1, 4],
          [2, 5],
        ];
        dias.forEach((dia) => {
          const semana = Math.floor((primeiroDiaSemana + dia - 1) / 7);
          const folgas = folgasPorSemana[(semana + index) % folgasPorSemana.length] ?? [];
          const diaSemana = new Date(ano, mes - 1, dia).getDay();
          diasFrentista[dia] = folgas.includes(diaSemana) ? "FOLGA" : "TRABALHO";
        });
      } else {
        dias.forEach((dia) => {
          diasFrentista[dia] = (dia + index) % 2 === 0 ? "TRABALHO" : "FOLGA";
        });
      }

      gerada[frentista.id] = diasFrentista;
    });

    setEscala(gerada);
  };

  const getTurnoDoFrentistaNoDia = (frentistaId: string) =>
    frentistas.find((frentista) => frentista.id === frentistaId)?.turnoId ?? "manha";

  const podeMarcarFolga = (
    frentistaId: string,
    dia: number,
    turnoDoFrentista: string,
    statusAtual: StatusDia,
  ) => {
    if (statusAtual === "FOLGA") return true;

    return !frentistas.some(
      (outroFrentista) =>
        outroFrentista.id !== frentistaId &&
        outroFrentista.turnoId === turnoDoFrentista &&
        escala[outroFrentista.id]?.[dia] === "FOLGA",
    );
  };

  const ciclarStatus = (frentistaId: string, dia: number) => {
    const statusAtual = escala[frentistaId]?.[dia] ?? "TRABALHO";
    const indice = STATUS.indexOf(statusAtual);
    const proximo = STATUS[(indice + 1) % STATUS.length];
    if (!proximo) return;

    if (
      proximo === "FOLGA" &&
      !podeMarcarFolga(frentistaId, dia, getTurnoDoFrentistaNoDia(frentistaId), statusAtual)
    ) {
      setAvisoEscala("JÁ EXISTE UMA FOLGA MARCADA NESTE DIA PARA O MESMO TURNO.");
      return;
    }

    setAvisoEscala("");
    setEscala((atual) => {
      const linha = atual[frentistaId] ?? {};
      return { ...atual, [frentistaId]: { ...linha, [dia]: proximo } };
    });
  };

  const marcarStatusLivre = (frentistaId: string, dia: number) => {
    setEscalaLivre((atual) => ({
      ...atual,
      [frentistaId]: {
        ...(atual[frentistaId] ?? {}),
        [dia]: statusLivreSelecionado,
      },
    }));
  };

  const salvarEscalaLivre = () => {
    try {
      window.localStorage.setItem(CHAVE_ESCALA_LIVRE(mes, ano), JSON.stringify(escalaLivre));
      setAvisoEscala("ESCALA LIVRE SALVA COM SUCESSO.");
    } catch {
      setAvisoEscala("NÃO FOI POSSÍVEL SALVAR. VERIFIQUE O ESPAÇO DO NAVEGADOR.");
    }
  };

  const limparMesEscalaLivre = () => {
    try {
      window.localStorage.removeItem(CHAVE_ESCALA_LIVRE(mes, ano));
      setEscalaLivre({});
      setAvisoEscala("ESCALA LIVRE DO MÊS LIMPA.");
    } catch {
      setAvisoEscala("NÃO FOI POSSÍVEL LIMPAR A ESCALA LIVRE DESTE MÊS.");
    }
  };

  const copiarMesAnteriorEscalaLivre = () => {
    if (mes < 1 || ano < 1) return;
    const anterior = new Date(ano, mes - 2, 1);
    const chaveAnterior = CHAVE_ESCALA_LIVRE(anterior.getMonth() + 1, anterior.getFullYear());
    try {
      const saved = window.localStorage.getItem(chaveAnterior);
      if (!saved) {
        setAvisoEscala("NÃO HÁ ESCALA LIVRE SALVA NO MÊS ANTERIOR.");
        return;
      }
      const copied = JSON.parse(saved) as EscalaLivre;
      const diasAnteriores = getUltimoDia(anterior.getMonth() + 1, anterior.getFullYear());
      const novoRascunho: EscalaLivre = {};
      frentistas.forEach((frentista) => {
        const linha = copied[frentista.id];
        if (!linha) return;
        novoRascunho[frentista.id] = Object.fromEntries(
          Object.entries(linha).filter(
            ([dia]) => Number(dia) <= ultimoDia && Number(dia) <= diasAnteriores,
          ),
        ) as Record<number, StatusEscalaLivre>;
      });
      setEscalaLivre(novoRascunho);
      setAvisoEscala("ESCALA DO MÊS ANTERIOR COPIADA. CLIQUE EM SALVAR PARA CONFIRMAR.");
    } catch {
      setAvisoEscala("NÃO FOI POSSÍVEL LER A ESCALA LIVRE DO MÊS ANTERIOR.");
    }
  };

  const diasTrabalhadosDoMes = dias.filter((dia) =>
    frentistas.some((frentista) => escalaLivre[frentista.id]?.[dia] === "TRABALHA"),
  ).length;

  const compartilharWhatsApp = () => {
    const texto =
      `ESCALA ${company?.name ?? ""} ${mes}/${ano}\n` +
      frentistas
        .map((frentista) => {
          const diasTexto = dias
            .map((dia) => {
              const status =
                tipoEscala === "livre"
                  ? (escalaLivre[frentista.id]?.[dia] ?? "FOLGA")
                  : (escala[frentista.id]?.[dia] ?? "TRABALHO");
              return `${dia}:${status}`;
            })
            .join(" ");
          return `${frentista.nome.trim() || "FRENTISTA"}: ${diasTexto}`;
        })
        .join("\n");
    setStatusCompartilhamento("ABRINDO WHATSAPP...");
    setUrlWhatsApp(`https://wa.me/?text=${encodeURIComponent(texto)}`);
  };

  const classeStatus = (status: StatusDia) => {
    switch (status) {
      case "TRABALHO":
        return "bg-green-600 text-white";
      case "FOLGA":
        return "bg-red-600 text-white";
      case "FALTA":
        return "bg-yellow-400 text-black";
      case "JUSTIFICADA":
        return "bg-[#7B2CBF] text-white";
    }
  };

  if (!hydrated) return null;

  return (
    <AppShell title="Escala" subtitle="Configuração de turnos, equipe e escala mensal">
      <div className="space-y-5 bg-white p-4 text-black uppercase sm:p-6">
        <header className="no-print border-b border-gray-300 pb-3">
          <h1 className="text-xl font-bold">{company?.name}</h1>
          <p className="text-sm font-semibold">CNPJ: {company?.cnpj}</p>
        </header>

        <section className="no-print grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-bold">
            MÊS / ANO
            <input
              aria-label="Mês e ano da escala"
              className="min-h-10 rounded-md border border-gray-400 bg-white px-3 text-sm text-black sm:max-w-xs"
              type="month"
              value={mesAno}
              onChange={(event) => setMesAno(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold">
            REGIME DA ESCALA
            <select
              className="min-h-10 rounded-md border border-gray-400 bg-white px-3 text-sm text-black"
              value={tipoEscala}
              onChange={(event) => setTipoEscala(event.target.value as TipoEscala)}
            >
              <option value="6x1">6X1</option>
              <option value="12x36">12X36</option>
              <option value="5x2">5X2</option>
              <option value="livre">ESCALA LIVRE - MANUAL</option>
            </select>
          </label>
        </section>

        <section className="no-print space-y-3 rounded-xl border border-gray-300 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">TURNOS</h2>
            <button
              type="button"
              className="rounded-md border border-gray-500 px-3 py-2 text-sm font-bold hover:bg-gray-100"
              onClick={adicionarTurno}
            >
              + ADICIONAR TURNO
            </button>
          </div>
          <div className="space-y-2">
            {turnosNaOrdemDaEscala.map((turno) => (
              <div
                key={turno.id}
                className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <label className="flex flex-col gap-1 text-[10px] font-bold">
                  NOME DO TURNO
                  <input
                    className="min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                    value={turno.nome}
                    onChange={(event) => atualizarTurno(turno.id, { nome: event.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold">
                  ENTRADA
                  <input
                    className="min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                    type="time"
                    value={turno.entrada}
                    onChange={(event) => atualizarTurno(turno.id, { entrada: event.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold">
                  DESCANSO
                  <select
                    className="min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                    value={turno.descanso}
                    onChange={(event) =>
                      atualizarTurno(turno.id, { descanso: Number(event.target.value) as 40 | 60 })
                    }
                  >
                    <option value={40}>40 MIN</option>
                    <option value={60}>60 MIN</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold">
                  SAÍDA
                  <input
                    className="min-h-9 rounded-md border border-gray-300 bg-gray-100 px-2 text-sm text-black"
                    type="time"
                    value={turno.saida}
                    disabled
                    readOnly
                  />
                </label>
                <button
                  type="button"
                  aria-label={`REMOVER TURNO ${turno.nome}`}
                  className="self-end rounded-md border border-red-400 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40"
                  disabled={turnos.length <= 1}
                  onClick={() => solicitarRemocaoTurno(turno)}
                >
                  REMOVER
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="no-print space-y-3 rounded-xl border border-gray-300 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">FRENTISTAS</h2>
            <button
              type="button"
              className="rounded-md border border-gray-500 px-3 py-2 text-sm font-bold hover:bg-gray-100"
              onClick={adicionarFrentista}
            >
              + ADICIONAR FRENTISTA
            </button>
          </div>
          <div className="space-y-2">
            {frentistas.map((frentista, index) => (
              <div
                key={frentista.id}
                className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <label className="flex flex-col gap-1 text-[10px] font-bold">
                  NOME DO FRENTISTA {index + 1}
                  <input
                    className="min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                    value={frentista.nome}
                    placeholder={`FRENTISTA ${index + 1}`}
                    onChange={(event) =>
                      setFrentistas((atuais) =>
                        atuais.map((item) =>
                          item.id === frentista.id ? { ...item, nome: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold">
                  TURNO
                  <select
                    className="min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                    value={frentista.turnoId}
                    onChange={(event) =>
                      setFrentistas((atuais) =>
                        atuais.map((item) =>
                          item.id === frentista.id
                            ? { ...item, turnoId: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {turnos.map((turno) => (
                      <option key={turno.id} value={turno.id}>
                        {turno.nome} ({turno.entrada}-{turno.saida})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`REMOVER FRENTISTA ${index + 1}`}
                  className="self-end rounded-md border border-red-400 px-3 py-2 text-sm font-bold text-red-700"
                  onClick={() => solicitarRemocaoFrentista(frentista)}
                >
                  REMOVER
                </button>
              </div>
            ))}
          </div>
        </section>

        {tipoEscala === "livre" ? (
          <section className="no-print space-y-3 rounded-xl border border-gray-300 bg-white p-4">
            <h2 className="text-xl font-bold">ESCALA LIVRE - MANUAL</h2>
            <p className="text-sm">
              ESCOLHA UM STATUS E CLIQUE OU ARRASTE SOBRE OS DIAS PARA MARCAR A EQUIPE.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="STATUS PARA MARCAÇÃO">
              {STATUS_ESCALA_LIVRE.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={statusLivreSelecionado === status}
                  className={`rounded-md px-3 py-2 text-sm font-bold ring-offset-2 ${
                    COR_STATUS_LIVRE[status]
                  } ${statusLivreSelecionado === status ? "ring-2 ring-black" : ""}`}
                  onClick={() => setStatusLivreSelecionado(status)}
                >
                  {LABEL_STATUS_LIVRE[status]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-10 rounded-lg bg-[#7B2CBF] px-4 py-2 text-sm font-bold text-white hover:bg-[#6823a4]"
                onClick={salvarEscalaLivre}
              >
                SALVAR ESCALA LIVRE
              </button>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-red-500 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                onClick={limparMesEscalaLivre}
              >
                LIMPAR MÊS
              </button>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-gray-500 px-4 py-2 text-sm font-bold hover:bg-gray-100"
                onClick={copiarMesAnteriorEscalaLivre}
              >
                COPIAR ESCALA DO MÊS ANTERIOR
              </button>
            </div>
          </section>
        ) : null}
        <div className="no-print flex flex-wrap gap-2">
          {tipoEscala !== "livre" ? (
            <button
              type="button"
              className="min-h-12 flex-1 rounded-lg bg-[#7B2CBF] px-5 py-3 text-base font-bold text-white hover:bg-[#6823a4]"
              onClick={gerarEscala}
            >
              GERAR ESCALA
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-black bg-white px-4 py-3 text-sm font-bold text-black hover:bg-gray-100"
            onClick={() => setSolicitarImpressao(true)}
          >
            PDF / IMPRIMIR
          </button>
          <button
            type="button"
            className="rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
            onClick={compartilharWhatsApp}
          >
            WHATSAPP
          </button>
        </div>
        {statusCompartilhamento ? (
          <p className="no-print text-sm font-semibold">{statusCompartilhamento}</p>
        ) : null}
        {avisoEscala ? (
          <p role="alert" className="no-print text-sm font-semibold text-red-700">
            {avisoEscala}
          </p>
        ) : null}

        <div id="print-escala" className="space-y-3">
          <header className="space-y-2 border-b-2 border-black pb-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-lg font-bold">{company?.name}</h1>
              <p className="text-xs font-bold">CNPJ: {company?.cnpj}</p>
            </div>
            <h2 className="text-center text-base font-bold">ESCALA {referenciaMes}</h2>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[8px] font-semibold">
              <span>
                REGIME:{" "}
                {tipoEscala === "livre"
                  ? `LIVRE (MANUAL) - ${diasTrabalhadosDoMes} DIAS TRABALHADOS`
                  : tipoEscala}
              </span>
              <span className="flex flex-wrap gap-x-3">
                {turnos.map((turno) => (
                  <span key={turno.id}>
                    {turno.nome}: {turno.entrada}-{turno.saida} (DESCANSO {turno.descanso} MIN)
                  </span>
                ))}
              </span>
            </div>
          </header>

          {tipoEscala === "livre" ? (
            <section className="overflow-hidden rounded-lg border border-black">
              <h3 className="border-b border-black bg-gray-200 px-2 py-1.5 text-xs font-bold">
                ESCALA LIVRE - MANUAL
              </h3>
              <div className="overflow-x-auto print-table-wrap">
                <table className="w-full table-fixed border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="w-[110px] whitespace-nowrap border border-black bg-gray-100 px-[1px] py-[2px] text-left text-[11px]">
                        FRENTISTA
                      </th>
                      {dias.map((dia) => (
                        <th
                          key={dia}
                          className="min-w-[28px] border border-black bg-gray-100 text-[11px]"
                        >
                          {dia}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th className="h-[22px] w-[110px] border border-black bg-[#e5e7eb]" />
                      {dias.map((dia) => (
                        <th
                          key={dia}
                          className="h-[22px] min-w-[28px] border border-black bg-[#e5e7eb] text-[10px] font-bold text-[#374151]"
                        >
                          {getDiaSemana(dia)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {frentistas.map((frentista, index) => (
                      <tr key={frentista.id}>
                        <th className="h-7 w-[110px] border border-black px-[1px] text-left text-[11px]">
                          <span className="block truncate">
                            {frentista.nome.trim() || `FRENTISTA ${index + 1}`}
                          </span>
                        </th>
                        {dias.map((dia) => {
                          const status = escalaLivre[frentista.id]?.[dia];
                          return (
                            <td key={dia} className="h-7 min-w-[28px] border border-black p-[2px]">
                              <button
                                type="button"
                                aria-label={`${frentista.nome || `FRENTISTA ${index + 1}`}, DIA ${dia}: ${status ? LABEL_STATUS_LIVRE[status] : "SEM MARCAÇÃO"}`}
                                title={status ? LABEL_STATUS_LIVRE[status] : "SEM MARCAÇÃO"}
                                className={`h-6 w-full touch-none whitespace-nowrap text-[11px] font-bold ${
                                  status ? COR_STATUS_LIVRE[status] : "bg-white text-gray-500"
                                }`}
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  setArrastandoLivre(true);
                                  marcarStatusLivre(frentista.id, dia);
                                }}
                                onPointerEnter={() => {
                                  if (arrastandoLivre) marcarStatusLivre(frentista.id, dia);
                                }}
                              >
                                {status ? INICIAIS_STATUS_LIVRE[status] : "—"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <div className="space-y-4">
              {turnosNaOrdemDaEscala.map((turno) => {
                const equipeDoTurno = frentistas
                  .map((frentista, index) => ({ frentista, index }))
                  .filter(({ frentista }) => frentista.turnoId === turno.id);

                return (
                  <section
                    key={turno.id}
                    className="overflow-hidden rounded-lg border border-black"
                  >
                    <h3 className="border-b border-black bg-gray-200 px-2 py-1.5 text-xs font-bold">
                      {turno.nome} — {turno.entrada} às {turno.saida} · DESCANSO {turno.descanso}{" "}
                      MIN
                    </h3>
                    {equipeDoTurno.length > 0 ? (
                      <div className="overflow-hidden print-table-wrap">
                        <table className="w-full table-fixed border-collapse text-center">
                          <thead>
                            <tr>
                              <th className="w-[110px] whitespace-nowrap border border-black bg-gray-100 px-[1px] py-[2px] text-left text-[11px]">
                                FRENTISTA
                              </th>
                              {dias.map((dia) => (
                                <th
                                  key={dia}
                                  className="min-w-[28px] whitespace-nowrap border border-black bg-gray-100 px-[1px] py-[2px] text-center text-[11px]"
                                >
                                  {dia}
                                </th>
                              ))}
                            </tr>
                            <tr>
                              <th className="h-[22px] w-[110px] border border-black bg-[#e5e7eb] px-[1px] py-0 text-[10px] font-bold text-[#374151]" />
                              {dias.map((dia) => (
                                <th
                                  key={dia}
                                  className="h-[22px] min-w-[28px] whitespace-nowrap border border-black bg-[#e5e7eb] px-[1px] py-0 text-center text-[10px] font-bold text-[#374151]"
                                >
                                  {getDiaSemana(dia)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {equipeDoTurno.map(({ frentista, index }) => (
                              <tr key={frentista.id}>
                                <th className="h-7 w-[110px] whitespace-nowrap border border-black px-[1px] py-[2px] text-left text-[11px] font-semibold">
                                  <span className="block truncate">
                                    {frentista.nome.trim() || `FRENTISTA ${index + 1}`}
                                  </span>
                                </th>
                                {dias.map((dia) => {
                                  const status = escala[frentista.id]?.[dia] ?? "TRABALHO";
                                  return (
                                    <td
                                      key={dia}
                                      className="h-7 min-w-[28px] border border-black p-[2px] text-center text-[11px]"
                                    >
                                      <button
                                        type="button"
                                        aria-label={`${frentista.nome || `FRENTISTA ${index + 1}`}, DIA ${dia}: ${status}. CLIQUE PARA ALTERAR.`}
                                        title={status}
                                        className={`h-6 w-full whitespace-nowrap text-[11px] font-bold uppercase ${classeStatus(status)}`}
                                        onClick={() => ciclarStatus(frentista.id, dia)}
                                      >
                                        {INICIAIS_STATUS[status]}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="px-2 py-2 text-[9px] font-medium">
                        NENHUM FRENTISTA VINCULADO A ESTE TURNO
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-black pt-2 text-[8px] font-semibold">
            {tipoEscala === "livre" ? (
              STATUS_ESCALA_LIVRE.map((status) => (
                <span key={status}>
                  {INICIAIS_STATUS_LIVRE[status]} - {LABEL_STATUS_LIVRE[status]}
                </span>
              ))
            ) : (
              <>
                <span>T - TRABALHO</span>
                <span>F - FOLGA</span>
                <span>A - FALTA</span>
                <span>J - JUSTIFICADA</span>
              </>
            )}
          </footer>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm }
          body * { visibility: hidden }
          #print-escala, #print-escala * { visibility: visible }
          #print-escala { position: absolute; left:0; top:0; width:100% }
          .no-print { display:none !important }
          html, body { margin: 0 !important; background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact }
          .print-table-wrap { overflow: visible !important }
          #print-escala table { width: 100% !important; min-width: 0 !important; table-layout: fixed }
          #print-escala th:first-child { width: 110px }
        }
      `}</style>
      <ConfirmModal
        open={confirmacao !== null}
        titulo={confirmacao?.titulo ?? ""}
        onNao={() => setConfirmacao(null)}
        onSim={() => {
          confirmacao?.onSim();
          setConfirmacao(null);
        }}
      />
    </AppShell>
  );
}
