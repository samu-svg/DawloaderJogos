import type { Metadata } from "next";
import { AppHero } from "@/components/app-hero";
import { AppPlanCard } from "@/components/app-plan-card";
import { AppValueProps } from "@/components/app-value-props";
import { HowItWorks } from "@/components/how-it-works";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { currentAppUser } from "@/lib/auth";
import { loadAcervo } from "@/lib/games";
import { canAccessPainel } from "@/lib/rbac";
import { stripePlanLabel, subscriptionsEnabled } from "@/lib/stripe";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "O app MontaHD — baixa e organiza os jogos no seu HD",
  description:
    "Você paga pelo software MontaHD, não pelos arquivos. O app baixa, verifica, descompacta e coloca cada jogo na pasta certa do HD. Acervo incluído na assinatura mensal, sem anúncios.",
};

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
      <main className="content-narrow flex-1 px-6 py-8">
        <div className="page-stack">
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
        </div>
      </main>
    </>
  );
}
