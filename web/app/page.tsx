import type { Metadata } from "next";
import {
  GameCatalog,
  type CatalogGameItem,
} from "@/components/game-catalog";
import { MontaHDStrip } from "@/components/montahd-strip";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { isPortfolioAdmin } from "@/lib/admin";
import { loadAcervo } from "@/lib/games";
import { userHasCatalogAccess } from "@/lib/subscription";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "MontaHD — Downloads de jogos de Xbox 360",
  description:
    "Acervo de jogos de Xbox 360 para download. O app MontaHD baixa, descompacta e organiza cada jogo na pasta certa do seu HD.",
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

  const items: CatalogGameItem[] = games.map((game) => ({
    id: game.id,
    slug: game.slug,
    label: game.label,
    coverUrl: game.coverUrl,
    sizeBytes: game.totalBytes,
    extraCount: game.extraCount,
    collectionSlug: game.collectionSlug,
    collectionTitle: game.collectionTitle,
    platform: game.platform,
  }));

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
            Xbox 360
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Downloads de jogos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Navegue pelo acervo, abra a página do jogo e instale no HD pelo app
            MontaHD.
          </p>
        </div>

        <MontaHDStrip hasAccess={hasAccess} />

        <div className="mt-10">
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
      </main>
    </>
  );
}
