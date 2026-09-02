import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportCloseButton } from "@/components/support-close-button";
import { SupportReplyForm } from "@/components/support-reply-form";
import { requireRole } from "@/lib/auth";
import {
  parseSupportStatus,
  supportStatusLabel,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PainelSuporteTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole("admin");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, user_id, user_email, subject, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (ticketError) throw new Error(ticketError.message);
  if (!ticket) notFound();

  const { data: messages, error: messagesError } = await supabase
    .from("support_messages")
    .select("id, author_id, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) throw new Error(messagesError.message);

  const status = parseSupportStatus(ticket.status) ?? "open";
  const closed = status === "closed";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <Link
          href="/painel/suporte"
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          ← Fila de suporte
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {ticket.subject}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {ticket.user_email} · {supportStatusLabel(status)} ·{" "}
              {new Date(ticket.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <SupportCloseButton ticketId={ticket.id} closed={closed} />
        </div>
      </div>

      <ul className="space-y-3">
        {(messages ?? []).map((message) => {
          const fromStaff = message.author_id !== ticket.user_id;
          return (
            <li
              key={message.id}
              className={`rounded-2xl border px-4 py-3 ${
                fromStaff
                  ? "border-accent/30 bg-accent/10"
                  : "border-border bg-surface"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-400">
                  {fromStaff
                    ? message.author_id === admin.id
                      ? "Você (suporte)"
                      : "Suporte"
                    : "Cliente"}
                </span>
                <time dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleString("pt-BR")}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
                {message.body}
              </p>
            </li>
          );
        })}
      </ul>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <SupportReplyForm ticketId={ticket.id} closed={closed} />
      </section>
    </div>
  );
}
