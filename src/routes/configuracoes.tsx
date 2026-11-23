import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, fmtL, todayISO, useAppState, type Company, type Tank } from "@/lib/store";
import { useSubscription } from "@/hooks/useSubscription";
import {
  BIRTHDAY_NOTIFICATIONS_KEY,
  META_TYPE_KEY,
  readTipoMeta,
  writeTipoMeta,
  type TipoMetaApuracao,
} from "@/lib/metas";
import { FISCAL_WHATSAPP_KEY } from "@/lib/fiscalizacao";
import {
  buildOwnerWhatsAppMessage,
  DEFAULT_OWNER_WHATSAPP_CONFIG,
  OWNER_WHATSAPP_ITEMS,
  ownerWhatsAppUrl,
  readOwnerWhatsAppConfig,
  writeOwnerWhatsAppConfig,
  type OwnerWhatsAppConfig,
} from "@/lib/whatsapp-dono";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações dos Tanques — Posto 10" },
      {
        name: "description",
        content:
          "Configure cor, nome do combustível e capacidade de cada tanque, além da quantidade de turnos do posto.",
      },
      { property: "og:title", content: "Configurações dos Tanques — Posto 10" },
      {
        property: "og:description",
        content: "Cores, nomes e capacidades dos tanques e turnos do posto.",
      },
    ],
  }),
  component: ConfigPage,
});

const PALETTE = [
  "#e0b428",
  "#e2632c",
  "#3fa06a",
  "#3b82c4",
  "#a855f7",
  "#d94b5a",
  "#0f766e",
  "#94a3b8",
];

function ConfigPage() {
  const state = useAppState();
  const subscription = useSubscription();
  const [editing, setEditing] = useState<string | null>(null);
  const [fontSizeLevel, setFontSizeLevel] = useState(0);
  const [tipoMeta, setTipoMeta] = useState<TipoMetaApuracao>("individual");
  const [notificacoesAniversario, setNotificacoesAniversario] = useState(false);
  const [whatsAppFiscalizacao, setWhatsAppFiscalizacao] = useState("");
  const [ownerWhatsAppConfig, setOwnerWhatsAppConfig] = useState<OwnerWhatsAppConfig>(
    DEFAULT_OWNER_WHATSAPP_CONFIG,
  );
  const [ownerWhatsAppError, setOwnerWhatsAppError] = useState("");
  const [ownerWhatsAppSaved, setOwnerWhatsAppSaved] = useState("");
  const company = state.company ?? {
    name: "",
    address: "",
    number: "",
    bairro: "",
    city: "",
    state: "",
    bandeira: "",
    cnpj: "",
    ie: "",
    phone: "",
  };

  useEffect(() => {
    const savedLevel = Number(window.localStorage.getItem("posto-font-size-level") ?? 0);
    const level = Math.min(3, Math.max(0, savedLevel));
    setFontSizeLevel(level);
    setTipoMeta(readTipoMeta());
    if (!window.localStorage.getItem(META_TYPE_KEY)) writeTipoMeta("individual");
    setNotificacoesAniversario(window.localStorage.getItem(BIRTHDAY_NOTIFICATIONS_KEY) === "true");
    setWhatsAppFiscalizacao(window.localStorage.getItem(FISCAL_WHATSAPP_KEY) ?? "");
    try {
      setOwnerWhatsAppConfig(readOwnerWhatsAppConfig());
    } catch (error) {
      setOwnerWhatsAppError(
        error instanceof Error ? error.message : "ERRO AO LER CONFIGURAÇÃO DO WHATSAPP.",
      );
    }
    document.documentElement.style.fontSize = `${16 + level}px`;
  }, []);

  const formatOwnerPhone = (raw: string) => {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("55")) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    const area = digits.slice(0, 2);
    const subscriber = digits.slice(2);
    if (!area) return "+55";
    if (!subscriber) return `+55 (${area}`;
    if (subscriber.length <= 5) return `+55 (${area}) ${subscriber}`;
    return `+55 (${area}) ${subscriber.slice(0, subscriber.length - 4)}-${subscriber.slice(-4)}`;
  };

  const saveOwnerWhatsApp = () => {
    try {
      writeOwnerWhatsAppConfig(ownerWhatsAppConfig);
      setOwnerWhatsAppError("");
      setOwnerWhatsAppSaved("CONFIGURAÇÃO DO WHATSAPP DO PROPRIETÁRIO SALVA.");
    } catch (error) {
      setOwnerWhatsAppSaved("");
      setOwnerWhatsAppError(
        error instanceof Error ? error.message : "NÃO FOI POSSÍVEL SALVAR A CONFIGURAÇÃO.",
      );
    }
  };

  const testOwnerWhatsApp = () => {
    const digits = ownerWhatsAppConfig.numero.replace(/\D/g, "");
    if (digits.length < 12) {
      setOwnerWhatsAppError("INFORME WHATSAPP DO PROPRIETÁRIO COM DDD E CÓDIGO DO PAÍS.");
      return;
    }
    try {
      const message = buildOwnerWhatsAppMessage(state, ownerWhatsAppConfig, todayISO());
      const popup = window.open(ownerWhatsAppUrl(ownerWhatsAppConfig.numero, message), "_blank");
      if (!popup) {
        setOwnerWhatsAppError(
          "O NAVEGADOR BLOQUEOU A ABERTURA. PERMITA POP-UPS E TENTE NOVAMENTE.",
        );
        return;
      }
      popup.opener = null;
      setOwnerWhatsAppError("");
      setOwnerWhatsAppSaved("WHATSAPP ABERTO COM A MENSAGEM DE TESTE. REVISE E ENVIE NO APP.");
    } catch (error) {
      console.error("NÃO FOI POSSÍVEL PREPARAR A MENSAGEM DE TESTE.", error);
      setOwnerWhatsAppError(
        error instanceof Error ? error.message : "NÃO FOI POSSÍVEL PREPARAR A MENSAGEM.",
      );
    }
  };

  const changeFontSize = (level: number) => {
    const safeLevel = Math.min(3, Math.max(0, level));
    window.localStorage.setItem("posto-font-size-level", String(safeLevel));
    document.documentElement.style.fontSize = `${16 + safeLevel}px`;
    setFontSizeLevel(safeLevel);
  };

  return (
    <AppShell title="Ajustes" subtitle="Dados do posto, tanques e turnos">
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg text-foreground">Cadastro do posto</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Esses dados aparecem no topo do aplicativo e nos relatórios PDF.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CompanyField label="Nome do posto" value={company.name} field="name" />
          <CompanyField label="Bandeira" value={company.bandeira} field="bandeira" />
          <CompanyField label="CNPJ" value={company.cnpj} field="cnpj" />
          <CompanyField label="I.E." value={company.ie} field="ie" />
          <CompanyField label="Endereço" value={company.address} field="address" />
          <CompanyField label="Número" value={company.number} field="number" />
          <CompanyField label="Bairro" value={company.bairro} field="bairro" />
          <CompanyField label="Cidade" value={company.city} field="city" />
          <CompanyField label="Estado" value={company.state} field="state" />
          <CompanyField label="Telefone" value={company.phone} field="phone" />
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Tamanho das letras
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Ajuste a leitura em todas as telas do aplicativo.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Tamanho das letras">
          {[0, 1, 2, 3].map((level) => (
            <Button
              key={level}
              type="button"
              variant={fontSizeLevel === level ? "default" : "outline"}
              aria-pressed={fontSizeLevel === level}
              onClick={() => changeFontSize(level)}
            >
              {level === 0 ? "Padrão" : `+${level}`}
            </Button>
          ))}
        </div>
      </section>

      {!subscription.isAdmin ? <PasswordSection onChange={subscription.changePassword} /> : null}
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg text-foreground">Tipo de Meta</h2>
        <div className="mt-3 space-y-3">
          {[
            { value: "individual", label: "Meta Individual por Frentista (cada um tem sua meta)" },
            { value: "equipe", label: "Meta por Equipe (meta única dividida para todos)" },
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 text-sm text-foreground">
              <input
                type="radio"
                name="tipo-meta"
                value={option.value}
                checked={tipoMeta === option.value}
                onChange={() => {
                  const value = option.value as TipoMetaApuracao;
                  setTipoMeta(value);
                  writeTipoMeta(value);
                }}
                className="mt-0.5 accent-[#7c3aed]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg text-foreground">WHATSAPP DO PROPRIETÁRIO</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ENVIO AGENDADO ABRE O WHATSAPP PARA REVISÃO. POR SEGURANÇA DO NAVEGADOR E DO WHATSAPP, O
          ENVIO FINAL PRECISA SER CONFIRMADO NO APLICATIVO.
        </p>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm font-bold text-foreground">
            ATIVAR ENVIO AUTOMÁTICO?
            <input
              type="checkbox"
              checked={ownerWhatsAppConfig.ativo}
              onChange={(event) => {
                if (
                  event.target.checked &&
                  ownerWhatsAppConfig.numero.replace(/\D/g, "").length < 12
                ) {
                  setOwnerWhatsAppError("INFORME WHATSAPP DO PROPRIETÁRIO.");
                  return;
                }
                setOwnerWhatsAppConfig((current) => ({ ...current, ativo: event.target.checked }));
                setOwnerWhatsAppError("");
                setOwnerWhatsAppSaved("");
              }}
              className="size-5 accent-[#b7791f]"
            />
          </label>
          <div>
            <Label htmlFor="owner-whatsapp">WHATSAPP DO PROPRIETÁRIO</Label>
            <Input
              id="owner-whatsapp"
              className="mt-1"
              type="tel"
              inputMode="tel"
              placeholder="+55 (19) 98765-4321"
              value={ownerWhatsAppConfig.numero}
              onChange={(event) => {
                setOwnerWhatsAppConfig((current) => ({
                  ...current,
                  numero: formatOwnerPhone(event.target.value),
                }));
                setOwnerWhatsAppError("");
                setOwnerWhatsAppSaved("");
              }}
            />
          </div>
          <div>
            <Label htmlFor="owner-whatsapp-time">HORÁRIO DE ENVIO</Label>
            <Input
              id="owner-whatsapp-time"
              className="mt-1 max-w-48"
              type="time"
              value={ownerWhatsAppConfig.horario}
              onChange={(event) => {
                setOwnerWhatsAppConfig((current) => ({ ...current, horario: event.target.value }));
                setOwnerWhatsAppSaved("");
              }}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase text-foreground">
              O QUE ENVIAR
            </legend>
            <label className="mb-2 flex items-start gap-2 text-sm font-semibold text-foreground">
              <input type="checkbox" checked disabled className="mt-0.5 accent-[#b7791f]" />
              GALONAGEM TOTAL VENDIDA NO DIA (SOMA DE TODOS OS TANQUES) — OBRIGATÓRIO
            </label>
            <div className="space-y-2">
              {OWNER_WHATSAPP_ITEMS.map(({ key, label }) => (
                <label key={key} className="flex items-start gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={ownerWhatsAppConfig.itens[key]}
                    onChange={(event) => {
                      setOwnerWhatsAppConfig((current) => ({
                        ...current,
                        itens: { ...current.itens, [key]: event.target.checked },
                      }));
                      setOwnerWhatsAppSaved("");
                    }}
                    className="mt-0.5 accent-[#b7791f]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-[#b7791f] text-white hover:bg-[#9a6419]"
              onClick={saveOwnerWhatsApp}
            >
              SALVAR CONFIGURAÇÃO
            </Button>
            <Button variant="outline" onClick={testOwnerWhatsApp}>
              <Send className="size-4" /> TESTAR ENVIO AGORA
            </Button>
          </div>
          {ownerWhatsAppError ? (
            <p role="alert" className="text-sm font-bold text-destructive">
              {ownerWhatsAppError}
            </p>
          ) : null}
          {ownerWhatsAppSaved ? (
            <p role="status" className="text-sm font-semibold text-emerald-700">
              {ownerWhatsAppSaved}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <Label htmlFor="fiscal-whatsapp" className="text-xs uppercase tracking-widest">
          NÚMERO WHATSAPP PARA ALERTAS FISCALIZAÇÃO
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          INFORME DDD E NÚMERO. O APLICATIVO ABRIRÁ O WHATSAPP COM A MENSAGEM PRONTA PARA VOCÊ
          REVISAR E ENVIAR.
        </p>
        <Input
          id="fiscal-whatsapp"
          className="mt-3"
          type="tel"
          inputMode="numeric"
          placeholder="EX.: 11987654321"
          value={whatsAppFiscalizacao}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, "").slice(0, 13);
            setWhatsAppFiscalizacao(value);
            window.localStorage.setItem(FISCAL_WHATSAPP_KEY, value);
          }}
        />
      </section>
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <label className="flex items-center justify-between gap-4 text-sm font-medium text-foreground">
          <span>
            Notificações de aniversário
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Avisar às 08:00 quando houver aniversariantes.
            </span>
          </span>
          <input
            type="checkbox"
            checked={notificacoesAniversario}
            onChange={(event) => {
              const enabled = event.target.checked;
              setNotificacoesAniversario(enabled);
              window.localStorage.setItem(BIRTHDAY_NOTIFICATIONS_KEY, String(enabled));
              window.dispatchEvent(
                new CustomEvent(`posto10-storage:${BIRTHDAY_NOTIFICATIONS_KEY}`),
              );
            }}
            className="size-5 accent-[#7c3aed]"
          />
        </label>
      </section>
      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Quantidade de turnos
        </Label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Button
              key={n}
              variant={state.shifts === n ? "default" : "outline"}
              className="flex-1"
              onClick={() => actions.setShifts(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </section>

      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Tanques</h2>
        <Button
          size="sm"
          onClick={() => {
            const color = PALETTE[state.tanks.length % PALETTE.length] as string;
            actions.addTank({ name: "Novo combustível", color, capacity: 10000 });
          }}
        >
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Use as setas para definir a sequência: o Tanque 1 aparece primeiro em todas as telas.
      </p>

      <div className="space-y-3">
        {state.tanks.map((tank, i) =>
          editing === tank.id ? (
            <TankEditor key={tank.id} tank={tank} index={i} onDone={() => setEditing(null)} />
          ) : (
            <div
              key={tank.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex flex-col">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-7"
                  disabled={i === 0}
                  aria-label={`Mover ${tank.name} para cima`}
                  onClick={() => actions.moveTank(tank.id, -1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-7"
                  disabled={i === state.tanks.length - 1}
                  aria-label={`Mover ${tank.name} para baixo`}
                  onClick={() => actions.moveTank(tank.id, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg font-display text-base text-black/80"
                style={{ backgroundColor: tank.color }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  Tanque {i + 1} · {tank.name}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  Capacidade {fmtL(tank.capacity)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Editar ${tank.name}`}
                onClick={() => setEditing(tank.id)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Excluir ${tank.name}`}
                onClick={() => actions.removeTank(tank.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ),
        )}
      </div>
    </AppShell>
  );
}

function PasswordSection({ onChange }: { onChange: (current: string, next: string) => boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4">
      <h2 className="font-display text-lg text-foreground">Alterar senha</h2>
      <p className="mt-1 text-xs text-muted-foreground">A senha inicial do seu plano é posto10.</p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(
            onChange(current, next)
              ? "Senha alterada."
              : "Senha atual inválida ou nova senha vazia.",
          );
          setCurrent("");
          setNext("");
        }}
      >
        <Input
          type="password"
          placeholder="Senha atual"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Input
          type="password"
          placeholder="Nova senha"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <div className="sm:col-span-2">
          <Button type="submit">Salvar nova senha</Button>
          {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}

function CompanyField({
  label,
  value,
  field,
}: {
  label: string;
  value: string;
  field: keyof Company;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="mt-1"
        value={value}
        onChange={(event) => actions.setCompany({ [field]: event.target.value })}
      />
    </div>
  );
}

function TankEditor({ tank, index, onDone }: { tank: Tank; index: number; onDone: () => void }) {
  const [name, setName] = useState(tank.name);
  const [capacity, setCapacity] = useState(String(tank.capacity));
  const [color, setColor] = useState(tank.color);

  return (
    <div className="space-y-3 rounded-xl border border-primary/50 bg-card p-4">
      <div>
        <Label className="text-xs text-muted-foreground">
          Nome do combustível (Tanque {index + 1})
        </Label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Capacidade (litros)</Label>
        <Input
          className="mt-1"
          inputMode="decimal"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Cor do tanque</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => setColor(c)}
              className={`size-8 rounded-lg border-2 ${
                color === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            aria-label="Cor personalizada"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-8 rounded-lg border border-border bg-transparent"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          onClick={() => {
            actions.updateTank(tank.id, {
              name: name.trim() || tank.name,
              color,
              capacity: Number(capacity.replace(",", ".")) || tank.capacity,
            });
            onDone();
          }}
        >
          <Check className="size-4" /> Salvar
        </Button>
        <Button variant="outline" onClick={onDone}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
