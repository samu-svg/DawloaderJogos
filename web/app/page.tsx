import type { Metadata } from "next";
import { GameCatalog } from "@/components/game-catalog";
import { HomeHero } from "@/components/home-hero";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { canAccessPainel } from "@/lib/rbac";
import { catalogStoreGames, toCatalogGameItems } from "@/lib/catalog-items";
import { loadAcervo } from "@/lib/games";
import { currentAppUser } from "@/lib/auth";
import {
  FREE_PLAN_NAME,
  PAID_PLAN_NAME,
  freePlanSummary,
  paidPlanSummary,
  siteMetaDescription,
} from "@/lib/plan-copy";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "MontaHD — Downloads de jogos de Xbox 360",
  description: siteMetaDescription(),
};

type PageProps = {
  searchParams: Promise<{ colecao?: string; semanal?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const [{ colecao, semanal }, appUser, { games, collections }] =
    await Promise.all([
      searchParams,
      currentAppUser(),
      loadAcervo(),
    ]);

  const isAdmin = appUser ? canAccessPainel(appUser.role) : false;
  const hasAccess = appUser ? await userHasCatalogAccess(appUser) : false;

  const items = catalogStoreGames(toCatalogGameItems(games));

  return (
    <>
      <SiteHeader
        email={appUser?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="content-narrow flex-1 px-6 py-8">
        <div className="page-stack">
        <HomeHero
          hasAccess={hasAccess}
          loggedIn={Boolean(appUser)}
          gameCount={items.length}
          totalBytes={items.reduce((sum, game) => sum + game.sizeBytes, 0)}
        />

        <div className="mt-12">
          {!hasAccess && (
            <p className="mb-6 text-center text-sm leading-6 text-zinc-500">
              {appUser
                ? `No plano ${FREE_PLAN_NAME}: ${freePlanSummary()} Abra um jogo e clique em Instalar no HD.`
                : `Crie a conta ${FREE_PLAN_NAME} e baixe ${freePlanSummary().replace(/^U/, "u")} Assine o ${PAID_PLAN_NAME} para ${paidPlanSummary().replace(/^A/, "a")}`}
            </p>
          )}
          <GameCatalog
            games={items}
            collections={collections}
            initialCollection={
              collections.some((item) => item.slug === colecao)
                ? (colecao ?? null)
                : null
            }
            initialWeekly={semanal === "1"}
          />
        </div>

        <StoreFooter />
        </div>
      </main>
    </>
  );
}
