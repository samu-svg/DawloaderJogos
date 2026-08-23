import type { Metadata } from "next";
import { FeaturedGamesStrip } from "@/components/featured-games-strip";
import { GameCatalog } from "@/components/game-catalog";
import { MontaHDStrip } from "@/components/montahd-strip";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { isPortfolioAdmin } from "@/lib/admin";
import { toCatalogGameItems } from "@/lib/catalog-items";
import { loadAcervo } from "@/lib/games";
import { userHasCatalogAccess } from "@/lib/subscription";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "MontaHD — Downloads de jogos de Xbox 360",
  description:
    "Acervo de jogos de Xbox 360 para instalar no HD. Você paga pelo software MontaHD, não pelos arquivos — o app baixa, descompacta e organiza cada jogo na pasta certa.",
};

type PageProps = {
  searchParams: Promise<{ colecao?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const [{ colecao }, user, { games, collections }] = await Promise.all([
    searchParams,
    currentUser(),
    loadAcervo(),
  ]);

  const isAdmin = isPortfolioAdmin(user?.email);
  const hasAccess = user ? await userHasCatalogAccess(user) : false;

  const items = toCatalogGameItems(games);

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="content-narrow flex-1 px-6 py-8">
        <div className="page-stack">
        <header className="page-header">
          <p className="page-eyebrow">Xbox 360</p>
          <h1 className="page-title">Downloads de jogos</h1>
          <p className="page-lead">
            Navegue pelo acervo, abra a página do jogo e instale no HD pelo app
            MontaHD. Você paga pelo software — os arquivos não são vendidos
            separadamente.
          </p>
        </header>

        <MontaHDStrip hasAccess={hasAccess} />

        <FeaturedGamesStrip games={items} />

        <div className="mt-12">
          <div className="mb-5 text-center">
            <h2 className="section-heading text-xl sm:text-2xl">Catálogo completo</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Todos os jogos do acervo, com filtros e busca.
            </p>
          </div>
          <GameCatalog
            games={items}
            collections={collections}
            initialCollection={
              collections.some((item) => item.slug === colecao)
                ? (colecao ?? null)
                : null
            }
          />
        </div>

        <StoreFooter />
        </div>
      </main>
    </>
  );
}
