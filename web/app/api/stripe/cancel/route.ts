import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { getApiUser } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";
import { isCardSubscriptionId } from "@/lib/stripe-webhook-events";
import { createClient } from "@/lib/supabase/server";

type CancelBody = { action?: string };

/**
 * Cancela ou reativa a renovação da assinatura no cartão.
 *
 * O cancelamento é agendado para o fim do período já pago
 * (`cancel_at_period_end`), não imediato: o usuário não perde dia que pagou.
 * Quem grava o acesso continua sendo o webhook, a partir do estado do Stripe.
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "stripe-cancel", RATE_LIMITS.tight);
  if (limited) return limited;

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ error: "Pagamentos não configurados." }, { status: 503 });
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  const userLimited = await enforceRateLimit(
    request,
    "stripe-cancel",
    RATE_LIMITS.tight,
    user.id,
  );
  if (userLimited) return userLimited;

  if (passwordIsExpired(user.passwordChangedAt)) {
    return NextResponse.json(
      { error: "Senha expirada. Atualize em /conta.", code: "PASSWORD_EXPIRED" },
      { status: 403 },
    );
  }

  let body: CancelBody = {};
  try {
    body = (await request.json()) as CancelBody;
  } catch {
    body = {};
  }

  const action = body.action?.trim() || "cancel";
  if (action !== "cancel" && action !== "resume") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  // RLS: o SELECT do usuário só alcança a própria linha, então a assinatura
  // que chega aqui é sempre dele.
  const supabase = await createClient();
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logError("Stripe cancel: leitura da assinatura falhou", error, {
      userId: user.id,
    });
    return NextResponse.json({ error: "Não foi possível ler seu plano." }, { status: 500 });
  }

  const subscriptionId = subscription?.stripe_subscription_id;
  if (!isCardSubscriptionId(subscriptionId)) {
    return NextResponse.json(
      { error: "Você não tem plano no cartão para cancelar." },
      { status: 404 },
    );
  }

  try {
    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(String(subscriptionId), {
      cancel_at_period_end: action === "cancel",
    });

    await recordAudit({
      actorId: user.id,
      action: action === "cancel" ? "stripe.subscription.cancel" : "stripe.subscription.resume",
      entity: "subscription",
      entityId: updated.id,
      ip: requestIp(request),
      metadata: { cancelAtPeriodEnd: updated.cancel_at_period_end },
    });

    return NextResponse.json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });
  } catch (err) {
    logError("Stripe cancel failed", err, { userId: user.id, action });
    return NextResponse.json(
      { error: "Não foi possível falar com o Stripe. Tente de novo em instantes." },
      { status: 502 },
    );
  }
}
