import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManageSubscriptionButton } from "@/components/subscribe-checkout-button";
import { PlanPicker } from "@/components/plan-picker";
import { SiteHeader } from "@/components/site-header";
import { asaasPixAvailablePlans } from "@/lib/asaas";
import { requireAppUser } from "@/lib/auth";
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
  title: "Assinar o MontaHD",
  description:
    "Libere o app MontaHD e o acervo. Planos de 1, 2 ou 3 meses — cartão recorrente ou PIX à vista.",
};

const INCLUDED = [
  {
    title: "Licença do app",
    text: "MontaHD para Windows, com atualizações no período.",
  },
  {
    title: "Acervo completo",
    text: "Acesso a tudo enquanto o plano estiver ativo.",
  },
  {
    title: "Instalação automática",
    text: "Download, extração e pasta certa no HD.",
  },
  {
    title: "Sem amarras",
    text: "Qualquer pasta, sem limite de dispositivos vinculados.",
  },
];

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
    stripePriceIdFor(plan.id, "card"),
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
              Planos MontaHD
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Libere o <span className="text-gradient">MontaHD</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              Você paga pelo <strong className="text-zinc-200">software</strong>,
              não pelos arquivos. Escolha 1, 2 ou 3 meses — cartão recorrente ou
              PIX à vista, sem pegadinha.
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
                  Plano ativo
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
                    Abrir meu acervo
                  </Link>
                  {stripeManaged && <ManageSubscriptionButton />}
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

                <ul className="grid gap-3 sm:grid-cols-2">
                  {INCLUDED.map((item) => (
                    <li
                      key={item.title}
                      className="flex gap-3 rounded-2xl border border-border/70 bg-surface/60 px-4 py-3.5"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent-hover">
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                          {item.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

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
