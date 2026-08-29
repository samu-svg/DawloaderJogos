import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "stripe-portal", RATE_LIMITS.tight);
  if (limited) return limited;

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ error: "Pagamentos não configurados." }, { status: 503 });
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }
  if (passwordIsExpired(user.passwordChangedAt)) {
    return NextResponse.json(
      { error: "Senha expirada. Atualize em /conta.", code: "PASSWORD_EXPIRED" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Nenhum pagamento encontrado." },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  const siteUrl = await getSiteUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${siteUrl}/assinar`,
  });

  return NextResponse.json({ url: portal.url });
}
