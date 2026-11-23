import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Cake, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  BIRTHDAY_NOTIFICATIONS_KEY,
  FRENTISTAS_KEY,
  ageOnDate,
  formatDateBR,
  usePostoStorage,
  type FrentistaMeta,
} from "@/lib/metas";

export const Route = createFileRoute("/aniversariantes")({
  component: AniversariantesPage,
});

const EMPTY_FRENTISTAS: FrentistaMeta[] = [];
const NOTIFIED_DATE_KEY = "posto10_aniversario_notificado_em";

function localISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AniversariantesPage() {
  const [frentistas] = usePostoStorage(FRENTISTAS_KEY, EMPTY_FRENTISTAS);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const todayISO = localISODate(now);
  const birthdayPeople = useMemo(
    () =>
      frentistas.filter(
        (person) => person.ativo && person.nascimento.slice(5) === todayISO.slice(5),
      ),
    [frentistas, todayISO],
  );
  const monthPeople = useMemo(
    () =>
      frentistas
        .filter((person) => person.ativo && person.nascimento)
        .filter((person) => Number(person.nascimento.slice(5, 7)) === now.getMonth() + 1)
        .sort(
          (a, b) =>
            Number(a.nascimento.slice(8, 10)) - Number(b.nascimento.slice(8, 10)) ||
            a.nome.localeCompare(b.nome),
        ),
    [frentistas, now],
  );

  useEffect(() => {
    const refresh = () =>
      setNotificationsEnabled(window.localStorage.getItem(BIRTHDAY_NOTIFICATIONS_KEY) === "true");
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(`posto10-storage:${BIRTHDAY_NOTIFICATIONS_KEY}`, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(`posto10-storage:${BIRTHDAY_NOTIFICATIONS_KEY}`, refresh);
    };
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermissionMessage("Este navegador não oferece suporte a notificações.");
      return;
    }
    if (Notification.permission !== "granted") {
      void Notification.requestPermission()
        .then((permission) => {
          setPermissionMessage(
            permission === "granted"
              ? "Notificações de aniversário autorizadas."
              : "Permita notificações no navegador para receber os avisos.",
          );
        })
        .catch(() => {
          setPermissionMessage("Não foi possível solicitar permissão para notificações.");
        });
    }
  }, []);

  useEffect(() => {
    const checkAnniversaries = () => {
      const current = new Date();
      setNow(current);
      if (!notificationsEnabled || !("Notification" in window)) return;
      const iso = localISODate(current);
      const celebrants = frentistas.filter(
        (person) => person.ativo && person.nascimento.slice(5) === iso.slice(5),
      );
      if (
        celebrants.length === 0 ||
        Notification.permission !== "granted" ||
        window.localStorage.getItem(NOTIFIED_DATE_KEY) === iso
      ) {
        return;
      }

      new Notification("🎂 Aniversário Hoje no Posto 10", {
        body: `Hoje é aniversário de ${celebrants.map((person) => person.nome).join(", ")}!`,
        icon: "/icon-192.png",
      });
      window.localStorage.setItem(NOTIFIED_DATE_KEY, iso);
    };

    checkAnniversaries();
    const timer = window.setInterval(() => {
      const current = new Date();
      if (current.getHours() === 8 && current.getMinutes() < 5) checkAnniversaries();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [frentistas, notificationsEnabled]);

  const greetingLink = (name: string, phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const message = `Parabéns ${name}! A equipe Posto 10 te deseja um dia muito feliz, cheio de alegria e realizações!`;
    return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
  };

  return (
    <AppShell title="Aniversariantes" subtitle="Celebre os momentos especiais da equipe">
      {permissionMessage ? (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          {permissionMessage}
        </p>
      ) : null}
      <section className="mb-6 rounded-xl border border-[#7c3aed]/50 bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Cake className="size-5 text-[#7c3aed]" />
          <h2 className="font-display text-lg text-foreground">ANIVERSARIANTES DO DIA</h2>
        </div>
        {birthdayPeople.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {birthdayPeople.map((person) => {
              const age = ageOnDate(
                person.nascimento,
                new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              );
              const initials = person.nome
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0] ?? "")
                .join("");
              return (
                <article
                  key={person.id}
                  className="flex items-center gap-4 rounded-xl border-2 border-[#7c3aed]/40 bg-white p-4 shadow-sm"
                >
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-lg font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900">{person.nome}</h3>
                    <p className="text-sm text-gray-600">
                      {age} anos · CPF {person.cpf}
                    </p>
                    <a
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      href={greetingLink(person.nome, person.whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="size-4" /> Enviar Parabéns
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            Nenhum aniversariante ativo hoje ({formatDateBR(todayISO)}).
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[#7c3aed]/50 bg-card p-4">
        <h2 className="mb-4 font-display text-lg text-foreground">ANIVERSARIANTES DO MÊS</h2>
        {monthPeople.length ? (
          <div className="divide-y divide-border">
            {monthPeople.map((person) => {
              const day = Number(person.nascimento.slice(8, 10));
              const birthdayThisYear = new Date(now.getFullYear(), now.getMonth(), day);
              const age = ageOnDate(person.nascimento, birthdayThisYear);
              return (
                <div
                  key={person.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    Dia {day} - {person.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">{age} anos</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Não há aniversários cadastrados para este mês.
          </p>
        )}
      </section>
    </AppShell>
  );
}
