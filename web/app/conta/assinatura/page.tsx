import Link from "next/link";
import type { Metadata } from "next";
import { CancelSubscriptionControls } from "@/components/cancel-subscription-controls";
import { SiteHeader } from "@/components/site-header";
import { ManageSubscriptionButton } from "@/components/subscribe-checkout-button";
import { requireAppUser } from "@/lib/auth";
import { logWarn } from "@/lib/logger";
import { canAccessPainel } from "@/lib/rbac";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";
import {
  isCardSubscriptionId,
  periodEndToIso,
  subscriptionPeriodEndSeconds,
} from "@/lib/stripe-webhook-events";
import {
  getUserSubscription,
  subscriptionIsActive,
  userHasCatalogAccess,
} from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Meu plano",
  description: "Veja e cancele a renovação do seu plano MontaHD no cartão.",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type CardState = {
  cancelAtPeriodEnd: boolean;
  periodEndIso: string | null;
};

/**
 * O estado do cancelamento agendado só existe no Stripe: a tabela local
 * guarda status e vencimento, não `cancel_at_period_end`.
 */
async function loadCardState(subscriptionId: string): Promise<CardState | null> {
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    return {
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      periodEndIso: periodEndToIso(subscriptionPeriodEndSeconds(subscription)),
    };
  } catch (error) {
    logWarn("Assinatura: leitura no Stripe falhou", {
      subscriptionId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export default async function AssinaturaPage() {
  const user = await requireAppUser();
  const isAdmin = canAccessPainel(user.role);
  const hasAccess = await userHasCatalogAccess(user);
  const enabled = subscriptionsEnabled();
  const subscription = enabled ? await getUserSubscription(user.id) : null;
  const active = subscriptionIsActive(subscription);

  const cardSubscriptionId = isCardSubscriptionId(subscription?.stripe_subscription_id)
    ? String(subscription?.stripe_subscription_id)
    : null;
  const cardState = cardSubscriptionId
    ? await loadCardState(cardSubscriptionId)
    : null;

  // Sem resposta do Stripe, o vencimento do cache local ainda serve de aviso.
  const periodEndLabel = formatDate(
    cardState?.periodEndIso ?? subscription?.current_period_end ?? null,
  );

  return (
    <>
      <SiteHeader email={user.email} showPainelLink={isAdmin} hasAccess={hasAccess} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Meu plano</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Veja a situação do seu acesso e cancele a renovação quando quiser.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
          {!enabled ? (
            <p className="text-sm leading-6 text-zinc-400">
              Pagamentos não estão ativos neste ambiente, então não há plano para
              gerenciar.
            </p>
          ) : cardSubscriptionId ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-white">Plano no cartão</p>
                <span
                  className={
                    active
                      ? "rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300"
                      : "rounded-full border border-zinc-600/40 bg-zinc-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400"
                  }
                >
                  {active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                {periodEndLabel
                  ? cardState?.cancelAtPeriodEnd
                    ? `Acesso até ${periodEndLabel}.`
                    : `Renova em ${periodEndLabel}.`
                  : "Cobrança recorrente pelo Stripe."}
              </p>

              <div className="mt-6">
                <CancelSubscriptionControls
                  cancelAtPeriodEnd={cardState?.cancelAtPeriodEnd ?? false}
                  periodEndLabel={periodEndLabel}
                />
              </div>

              <div className="mt-4 flex justify-center">
                <ManageSubscriptionButton />
              </div>
            </>
          ) : active ? (
            <>
              <p className="text-sm font-medium text-white">Acesso pago no PIX</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                PIX é pagamento à vista: não existe cobrança recorrente para
                cancelar.{" "}
                {periodEndLabel
                  ? `Seu acesso vale até ${periodEndLabel} e simplesmente expira depois disso.`
                  : "O acesso expira no fim do período pago."}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white">Nenhum plano ativo</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Você não tem cobrança em aberto. Não há nada para cancelar.
              </p>
              <Link
                href="/assinar"
                className="mt-6 inline-flex rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
              >
                Ver planos
              </Link>
            </>
          )}
        </section>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-4 text-center text-xs text-zinc-600">
          <Link href="/conta" className="hover:text-zinc-400">
            Conta e senha
          </Link>
          <Link href="/suporte" className="hover:text-zinc-400">
            Suporte
          </Link>
          <Link href="/baixar" className="hover:text-zinc-400">
            ← Voltar ao acervo
          </Link>
        </p>
      </main>
    </>
  );
}
