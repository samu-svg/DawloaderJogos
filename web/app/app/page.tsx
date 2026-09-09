import type { Metadata } from "next";
import Link from "next/link";
import { AppHero } from "@/components/app-hero";
import { AppPlanCard } from "@/components/app-plan-card";
import { AppValueProps } from "@/components/app-value-props";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { HowItWorks } from "@/components/how-it-works";
import { PlanCompare } from "@/components/plan-compare";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { currentAppUser } from "@/lib/auth";
import { loadAcervo } from "@/lib/games";
import { pageMetadata } from "@/lib/seo";
import { canAccessPainel } from "@/lib/rbac";
import { lowestPlanPriceLabel } from "@/lib/stripe-plans";
import { subscriptionsEnabled } from "@/lib/stripe";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = pageMetadata({
  title: "O app MontaHD — baixa e organiza os jogos no HD",
  description:
    "Baixe o app MontaHD para Windows: download automático de jogos Xbox 360, extração e instalação na pasta certa do HD. Grátis para um jogo por vez.",
  path: "/app",
});

export default async function AppPage() {
  const [user, { games, collections }] = await Promise.all([
    currentAppUser(),
    loadAcervo(),
  ]);

  const isAdmin = user ? canAccessPainel(user.role) : false;
  const hasAccess = user ? await userHasCatalogAccess(user) : false;
  const totalBytes = games.reduce((sum, game) => sum + game.totalBytes, 0);

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="hero-glow relative flex-1">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="relative mx-auto w-full max-w-5xl space-y-14 px-6 py-12 sm:py-16">
          <AppHero
            loggedIn={Boolean(user)}
            hasAccess={hasAccess}
            gameCount={games.length}
            collectionCount={collections.length}
            totalBytes={totalBytes}
            planLabel={lowestPlanPriceLabel()}
          />

          <DesktopDownloadCard variant="full" loggedIn={Boolean(user)} />

          <AppValueProps />

          <HowItWorks />

          <PlanCompare
            hasAccess={hasAccess}
            loggedIn={Boolean(user)}
          />

          <AppPlanCard
            hasAccess={hasAccess}
            loggedIn={Boolean(user)}
            paymentsEnabled={subscriptionsEnabled()}
          />

          <p className="text-center text-xs text-zinc-600">
            <Link href="/" className="hover:text-zinc-400">
              ← Ver o acervo
            </Link>
          </p>

          <StoreFooter />
        </div>
      </main>
    </>
  );
}
