import { GameCard } from "@/components/game-card";
import type { CatalogGameItem } from "@/components/game-catalog";
import { FEATURED_SECTION_LIMIT } from "@/lib/featured-games";

type FeaturedGamesStripProps = {
  games: CatalogGameItem[];
};

export function FeaturedGamesStrip({ games }: FeaturedGamesStripProps) {
  const featured = games
    .filter((game) => game.featuredRank !== null)
    .sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999))
    .slice(0, FEATURED_SECTION_LIMIT);

  if (featured.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="mt-10">
      <div className="mb-5 text-center">
        <p className="page-eyebrow">Mais baixados</p>
        <h2 id="featured-heading" className="section-heading text-xl sm:text-2xl">
          Jogos em destaque
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-500">
          Os títulos mais famosos do acervo — FIFA, Call of Duty, Dragon Ball,
          Devil May Cry e outros. PT-BR e DLC aparecem na capa ou no título.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {featured.map((game) => (
          <li key={game.id}>
            <GameCard
              title={game.displayTitle}
              slug={game.slug}
              coverUrl={game.coverUrl}
              sizeBytes={game.sizeBytes}
              platform={game.platform}
              extraCount={game.extraCount}
              badges={game.badges}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
