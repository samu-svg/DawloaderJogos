import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ManageSubscriptionButton,
  SubscribeCheckoutButton,
} from "@/components/subscribe-checkout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAppUser } from "@/lib/auth";
import { canAccessPainel, hasSubscriptionBypass } from "@/lib/rbac";
import { safeInternalPath } from "@/lib/safe-redirect";
import { stripePlanLabel, subscriptionsEnabled } from "@/lib/stripe";
import {
  getUserSubscription,
  subscriptionIsActive,
  userHasCatalogAccess,
} from "@/lib/subscription";

const INCLUDED = [
  "Licença do software MontaHD para Windows",
  "Acervo completo — acesse tudo enquanto a assinatura estiver ativa",
  "Download e extração automáticos",
  "Use em qualquer pasta do HD, sem limite de dispositivos vinculados",
  "Sem anúncios e sem encurtadores",
];

type PageProps = {
  searchParams: Promise<{ cancelado?: string; next?: string }>;
};

export default async function AssinarPage({ searchParams }: PageProps) {
  const user = await requireAppUser();

  const { cancelado, next } = await searchParams;
  const isAdmin = canAccessPainel(user.role);
  const enabled = subscriptionsEnabled();
  const hasAccess = await userHasCatalogAccess(user);
  const subscription = enabled ? await getUserSubscription(user.id) : null;
  const active = subscriptionIsActive(subscription);

  if (hasAccess && next) {
    redirect(safeInternalPath(next, "/baixar"));
  }

  return (
    <>
      <SiteHeader
        email={user.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
            Assinatura mensal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Libere o MontaHD
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-6 text-zinc-400">
            Você paga pelo <strong className="text-zinc-200">software MontaHD</strong>,
            não pelos arquivos dos portfólios. Enquanto a assinatura estiver ativa,
            o app e o acervo inteiro ficam liberados.
          </p>
        </div>

        <div className="mt-9 rounded-3xl border border-accent/30 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 p-8">
          {!enabled ? (
            <p className="text-sm leading-6 text-zinc-400">
              Pagamentos ainda não estão ativos neste ambiente. O acervo
              permanece aberto para testes.
            </p>
          ) : hasSubscriptionBypass(user.role) ? (
            <p className="text-sm leading-6 text-zinc-400">
              Sua conta de administrador já tem acesso completo ao app e ao
              acervo.
            </p>
          ) : active ? (
            <div className="space-y-5">
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                Assinatura ativa — app e acervo disponíveis neste período.
              </p>
              {subscription?.current_period_end && (
                <p className="text-sm text-zinc-400">
                  Renova em{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString(
                    "pt-BR",
                  )}
                  .
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/baixar"
                  className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
                >
                  Abrir meu acervo
                </Link>
                <ManageSubscriptionButton />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {cancelado === "1" && (
                <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-zinc-300">
                  Assinatura cancelada no checkout. Você pode tentar de novo quando quiser.
                </p>
              )}
              <div>
                <p className="text-3xl font-bold text-white">
                  {stripePlanLabel()}
                </p>
                <p className="mt-1 text-sm text-zinc-500">cobrança mensal</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Pague com <strong className="text-zinc-200">cartão</strong> no
                  checkout seguro da Stripe. O valor é pela licença do software —
                  não pelos jogos. Cancele quando quiser pelo portal da assinatura.
                </p>
              </div>
              <ul className="space-y-2.5">
                {INCLUDED.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-zinc-300"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent-hover">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <SubscribeCheckoutButton label="Assinar e liberar o app" />
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          <Link href="/#acervo" className="hover:text-zinc-400">
            ← Ver o acervo antes de assinar
          </Link>
        </p>
      </main>
    </>
  );
}
