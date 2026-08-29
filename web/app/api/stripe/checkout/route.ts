import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { getApiUser } from "@/lib/auth";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSiteUrl } from "@/lib/site-url";
import { getStripe, stripePriceId, subscriptionsEnabled } from "@/lib/stripe";

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
  if (passwordIsExpired(user.passwordChangedAt)) {
    return NextResponse.json(
      { error: "Senha expirada. Atualize em /conta.", code: "PASSWORD_EXPIRED" },
      { status: 403 },
    );
  }

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id;
  const userMeta = { app_user_id: user.id, supabase_user_id: user.id };

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
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    locale: "pt-BR",
    line_items: [{ price: stripePriceId(), quantity: 1 }],
    success_url: `${siteUrl}/assinar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/assinar?cancelado=1`,
    client_reference_id: user.id,
    metadata: userMeta,
    payment_intent_data: { metadata: userMeta },
  });

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
  });

  return NextResponse.json({ url: session.url });
}
