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
  "Acervo completo incluído — sem pagar por jogo ou arquivo",
  "Download e extração automáticos",
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
            Assinatura do software
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Libere o MontaHD
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-6 text-zinc-400">
            Você paga pelo <strong className="text-zinc-200">software MontaHD</strong>,
            não pelos arquivos dos portfólios. A assinatura libera o app que monta
            o seu HD — e o acervo inteiro vem incluído no acesso.
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
                Assinatura ativa — app e acervo liberados.
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
                  Pagamento cancelado. Você pode tentar de novo quando quiser.
                </p>
              )}
              <div>
                <p className="text-3xl font-bold text-white">
                  {stripePlanLabel()}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Pague com <strong className="text-zinc-200">cartão</strong> ou{" "}
                  <strong className="text-zinc-200">PIX</strong> no checkout
                  seguro da Stripe. O valor é pela licença do software — não
                  pelos jogos. O acesso é liberado assim que o pagamento for
                  confirmado.
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
              <p className="text-xs text-zinc-600">
                Cancele quando quiser pelo portal do cliente.
              </p>
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
