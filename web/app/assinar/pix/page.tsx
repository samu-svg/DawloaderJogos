import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PixCheckout } from "@/components/pix-checkout";
import { SiteHeader } from "@/components/site-header";
import { loadOwnedPixCheckout } from "@/lib/asaas-pix";
import { isAsaasPaymentId } from "@/lib/asaas-pix-format";
import { requireAppUser } from "@/lib/auth";
import { canAccessPainel } from "@/lib/rbac";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Pagar com PIX — MontaHD",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ payment?: string }>;
};

function PixCheckoutMissing() {
  return (
    <div className="mx-auto w-full max-w-lg rounded-[28px] border border-border bg-surface p-8 text-center sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
        Checkout PIX
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
        Pagamento não encontrado
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Este PIX não está mais disponível ou não pertence à sua conta. Volte
        aos planos para gerar um novo código.
      </p>
      <Link
        href="/assinar"
        className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
      >
        Escolher um plano
      </Link>
    </div>
  );
}

export default async function PixCheckoutPage({ searchParams }: PageProps) {
  const { payment } = await searchParams;
  const loginNext =
    payment && isAsaasPaymentId(payment)
      ? `/assinar/pix?payment=${encodeURIComponent(payment)}`
      : "/assinar";
  const user = await requireAppUser({ loginNext });
  const isAdmin = canAccessPainel(user.role);
  const hasAccess = await userHasCatalogAccess(user);

  const view =
    payment && isAsaasPaymentId(payment)
      ? await loadOwnedPixCheckout(user.id, payment)
      : null;

  if (view?.paid) {
    redirect("/assinar/sucesso");
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
        <div className="relative mx-auto w-full max-w-5xl px-6 py-10 sm:py-16">
          {view ? <PixCheckout initial={view} /> : <PixCheckoutMissing />}
        </div>
      </main>
    </>
  );
}
