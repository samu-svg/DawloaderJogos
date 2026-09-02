"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { OpenMontaHDButton } from "@/components/open-montahd-button";
import type {
  CatalogCollectionItem,
  CatalogGameItem,
} from "@/components/game-catalog";
import { GameStoreCard } from "@/components/game-store-card";
import { entryIdsForSelectedGames } from "@/lib/catalog-shared";
import { comparePopularCatalogGames } from "@/lib/catalog-sort";
import {
  allCategoryIds,
  categoryLabel,
  gameMatchesCategory,
  type GameCategoryId,
} from "@/lib/game-categories";
import { weeklyGamesLabel } from "@/lib/weekly-games";
import { formatBytes } from "@/lib/manifest";

type CatalogBrowserProps = {
  games: CatalogGameItem[];
  collections: CatalogCollectionItem[];
  activeSlug: string;
  siteUrl: string;
  initialWeekly?: boolean;
};

type SortMode = "populares" | "az" | "za" | "maiores";

export function CatalogBrowser({
  games,
  collections,
  activeSlug,
  siteUrl,
  initialWeekly = false,
}: CatalogBrowserProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<GameCategoryId | null>(null);
  const [weeklyOnly, setWeeklyOnly] = useState(initialWeekly);
  const [sort, setSort] = useState<SortMode>("populares");

  const activeCollection =
    collections.find((collection) => collection.slug === activeSlug) ??
    collections[0];

  const pinnedGames = useMemo(
    () => games.filter((game) => game.pinned && game.collectionSlug === activeCollection?.slug),
    [games, activeCollection?.slug],
  );

  const catalogGames = useMemo(
    () => games.filter((game) => !game.pinned),
    [games],
  );

  const collectionGames = useMemo(
    () =>
      activeCollection
        ? catalogGames.filter((game) => game.collectionSlug === activeCollection.slug)
        : [],
    [catalogGames, activeCollection],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<GameCategoryId, number>();
    for (const game of collectionGames) {
      for (const item of game.categories) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
    return counts;
  }, [collectionGames]);

  const availableCategories = useMemo(
    () =>
      allCategoryIds().filter((id) => (categoryCounts.get(id) ?? 0) > 0),
    [categoryCounts],
  );

  const weeklyCount = useMemo(
    () => collectionGames.filter((game) => game.isWeekly).length,
    [collectionGames],
  );

  const matchedGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return collectionGames.filter((game) => {
      if (weeklyOnly && !game.isWeekly) return false;
      if (!gameMatchesCategory(game.categories, category)) return false;
      if (!query) return true;
      return (
        game.label.toLowerCase().includes(query) ||
        game.displayTitle.toLowerCase().includes(query)
      );
    });
  }, [collectionGames, search, category, weeklyOnly]);

  const sortedGames = useMemo(() => {
    return [...matchedGames].sort((a, b) => {
      if (sort === "maiores") return b.sizeBytes - a.sizeBytes;
      if (sort === "populares") {
        return comparePopularCatalogGames(a, b);
      }
      const comparison = a.label.localeCompare(b.label, "pt-BR");
      return sort === "za" ? -comparison : comparison;
    });
  }, [matchedGames, sort]);

  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setSelectedGameIds(new Set());
  }, [activeCollection?.slug]);

  if (!activeCollection) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-zinc-500">Nenhuma coleção disponível no momento.</p>
      </div>
    );
  }

  const totalBytes = matchedGames.reduce(
    (sum, game) => sum + game.sizeBytes,
    0,
  );
  const allSelected =
    matchedGames.length > 0 &&
    matchedGames.every((game) => selectedGameIds.has(game.id));
  const selectedCount = matchedGames.filter((game) =>
    selectedGameIds.has(game.id),
  ).length;
  const selectedEntryIds = entryIdsForSelectedGames(
    matchedGames,
    selectedGameIds,
  );
  const selectedTotalBytes = matchedGames.reduce(
    (sum, game) =>
      selectedGameIds.has(game.id) ? sum + game.sizeBytes : sum,
    0,
  );

  function toggleGame(gameId: string) {
    setSelectedGameIds((current) => {
      const next = new Set(current);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  }

  function setAllSelected(checked: boolean) {
    setSelectedGameIds(
      checked ? new Set(matchedGames.map((game) => game.id)) : new Set(),
    );
  }

  return (
    <div className="space-y-8 pb-28">
      <div className="space-y-6">
        <header className="page-header !mb-0">
          <p className="page-eyebrow text-accent">Meu acervo</p>
          <h1 className="page-title">{activeCollection.title}</h1>
          {activeCollection.description && (
            <p className="page-lead">{activeCollection.description}</p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            {matchedGames.length} título(s)
            {totalBytes > 0 ? ` · ${formatBytes(totalBytes)} no total` : ""}
          </p>
        </header>

        {collections.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {collections.map((collection) => (
              <button
                key={collection.slug}
                type="button"
                onClick={() =>
                  router.push(`/baixar?catalog=${collection.slug}`)
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  collection.slug === activeCollection.slug
                    ? "bg-accent text-white"
                    : "border border-border bg-surface text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {collection.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogo..."
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-4 pr-4 text-center text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent sm:max-w-md"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Ordenar:</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="populares">Mais populares</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="maiores">Maiores primeiro</option>
            </select>
          </div>
        </div>

        {weeklyCount > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setWeeklyOnly(false)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !weeklyOnly
                  ? "bg-accent text-white"
                  : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              Todos os jogos
            </button>
            <button
              type="button"
              onClick={() => setWeeklyOnly(true)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                weeklyOnly
                  ? "bg-amber-500 text-black"
                  : "border border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-amber-200"
              }`}
            >
              {weeklyGamesLabel()}
            </button>
          </div>
        )}

        {availableCategories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                category === null
                  ? "bg-accent text-white"
                  : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              Todas as categorias
            </button>
            {availableCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  category === item
                    ? "bg-accent text-white"
                    : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {categoryLabel(item)}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-zinc-500">
          Clique nos jogos para marcar ou desmarcar. Depois use{" "}
          <strong className="font-medium text-zinc-400">Instalar no HD</strong>{" "}
          para enviar todos de uma vez ao app.
        </p>
      </div>

      {pinnedGames.length > 0 && (
        <section className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/40 via-surface to-surface p-4 sm:p-5">
          <div className="mb-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
              Destaque
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Utilitário essencial — instale pelo app
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Abra a página do item para instalar. O app só baixa se ainda não
              estiver no HD.
            </p>
          </div>
          <ul className="mx-auto grid max-w-sm grid-cols-1 gap-4 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3">
            {pinnedGames.map((game) => (
              <li key={game.id} className="mx-auto w-full max-w-[220px]">
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
      )}

      {matchedGames.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-zinc-500">
            {search || category || weeklyOnly
              ? "Nenhum jogo encontrado com esses filtros."
              : "Esta coleção ainda não tem jogos."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-center">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setAllSelected(event.target.checked)}
                className="rounded accent-accent"
              />
              Selecionar todos
            </label>
            <p className="text-sm text-zinc-500">
              {selectedCount} de {matchedGames.length} selecionado(s)
              {selectedTotalBytes > 0
                ? ` · ${formatBytes(selectedTotalBytes)}`
                : ""}
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sortedGames.map((game) => (
              <li key={game.id} className="space-y-2">
                <GameStoreCard
                  title={game.displayTitle}
                  coverUrl={game.coverUrl}
                  sizeBytes={game.sizeBytes}
                  platform={game.platform}
                  extraCount={game.extraCount}
                  badges={game.badges}
                  selected={selectedGameIds.has(game.id)}
                  onClick={() => toggleGame(game.id)}
                  compact
                />
                <Link
                  href={`/jogo/${game.slug}`}
                  className="block text-center text-xs font-medium text-accent hover:text-accent-hover"
                >
                  Ver página
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <OpenMontaHDButton
        siteUrl={siteUrl}
        slug={activeCollection.slug}
        catalogTitle={activeCollection.title}
        entryIds={selectedEntryIds}
        selectedCount={selectedCount}
        selectedTotalBytes={selectedTotalBytes}
      />
    </div>
  );
}
