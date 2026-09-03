"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpenMontaHDButton } from "@/components/open-montahd-button";
import type {
  CatalogCollectionItem,
  CatalogGameItem,
} from "@/components/game-catalog";
import { GameStoreCard } from "@/components/game-store-card";
import { entryIdsForSelectedGames } from "@/lib/catalog-shared";
import { compareCatalogGames } from "@/lib/catalog-sort";
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

function FilterChip({
  active,
  onClick,
  children,
  tone = "accent",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "accent" | "weekly";
}) {
  const activeClass =
    tone === "weekly"
      ? "bg-amber-500 text-black"
      : "bg-accent text-white";
  const idleClass =
    tone === "weekly"
      ? "border border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-amber-200"
      : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? activeClass : idleClass
      }`}
    >
      {children}
    </button>
  );
}

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

  const collectionGames = useMemo(
    () =>
      activeCollection
        ? games.filter((game) => game.collectionSlug === activeCollection.slug)
        : [],
    [games, activeCollection],
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
    return [...matchedGames].sort((a, b) => compareCatalogGames(a, b, sort));
  }, [matchedGames, sort]);

  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setSelectedGameIds(new Set());
  }, [activeCollection?.slug]);

  if (!activeCollection) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-surface/40 p-12 text-center">
        <p className="text-sm text-zinc-500">
          Nenhuma coleção disponível no momento.
        </p>
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
    <div className="space-y-6 pb-40">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
          Meu acervo
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {activeCollection.title}
            </h1>
            {activeCollection.description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                {activeCollection.description}
              </p>
            )}
          </div>
          <p className="shrink-0 text-sm text-zinc-500">
            {matchedGames.length}{" "}
            {matchedGames.length === 1 ? "título" : "títulos"}
            {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
          </p>
        </div>
      </header>

      {collections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {collections.map((collection) => {
            const active = collection.slug === activeCollection.slug;
            return (
              <button
                key={collection.slug}
                type="button"
                onClick={() =>
                  router.push(`/baixar?catalog=${collection.slug}`)
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : "border border-border bg-surface/70 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {collection.title}
                <span className="ml-1.5 text-xs opacity-70">
                  {collection.gameCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-4 rounded-[28px] border border-border/80 bg-surface/70 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Buscar jogo</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar no acervo…"
              className="w-full rounded-2xl border border-border bg-background py-2.5 pl-4 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="shrink-0">Ordenar</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            >
              <option value="populares">Mais populares</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="maiores">Maiores primeiro</option>
            </select>
          </label>
        </div>

        {(weeklyCount > 0 || availableCategories.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {weeklyCount > 0 && (
              <>
                <FilterChip
                  active={!weeklyOnly}
                  onClick={() => setWeeklyOnly(false)}
                >
                  Todos os jogos
                </FilterChip>
                <FilterChip
                  active={weeklyOnly}
                  onClick={() => setWeeklyOnly(true)}
                  tone="weekly"
                >
                  {weeklyGamesLabel()}
                </FilterChip>
              </>
            )}
            {availableCategories.length > 0 && (
              <>
                <FilterChip
                  active={category === null}
                  onClick={() => setCategory(null)}
                >
                  Todas as categorias
                </FilterChip>
                {availableCategories.map((item) => (
                  <FilterChip
                    key={item}
                    active={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {categoryLabel(item)}
                  </FilterChip>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {matchedGames.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <p className="text-base font-medium text-white">Nenhum jogo aqui</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            {search || category || weeklyOnly
              ? "Nada corresponde a esses filtros. Limpe a busca ou escolha outra categoria."
              : "Esta coleção ainda não tem jogos."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/60 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-zinc-200">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setAllSelected(event.target.checked)}
                className="size-4 rounded accent-accent"
              />
              Selecionar todos
            </label>
            <p className="text-sm text-zinc-500">
              {selectedCount} de {matchedGames.length} selecionado
              {selectedCount === 1 ? "" : "s"}
              {selectedTotalBytes > 0
                ? ` · ${formatBytes(selectedTotalBytes)}`
                : ""}
            </p>
          </div>

          <p className="text-xs leading-5 text-zinc-500">
            Clique na capa para marcar. Em seguida use{" "}
            <strong className="font-medium text-zinc-300">Instalar no HD</strong>{" "}
            para enviar a seleção ao app.
          </p>

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
                  className="block text-center text-[11px] font-medium text-zinc-500 transition hover:text-white"
                >
                  Ver detalhes
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
