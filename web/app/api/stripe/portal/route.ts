import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function POST() {
  if (!subscriptionsEnabled()) {
    return NextResponse.json({ error: "Assinaturas não configuradas." }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Nenhuma assinatura encontrada." },
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
