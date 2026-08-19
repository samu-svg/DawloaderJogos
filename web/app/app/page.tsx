import type { Metadata } from "next";
import { AppHero } from "@/components/app-hero";
import { AppPlanCard } from "@/components/app-plan-card";
import { AppValueProps } from "@/components/app-value-props";
import { HowItWorks } from "@/components/how-it-works";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { isPortfolioAdmin } from "@/lib/admin";
import { loadAcervo } from "@/lib/games";
import { stripePlanLabel, subscriptionsEnabled } from "@/lib/stripe";
import { userHasCatalogAccess } from "@/lib/subscription";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "O app MontaHD — baixa e organiza os jogos no seu HD",
  description:
    "O MontaHD baixa, verifica, descompacta e coloca cada jogo na pasta certa do HD. Assine o app e libere o acervo completo, sem anúncios.",
};

export default async function AppPage() {
  const [user, { games, collections }] = await Promise.all([
    currentUser(),
    loadAcervo(),
  ]);

  const isAdmin = isPortfolioAdmin(user?.email);
  const hasAccess = user ? await userHasCatalogAccess(user) : false;
  const totalBytes = games.reduce((sum, game) => sum + game.totalBytes, 0);

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <AppHero
          loggedIn={Boolean(user)}
          hasAccess={hasAccess}
          gameCount={games.length}
          collectionCount={collections.length}
          totalBytes={totalBytes}
          planLabel={stripePlanLabel()}
        />

        <AppValueProps />

        <HowItWorks />

        <AppPlanCard
          planLabel={stripePlanLabel()}
          hasAccess={hasAccess}
          loggedIn={Boolean(user)}
          paymentsEnabled={subscriptionsEnabled()}
        />

        <StoreFooter />
      </main>
    </>
  );
}
