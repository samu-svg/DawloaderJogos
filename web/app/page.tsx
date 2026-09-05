import type { Metadata } from "next";
import { GameCatalog } from "@/components/game-catalog";
import { HomeHero } from "@/components/home-hero";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { canAccessPainel } from "@/lib/rbac";
import { toCatalogGameItems } from "@/lib/catalog-items";
import { loadAcervo } from "@/lib/games";
import { currentAppUser } from "@/lib/auth";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "MontaHD — Downloads de jogos de Xbox 360",
  description:
    "Acervo de jogos de Xbox 360 para instalar no HD. Você paga pelo software MontaHD, não pelos arquivos — o app baixa, descompacta e organiza cada jogo na pasta certa.",
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

  const items = toCatalogGameItems(games);

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
          gameCount={items.length}
          totalBytes={items.reduce((sum, game) => sum + game.sizeBytes, 0)}
        />

        <div className="mt-12">
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
