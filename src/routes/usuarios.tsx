import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSubscription } from "@/hooks/useSubscription";
import {
  defaultManagedPermissions,
  OWNER_MENU_PERMISSIONS,
  type ManagedPermissions,
  type ManagedUserInput,
  type PublicLocalAccount,
} from "@/lib/local-auth";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Posto 10" }] }),
  component: UsersPage,
});

const EMPTY_USER: ManagedUserInput = {
  nome: "",
  email: "",
  perfil: "GERENTE",
  senha: "",
  permissoes: defaultManagedPermissions("GERENTE"),
};

function UsersPage() {
  const subscription = useSubscription();
  const canManageUsers = subscription.role === "PROPRIETARIO";
  const [form, setForm] = useState<ManagedUserInput>(EMPTY_USER);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, ManagedPermissions>>({});

  const editUser = (user: PublicLocalAccount) => {
    setEditingId(user.id);
    setForm({
      nome: user.nome,
      email: user.email,
      perfil: user.perfil as ManagedUserInput["perfil"],
      senha: "",
      permissoes: user.permissoes,
    });
    setMessage(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_USER);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = editingId
      ? subscription.updateManagedUser(editingId, form)
      : subscription.createManagedUser(form);
    if (!saved) return;
    setMessage(editingId ? "USUÁRIO ATUALIZADO." : "USUÁRIO CADASTRADO.");
    resetForm();
  };

  return (
    <AppShell title="USUÁRIOS DO POSTO" subtitle="ACESSO E EQUIPE">
      <div className="space-y-5">
        {canManageUsers ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-xl font-bold">
              {editingId ? "EDITAR USUÁRIO" : "CADASTRAR USUÁRIO"}
            </h2>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
              <Input
                placeholder="NOME"
                aria-label="Nome"
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                required
              />
              <Input
                type="email"
                placeholder="E-MAIL"
                aria-label="E-mail"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                aria-label="Perfil"
                value={form.perfil}
                onChange={(event) =>
                  setForm({
                    ...form,
                    perfil: event.target.value as ManagedUserInput["perfil"],
                    permissoes: defaultManagedPermissions(
                      event.target.value as ManagedUserInput["perfil"],
                    ),
                  })
                }
              >
                <option value="GERENTE">GERENTE</option>
                <option value="FRENTISTA">FRENTISTA</option>
                <option value="TROCA-OLEO">TROCA-ÓLEO</option>
              </select>
              <Input
                type="password"
                placeholder={editingId ? "NOVA SENHA (OPCIONAL)" : "SENHA (MÍNIMO 6 CARACTERES)"}
                aria-label={editingId ? "Nova senha" : "Senha"}
                value={form.senha}
                onChange={(event) => setForm({ ...form, senha: event.target.value })}
                minLength={form.senha ? 6 : undefined}
                required={!editingId}
              />
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit">{editingId ? "SALVAR ALTERAÇÕES" : "CADASTRAR"}</Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    CANCELAR
                  </Button>
                ) : null}
              </div>
            </form>
            {subscription.authError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {subscription.authError}
              </p>
            ) : null}
            {message ? (
              <p role="status" className="mt-3 text-sm font-semibold text-green-700">
                {message}
              </p>
            ) : null}
          </section>
        ) : null}
        {!canManageUsers ? (
          <div
            role="status"
            className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-center font-bold text-amber-950"
          >
            PERFIL SOMENTE LEITURA
          </div>
        ) : null}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-xl font-bold">USUÁRIOS DESTE POSTO</h2>
          {subscription.managedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">NENHUM USUÁRIO CADASTRADO.</p>
          ) : (
            <ul className="space-y-3">
              {subscription.managedUsers.map((user) =>
                (() => {
                  const permissions = permissionDrafts[user.id] ?? user.permissoes;
                  return (
                    <li key={user.id} className="space-y-3 rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-bold">{user.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email} ·{" "}
                            {user.perfil === "TROCA-OLEO" ? "TROCA-ÓLEO" : user.perfil}
                          </p>
                        </div>
                        {canManageUsers ? (
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => editUser(user)}>
                              EDITAR
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => {
                                if (!window.confirm(`EXCLUIR ${user.nome}?`)) return;
                                if (subscription.deleteManagedUser(user.id))
                                  setMessage("USUÁRIO EXCLUÍDO.");
                              }}
                            >
                              EXCLUIR
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <legend className="mb-2 text-sm font-bold">MENUS LIBERADOS</legend>
                        {OWNER_MENU_PERMISSIONS.map(({ path, label }) => (
                          <label key={path} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={permissions[path] === true}
                              disabled={!canManageUsers}
                              onChange={(event) =>
                                setPermissionDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...permissions,
                                    [path]: event.target.checked,
                                  },
                                }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                      {canManageUsers ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (subscription.updateUserPermissions(user.id, permissions)) {
                              setPermissionDrafts((current) => {
                                const next = { ...current };
                                delete next[user.id];
                                return next;
                              });
                              setMessage(`PERMISSÕES DE ${user.nome} SALVAS.`);
                            }
                          }}
                        >
                          SALVAR PERMISSÕES
                        </Button>
                      ) : null}
                    </li>
                  );
                })(),
              )}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
