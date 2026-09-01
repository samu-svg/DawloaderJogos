import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { getApiUser } from "@/lib/auth";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSiteUrl } from "@/lib/site-url";
import {
  getPlan,
  isPaymentMethod,
  isPlanId,
  stripePriceIdFor,
  type PaymentMethod,
  type PlanId,
} from "@/lib/stripe-plans";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";

type CheckoutBody = {
  plan?: string;
  method?: string;
};

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "stripe-checkout", RATE_LIMITS.tight);
  if (limited) return limited;

  if (!subscriptionsEnabled()) {
    return NextResponse.json(
      { error: "Pagamentos não estão configurados." },
      { status: 503 },
    );
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para pagar." }, { status: 401 });
  }

  const userLimited = await enforceRateLimit(
    request,
    "stripe-checkout",
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

  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    body = {};
  }

  const planId = body.plan?.trim() || "1m";
  const method = body.method?.trim() || "card";

  if (!isPlanId(planId)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  if (!isPaymentMethod(method)) {
    return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });
  }

  const priceId = stripePriceIdFor(planId, method);
  if (!priceId) {
    return NextResponse.json(
      { error: "Este plano ainda não está disponível. Tente outro." },
      { status: 503 },
    );
  }

  const plan = getPlan(planId);
  const stripe = getStripe();
  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id;
  const userMeta = {
    app_user_id: user.id,
    supabase_user_id: user.id,
    plan: planId,
    access_months: String(plan.months),
    payment_method: method,
  };

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: userMeta,
    });
    customerId = customer.id;

    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "incomplete",
      },
      { onConflict: "user_id" },
    );
    if (error) {
      return NextResponse.json({ error: "Não foi possível preparar o pagamento." }, { status: 500 });
    }
  }

  const siteUrl = await getSiteUrl();
  const sessionParams = buildCheckoutSession({
    customerId,
    priceId,
    planId,
    method,
    planMonths: plan.months,
    siteUrl,
    userId: user.id,
    userMeta,
  });

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return NextResponse.json(
      { error: "Não foi possível iniciar o checkout." },
      { status: 500 },
    );
  }

  await recordAudit({
    actorId: user.id,
    action: "stripe.checkout",
    entity: "subscription",
    entityId: user.id,
    ip: requestIp(request),
    metadata: { plan: planId, method },
  });

  return NextResponse.json({ url: session.url });
}

function buildCheckoutSession(input: {
  customerId: string;
  priceId: string;
  planId: PlanId;
  method: PaymentMethod;
  planMonths: number;
  siteUrl: string;
  userId: string;
  userMeta: Record<string, string>;
}): Parameters<ReturnType<typeof getStripe>["checkout"]["sessions"]["create"]>[0] {
  const base = {
    customer: input.customerId,
    locale: "pt-BR" as const,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${input.siteUrl}/assinar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.siteUrl}/assinar?cancelado=1`,
    client_reference_id: input.userId,
    metadata: input.userMeta,
  };

  if (input.method === "pix") {
    return {
      ...base,
      mode: "payment",
      payment_method_types: ["pix"],
      payment_intent_data: { metadata: input.userMeta },
    };
  }

  return {
    ...base,
    mode: "subscription",
    subscription_data: { metadata: input.userMeta },
  };
}
