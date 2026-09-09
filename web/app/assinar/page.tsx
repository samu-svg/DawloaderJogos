import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanCompare } from "@/components/plan-compare";
import { PlanPicker } from "@/components/plan-picker";
import { SiteHeader } from "@/components/site-header";
import { asaasPixAvailablePlans } from "@/lib/asaas";
import { requireAppUser } from "@/lib/auth";
import { PAID_PLAN_NAME, PLAN_SOFTWARE_LINE, paidPlanSummary } from "@/lib/plan-copy";
import { canAccessPainel } from "@/lib/rbac";
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

export const metadata: Metadata = {
  title: `Assinar o MontaHD ${PAID_PLAN_NAME}`,
  description: `${paidPlanSummary()} ${PLAN_SOFTWARE_LINE} Planos de 1, 2 ou 3 meses — cartão recorrente ou PIX à vista.`,
};

type PageProps = {
  searchParams: Promise<{ cancelado?: string; next?: string }>;
};

export const dynamic = "force-dynamic";

function isStripeSubscriptionId(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("sub_"));
}

export default async function AssinarPage({ searchParams }: PageProps) {
  const user = await requireAppUser();

  const { cancelado, next } = await searchParams;
  const isAdmin = canAccessPainel(user.role);
  const enabled = subscriptionsEnabled();
  const hasAccess = await userHasCatalogAccess(user);
  const subscription = enabled ? await getUserSubscription(user.id) : null;
  const active = subscriptionIsActive(subscription);
  const cardPlans = STRIPE_PLANS.filter((plan) =>
    stripePriceIdFor(plan.id),
  ).map((plan) => plan.id);
  const pixPlans = asaasPixAvailablePlans();
  const paymentsAvailable = cardPlans.length > 0 || pixPlans.length > 0;
  const stripeManaged = isStripeSubscriptionId(
    subscription?.stripe_subscription_id,
  );

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
      <main className="hero-glow relative flex-1">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="relative mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
              MontaHD {PAID_PLAN_NAME}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Passe para o <span className="text-gradient">{PAID_PLAN_NAME}</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              {PLAN_SOFTWARE_LINE} {paidPlanSummary()} Escolha 1, 2 ou 3 meses —
              cartão recorrente ou PIX à vista.
            </p>
          </div>

          <div className="mt-10">
            {!enabled && !paymentsAvailable ? (
              <p className="rounded-[28px] border border-border bg-surface/80 px-6 py-8 text-center text-sm leading-6 text-zinc-400">
                Pagamentos ainda não estão ativos neste ambiente. O acervo
                permanece aberto para testes.
              </p>
            ) : active && user.role !== "admin" ? (
              <section className="mx-auto max-w-xl rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 via-surface to-surface p-8 text-center">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                  {PAID_PLAN_NAME} ativo
                </p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                  App e acervo liberados
                </h2>
                {subscription?.current_period_end && (
                  <p className="mt-2 text-sm text-zinc-400">
                    {stripeManaged ? "Renova em " : "Acesso até "}
                    {new Date(subscription.current_period_end).toLocaleDateString(
                      "pt-BR",
                    )}
                    .
                  </p>
                )}
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/baixar"
                    className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
                  >
                    Montar meu HD
                  </Link>
                  <Link
                    href="/conta/assinatura"
                    className="rounded-xl border border-border px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    {stripeManaged ? "Gerenciar ou cancelar" : "Meu plano"}
                  </Link>
                </div>
              </section>
            ) : (
              <div className="space-y-8">
                {user.role === "admin" && (
                  <p className="rounded-2xl border border-border bg-surface/80 px-4 py-3 text-center text-sm text-zinc-400">
                    Conta de administrador: o acervo já está liberado. Os planos
                    abaixo servem para testar o checkout.
                  </p>
                )}
                {cancelado === "1" && (
                  <p className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
                    Pagamento cancelado no cartão. Você pode tentar de novo quando
                    quiser.
                  </p>
                )}

                <PlanCompare hasAccess={false} loggedIn compact showCtas={false} />

                <PlanPicker cardPlans={cardPlans} pixPlans={pixPlans} />
              </div>
            )}
          </div>

          <p className="mt-10 text-center text-xs text-zinc-600">
            <Link href="/#acervo" className="hover:text-zinc-400">
              ← Ver o acervo antes de assinar
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
