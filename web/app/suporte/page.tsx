import Link from "next/link";
import { NewSupportTicketForm } from "@/components/new-support-ticket-form";
import { SiteHeader } from "@/components/site-header";
import { requireAppUser } from "@/lib/auth";
import { canAccessPainel, canManageSupport } from "@/lib/rbac";
import { userHasCatalogAccess } from "@/lib/subscription";
import {
  parseSupportStatus,
  supportStatusLabel,
  type SupportTicketStatus,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/server";

function statusClass(status: SupportTicketStatus): string {
  switch (status) {
    case "open":
      return "text-amber-300";
    case "answered":
      return "text-emerald-300";
    case "closed":
      return "text-zinc-500";
  }
}

export default async function SuportePage() {
  const user = await requireAppUser({ loginNext: "/suporte" });
  const hasAccess = await userHasCatalogAccess(user);
  const supabase = await createClient();

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id, subject, status, updated_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <>
      <SiteHeader
        email={user.email}
        showPainelLink={canAccessPainel(user.role)}
        hasAccess={hasAccess}
      />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Suporte
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Converse com a equipe pelo site. Sem e-mail externo — tudo fica
            nesta conversa.
          </p>
          {canManageSupport(user.role) ? (
            <p className="mt-2 text-sm">
              <Link
                href="/painel/suporte"
                className="text-zinc-300 underline hover:text-white"
              >
                Abrir fila de suporte (admin)
              </Link>
            </p>
          ) : null}
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-white">Novo ticket</h2>
          <div className="mt-4">
            <NewSupportTicketForm />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Seus tickets</h2>
          {!tickets?.length ? (
            <p className="text-sm text-zinc-500">Nenhum ticket ainda.</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {tickets.map((ticket) => {
                const status =
                  parseSupportStatus(ticket.status) ?? ("open" as const);
                return (
                  <li key={ticket.id}>
                    <Link
                      href={`/suporte/${ticket.id}`}
                      className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {ticket.subject}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Atualizado{" "}
                          {new Date(ticket.updated_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium ${statusClass(status)}`}
                      >
                        {supportStatusLabel(status)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
