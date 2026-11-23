import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ensureDeveloperDemoAccounts,
  getLocalAccounts,
  updateLocalBilling,
  type BillingStatus,
  type LocalAccount,
  type LocalPaymentRecord,
} from "@/lib/local-auth";
import { saasMonthlyEquivalent, saasPlanPrice } from "@/lib/saas-checkout";

export const Route = createFileRoute("/admin-dev")({
  head: () => ({ meta: [{ title: "Admin Desenvolvedor — Posto 10" }] }),
  component: DeveloperAdminPage,
});

type Customer = LocalAccount;

function isCustomer(account: LocalAccount): boolean {
  return (
    account.perfil === "PROPRIETARIO" &&
    Boolean(account.plano || account.postoNome || account.tipo_acesso === "TRIAL_48H")
  );
}

function money(value: number | null | undefined) {
  return value == null
    ? "—"
    : `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function customerStatus(account: Customer): BillingStatus {
  if (
    account.plano === "TRIAL_48H" &&
    (account.status === "EXPIRADO" ||
      Boolean(account.trial_fim && Date.now() > new Date(account.trial_fim).getTime()))
  ) {
    return "ATRASADO";
  }
  if (account.billingStatus) return account.billingStatus;
  if (account.status === "EXPIRADO") return "ATRASADO";
  return account.tipo_acesso === "TRIAL_48H" ? "TRIAL" : "ATIVO";
}

function DeveloperAdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [dueFilter, setDueFilter] = useState("TODOS");
  const [notice, setNotice] = useState("");

  const refresh = () => {
    setCustomers(getLocalAccounts().filter(isCustomer));
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/admin-dev/session")
      .then((response) => {
        if (!active) return;
        if (response.ok) {
          ensureDeveloperDemoAccounts();
          refresh();
          setAuthenticated(true);
        }
      })
      .catch(() => {
        if (active) setLoginError("NÃO FOI POSSÍVEL VALIDAR A SESSÃO DO ADMINISTRADOR.");
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    void fetch("/api/admin-dev/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error ?? "E-MAIL OU SENHA INVÁLIDOS.");
        }
        ensureDeveloperDemoAccounts();
        refresh();
        setAuthenticated(true);
      })
      .catch((caught: unknown) => {
        setLoginError(caught instanceof Error ? caught.message : "FALHA NO LOGIN.");
      });
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const sevenDays = new Date(now);
    sevenDays.setDate(sevenDays.getDate() + 7);
    return customers.filter((customer) => {
      const currentStatus = customerStatus(customer);
      const type = customer.plano ?? "TRIAL_48H";
      const due = customer.dataProximoVencimento ? new Date(customer.dataProximoVencimento) : null;
      const query = search.trim().toLocaleLowerCase("pt-BR");
      const matchesSearch =
        !query ||
        (customer.postoNome ?? "").toLocaleLowerCase("pt-BR").includes(query) ||
        customer.email.toLocaleLowerCase("pt-BR").includes(query);
      const matchesDue =
        dueFilter === "TODOS" ||
        (dueFilter === "HOJE" && due?.toDateString() === now.toDateString()) ||
        (dueFilter === "7_DIAS" && Boolean(due && due >= now && due <= sevenDays)) ||
        (dueFilter === "VENCIDOS" && Boolean(due && due < now));
      return (
        matchesSearch &&
        (statusFilter === "TODOS" || currentStatus === statusFilter) &&
        (typeFilter === "TODOS" || type === typeFilter) &&
        matchesDue
      );
    });
  }, [customers, dueFilter, search, statusFilter, typeFilter]);

  const metrics = useMemo(() => {
    const active = customers.filter((customer) => customerStatus(customer) === "ATIVO").length;
    const trials = customers.filter((customer) => customerStatus(customer) === "TRIAL").length;
    const late = customers.filter((customer) => customerStatus(customer) === "ATRASADO").length;
    const canceled = customers.filter(
      (customer) => customerStatus(customer) === "CANCELADO",
    ).length;
    const revenue = customers.reduce((sum, customer) => {
      if (customerStatus(customer) !== "ATIVO") return sum;
      if (customer.plano !== "ANUAL" && customer.plano !== "MENSAL") return sum;
      return sum + saasMonthlyEquivalent(customer.plano);
    }, 0);
    return { active, trials, late, canceled, revenue };
  }, [customers]);

  const monthlySeries = useMemo(() => {
    const months = new Map<string, number>();
    for (const customer of customers) {
      const month = customer.criado_em.slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + 1);
    }
    return [...months].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [customers]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  const runAction = (customer: Customer, action: "block" | "unblock" | "extend") => {
    if (action === "extend") {
      const currentEnd = customer.trial_fim ? new Date(customer.trial_fim).getTime() : Date.now();
      const nextEnd = new Date(
        Math.max(Date.now(), currentEnd) + 48 * 60 * 60 * 1000,
      ).toISOString();
      updateLocalBilling(customer.id, {
        plano: "TRIAL_48H",
        tipo_acesso: "TRIAL_48H",
        billingStatus: "TRIAL",
        trial_fim: nextEnd,
        dataProximoVencimento: nextEnd,
        status: "ATIVO",
      });
    } else {
      updateLocalBilling(customer.id, {
        billingStatus:
          action === "block" ? "BLOQUEADO" : customer.plano === "TRIAL_48H" ? "TRIAL" : "ATIVO",
      });
    }
    refresh();
  };

  const exportCsv = () => {
    const columns = [
      "POSTO",
      "PROPRIETARIO",
      "EMAIL",
      "TELEFONE",
      "TIPO_ASSINATURA",
      "STATUS",
      "VENCIMENTO",
      "ULTIMO_PAGAMENTO",
      "FORMA",
      "VALOR",
      "LGPD_ACEITO",
      "LGPD_DATA_HORA",
      "ULTIMO_LOGIN",
    ];
    const rows = customers.map((customer) => [
      customer.postoNome ?? "",
      customer.nome,
      customer.email,
      customer.telefone ?? "",
      customer.plano ?? "TRIAL_48H",
      customerStatus(customer),
      customer.dataProximoVencimento ?? "",
      customer.ultimoPagamento ?? "",
      customer.formaPagamento ?? "",
      customer.plano === "ANUAL" || customer.plano === "MENSAL"
        ? saasPlanPrice(customer.plano)
        : "",
      customer.lgpd_de_acordo ? "SIM" : "NÃO",
      customer.lgpd_data_hora ?? "",
      customer.ultimoLogin ?? "",
    ]);
    const csv = [columns, ...rows]
      .map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "posto10-clientes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const viewAsOwner = (customer: Customer) => {
    const session = {
      isAdmin: false,
      username: customer.email,
      accountId: customer.id,
      role: "PROPRIETARIO",
    };
    window.localStorage.setItem("posto-auth-session", JSON.stringify(session));
    window.open("/", "_blank", "noopener,noreferrer");
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        VALIDANDO ACESSO...
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
        <form onSubmit={login} className="w-full max-w-md space-y-4 rounded-3xl bg-slate-900 p-7">
          <p className="font-display text-3xl text-amber-300">ADMIN DESENVOLVEDOR</p>
          <Input
            type="email"
            placeholder="E-MAIL"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="SENHA"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button className="w-full" type="submit">
            ENTRAR
          </Button>
          {loginError ? (
            <p role="alert" className="text-sm font-bold text-red-300">
              {loginError}
            </p>
          ) : null}
          <p className="text-xs text-amber-200">
            O PAINEL CONSULTA APENAS OS CADASTROS LOCAIS DESTE NAVEGADOR. CONFIGURE CREDENCIAIS
            FORTES NO SERVIDOR ANTES DE PUBLICAR.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-primary">POSTO 10</p>
          <h1 className="font-display text-4xl">PAINEL DO DESENVOLVEDOR</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            EXPORTAR CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void fetch("/api/admin-dev/logout", { method: "POST" }).finally(() =>
                setAuthenticated(false),
              );
            }}
          >
            SAIR
          </Button>
        </div>
      </header>
      <p className="mx-auto mt-4 max-w-7xl rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-950">
        MODO DEMO LOCAL — OS DADOS SÃO DESTE NAVEGADOR. NÃO HÁ BANCO CENTRAL, COBRANÇA ASAAS OU
        E-MAIL AUTOMÁTICO ATIVO.
      </p>
      <section className="mx-auto mt-5 grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["POSTOS ATIVOS", metrics.active],
          ["EM TRIAL 48H", metrics.trials],
          ["ATRASADOS", metrics.late],
          ["CANCELADOS", metrics.canceled],
          ["RECEITA MENSAL PREVISTA", money(metrics.revenue)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-extrabold">{value}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto mt-5 max-w-7xl rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl">ASSINATURAS POR MÊS</h2>
        <div className="mt-4 flex h-36 items-end gap-3 border-b border-border">
          {monthlySeries.map(([month, count]) => (
            <div key={month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold">{count}</span>
              <div
                className="w-full max-w-12 rounded-t bg-primary"
                style={{
                  height: `${Math.max(8, (count / Math.max(1, ...monthlySeries.map(([, value]) => value))) * 100)}%`,
                }}
              />
              <span className="text-[10px]">{month}</span>
            </div>
          ))}
          {monthlySeries.length === 0 ? (
            <p className="pb-4 text-sm text-muted-foreground">SEM DADOS.</p>
          ) : null}
        </div>
      </section>
      <section className="mx-auto mt-5 max-w-7xl rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl">CLIENTES</h2>
        <div className="my-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="BUSCAR POSTO OU E-MAIL"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {["TODOS", "ATIVO", "TRIAL", "ATRASADO", "CANCELADO", "BLOQUEADO"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            {["TODOS", "TRIAL_48H", "MENSAL", "ANUAL"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
          >
            <option value="TODOS">TODOS OS VENCIMENTOS</option>
            <option value="HOJE">VENCE HOJE</option>
            <option value="7_DIAS">VENCE EM 7 DIAS</option>
            <option value="VENCIDOS">VENCIDOS</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1450px] text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] text-muted-foreground">
                {[
                  "POSTO",
                  "PROPRIETÁRIO",
                  "E-MAIL",
                  "TELEFONE",
                  "TIPO ASSINATURA",
                  "STATUS",
                  "VENCIMENTO",
                  "ÚLTIMO PAGAMENTO",
                  "FORMA",
                  "VALOR",
                  "LGPD",
                  "ÚLTIMO LOGIN",
                  "AÇÕES",
                ].map((column) => (
                  <th key={column} className="p-2">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-b align-top">
                  <td className="p-2">
                    <button
                      className="font-bold underline"
                      onClick={() => setSelectedId(customer.id)}
                    >
                      {customer.postoNome ?? "POSTO SEM NOME"}
                    </button>
                  </td>
                  <td className="p-2">{customer.nome}</td>
                  <td className="p-2">{customer.email}</td>
                  <td className="p-2">{customer.telefone ?? "—"}</td>
                  <td className="p-2">{customer.plano ?? "TRIAL_48H"}</td>
                  <td className="p-2">{customerStatus(customer)}</td>
                  <td className="p-2">{dateTime(customer.dataProximoVencimento)}</td>
                  <td className="p-2">{dateTime(customer.ultimoPagamento)}</td>
                  <td className="p-2">{customer.formaPagamento ?? "—"}</td>
                  <td className="p-2">
                    {customer.plano === "ANUAL" || customer.plano === "MENSAL"
                      ? money(saasPlanPrice(customer.plano))
                      : "—"}
                  </td>
                  <td className="p-2">
                    {customer.lgpd_de_acordo
                      ? `ACEITO · ${dateTime(customer.lgpd_data_hora)}`
                      : "PENDENTE"}
                  </td>
                  <td className="p-2">{dateTime(customer.ultimoLogin)}</td>
                  <td className="space-y-1 p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runAction(customer, "block")}
                      >
                        BLOQUEAR
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runAction(customer, "unblock")}
                      >
                        DESBLOQUEAR
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runAction(customer, "extend")}
                      >
                        PRORROGAR TRIAL +48H
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const paymentUrl = `${window.location.origin}/planos`;
                          if (!navigator.clipboard) {
                            setNotice(
                              "NÃO FOI POSSÍVEL COPIAR. ENVIE O LINK MANUALMENTE: " + paymentUrl,
                            );
                            return;
                          }
                          void navigator.clipboard
                            .writeText(paymentUrl)
                            .then(() => setNotice("LINK DE PLANOS COPIADO."))
                            .catch(() => setNotice("NÃO FOI POSSÍVEL COPIAR O LINK DE PAGAMENTO."));
                        }}
                      >
                        COPIAR LINK PAGAMENTO
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => viewAsOwner(customer)}>
                        VER COMO PROPRIETÁRIO
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={13}>
                    NENHUM CLIENTE PARA OS FILTROS SELECIONADOS.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {notice ? (
          <p role="status" className="mt-3 text-sm font-bold text-green-700">
            {notice}
          </p>
        ) : null}
      </section>
      {selected ? (
        <CustomerDetails customer={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </main>
  );
}

function CustomerDetails({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const payments: LocalPaymentRecord[] = customer.pagamentos ?? [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 text-foreground">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">{customer.postoNome ?? customer.nome}</h2>
            <p>
              {customer.email} · {customer.nome}
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            FECHAR
          </Button>
        </div>
        <h3 className="mt-5 font-bold">HISTÓRICO DE PAGAMENTOS</h3>
        {payments.length ? (
          payments.map((payment, index) => (
            <p key={`${payment.date}-${index}`} className="mt-1 text-sm">
              {dateTime(payment.date)} · {payment.method} · {money(payment.amount)} ·{" "}
              {payment.status}
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">SEM PAGAMENTOS REGISTRADOS.</p>
        )}
        <h3 className="mt-5 font-bold">HISTÓRICO LGPD</h3>
        <p className="text-sm">
          LEITURA: {dateTime(customer.lgpd_data_hora_leitura)} · DE ACORDO:{" "}
          {dateTime(customer.lgpd_data_hora)} · VERSÃO: {customer.lgpd_versao ?? "—"}
        </p>
        <h3 className="mt-5 font-bold">HISTÓRICO DE ACESSOS</h3>
        {(customer.historicoAcessos ?? [])
          .slice(-10)
          .reverse()
          .map((entry, index) => (
            <p key={`${entry}-${index}`} className="text-sm">
              {dateTime(entry)}
            </p>
          ))}
        {!customer.historicoAcessos?.length ? (
          <p className="text-sm text-muted-foreground">SEM ACESSOS REGISTRADOS.</p>
        ) : null}
        <h3 className="mt-5 font-bold">MIX DO MÊS DO POSTO</h3>
        <p className="text-sm text-muted-foreground">
          NÃO DISPONÍVEL NO MODO LOCAL: DADOS OPERACIONAIS NÃO SÃO COMPARTILHADOS ENTRE NAVEGADORES.
        </p>
      </section>
    </div>
  );
}
