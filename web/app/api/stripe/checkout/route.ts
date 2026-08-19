import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import { getStripe, stripePriceId, subscriptionsEnabled } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function POST() {
  if (!subscriptionsEnabled()) {
    return NextResponse.json(
      { error: "Assinaturas não estão configuradas." },
      { status: 503 },
    );
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para assinar." }, { status: 401 });
  }

  const stripe = getStripe();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    const admin = createServiceRoleClient();
    await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "incomplete",
      },
      { onConflict: "user_id" },
    );
  }

  const siteUrl = await getSiteUrl();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: stripePriceId(), quantity: 1 }],
    success_url: `${siteUrl}/assinar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/assinar?cancelado=1`,
    client_reference_id: user.id,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    payment_method_types: ["card", "pix"],
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Não foi possível iniciar o checkout." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
