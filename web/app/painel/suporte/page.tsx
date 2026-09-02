import Link from "next/link";
import { requireRole } from "@/lib/auth";
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

export default async function PainelSuportePage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id, subject, status, user_email, updated_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const openCount =
    tickets?.filter((t) => t.status === "open" || t.status === "answered")
      .length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/painel" className="hover:text-zinc-300">
            ← Painel
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Suporte
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {openCount} ticket(s) ativos · respostas só pelo site
        </p>
      </div>

      {!tickets?.length ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-zinc-500">
          Nenhum ticket ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {tickets.map((ticket) => {
            const status =
              parseSupportStatus(ticket.status) ?? ("open" as const);
            return (
              <li key={ticket.id}>
                <Link
                  href={`/painel/suporte/${ticket.id}`}
                  className="flex flex-col gap-1 px-5 py-4 transition hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {ticket.user_email} ·{" "}
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
    </div>
  );
}
