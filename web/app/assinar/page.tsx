import Link from "next/link";
import { redirect } from "next/navigation";
import { ManageSubscriptionButton } from "@/components/subscribe-checkout-button";
import { PlanPicker } from "@/components/plan-picker";
import { SiteHeader } from "@/components/site-header";
import { asaasPixAvailablePlans } from "@/lib/asaas";
import { requireAppUser } from "@/lib/auth";
import { canAccessPainel, hasSubscriptionBypass } from "@/lib/rbac";
import { safeInternalPath } from "@/lib/safe-redirect";
import { subscriptionsEnabled } from "@/lib/stripe";
import {
  STRIPE_PLANS,
  stripePriceIdFor,
} from "@/lib/stripe-plans";
import {
  getUserSubscription,
  subscriptionIsActive,
  userHasCatalogAccess,
} from "@/lib/subscription";

const INCLUDED = [
  "Licença do software MontaHD para Windows",
  "Acervo completo — acesse tudo enquanto o plano estiver ativo",
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
  const cardPlans = STRIPE_PLANS.filter((plan) =>
    stripePriceIdFor(plan.id, "card"),
  ).map((plan) => plan.id);
  const pixPlans = asaasPixAvailablePlans();
  const paymentsAvailable = cardPlans.length > 0 || pixPlans.length > 0;

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
            Planos MontaHD
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Libere o MontaHD
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-6 text-zinc-400">
            Você paga pelo <strong className="text-zinc-200">software MontaHD</strong>,
            não pelos arquivos dos portfólios. Escolha 1, 2 ou 3 meses — cartão
            recorrente ou PIX à vista.
          </p>
        </div>

        <div className="mt-9 rounded-3xl border border-accent/30 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 p-8">
          {!enabled && !paymentsAvailable ? (
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
                Plano ativo — app e acervo disponíveis neste período.
              </p>
              {subscription?.current_period_end && (
                <p className="text-sm text-zinc-400">
                  {subscription.stripe_subscription_id
                    ? "Renova em "
                    : "Acesso até "}
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
                {subscription?.stripe_subscription_id && (
                  <ManageSubscriptionButton />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {cancelado === "1" && (
                <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-zinc-300">
                  Pagamento cancelado no checkout. Você pode tentar de novo quando quiser.
                </p>
              )}
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
              <PlanPicker cardPlans={cardPlans} pixPlans={pixPlans} />
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
