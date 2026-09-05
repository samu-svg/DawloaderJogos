"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "@/components/game-card";
import type { CatalogBadge } from "@/lib/catalog-badges";
import { compareCatalogGames } from "@/lib/catalog-sort";
import { gameInitialGroup } from "@/lib/catalog-shared";
import {
  allCategoryIds,
  categoryLabel,
  gameMatchesCategory,
  type GameCategoryId,
} from "@/lib/game-categories";
import { weeklyGamesLabel } from "@/lib/weekly-games";
import { formatBytes } from "@/lib/manifest";

export type CatalogGameItem = {
  id: string;
  slug: string;
  label: string;
  displayTitle: string;
  coverUrl: string | null;
  sizeBytes: number;
  extraCount: number;
  entryIds: string[];
  collectionSlug: string;
  installCollectionSlug: string;
  collectionTitle: string;
  platform: string;
  badges: CatalogBadge[];
  featuredRank: number | null;
  categories: GameCategoryId[];
  isWeekly: boolean;
  pinned?: boolean;
  isUtility?: boolean;
};

export type CatalogCollectionItem = {
  slug: string;
  title: string;
  description?: string | null;
  gameCount: number;
};

type GameCatalogProps = {
  games: CatalogGameItem[];
  collections: CatalogCollectionItem[];
  initialCollection?: string | null;
  initialWeekly?: boolean;
};

type SortMode = "populares" | "az" | "za" | "maiores";

const PAGE_SIZE = 30;
const LETTERS = ["#", ...Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
)];

export function GameCatalog({
  games,
  collections,
  initialCollection = null,
  initialWeekly = false,
}: GameCatalogProps) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState<string | null>(initialCollection);
  const [letter, setLetter] = useState<string | null>(null);
  const [category, setCategory] = useState<GameCategoryId | null>(null);
  const [weeklyOnly, setWeeklyOnly] = useState(initialWeekly);
  const [sort, setSort] = useState<SortMode>("populares");
  const [page, setPage] = useState(1);
  const listTopRef = useRef<HTMLElement>(null);
  const skipInitialScrollRef = useRef(true);

  const weeklyCount = useMemo(
    () => games.filter((game) => game.isWeekly).length,
    [games],
  );

  const availableLetters = useMemo(() => {
    const set = new Set(games.map((game) => gameInitialGroup(game.label)));
    return LETTERS.filter((item) => set.has(item));
  }, [games]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<GameCategoryId, number>();
    for (const game of games) {
      for (const item of game.categories) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
    return counts;
  }, [games]);

  const availableCategories = useMemo(
    () =>
      allCategoryIds().filter((id) => (categoryCounts.get(id) ?? 0) > 0),
    [categoryCounts],
  );

  const matchedGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games.filter((game) => {
      if (collection && game.collectionSlug !== collection) return false;
      if (letter && gameInitialGroup(game.label) !== letter) return false;
      if (weeklyOnly && !game.isWeekly) return false;
      if (!gameMatchesCategory(game.categories, category)) return false;
      if (query && !game.label.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [games, search, collection, letter, category, weeklyOnly]);

  const filtered = useMemo(() => {
    return [...matchedGames].sort((a, b) => compareCatalogGames(a, b, sort));
  }, [matchedGames, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shown = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const totalBytes = filtered.reduce((sum, game) => sum + game.sizeBytes, 0);

  useEffect(() => {
    if (skipInitialScrollRef.current) {
      skipInitialScrollRef.current = false;
      return;
    }
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentPage]);

  function update(action: () => void) {
    action();
    setPage(1);
  }

  return (
    <section id="jogos" ref={listTopRef} className="scroll-mt-20">
      <div className="mb-5 flex flex-col items-center gap-1 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Acervo
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {filtered.length} {filtered.length === 1 ? "jogo" : "jogos"}
            {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
            {totalPages > 1 ? ` · página ${currentPage} de ${totalPages}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/70 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => update(() => setSearch(event.target.value))}
            placeholder="Buscar jogo por nome..."
            className="w-full min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
            <span>Ordenar</span>
            <select
              value={sort}
              onChange={(event) =>
                update(() => setSort(event.target.value as SortMode))
              }
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
            >
              <option value="populares">Mais populares</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="maiores">Maiores primeiro</option>
            </select>
          </label>
        </div>

        {collections.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => update(() => setCollection(null))}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                collection === null
                  ? "bg-accent text-white"
                  : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              Todas as coleções
            </button>
            {collections.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => update(() => setCollection(item.slug))}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  collection === item.slug
                    ? "bg-accent text-white"
                    : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}

        {weeklyCount > 0 && (
          <div className="flex flex-wrap justify-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => update(() => setWeeklyOnly(false))}
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
              onClick={() => update(() => setWeeklyOnly(true))}
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
          <div className="flex flex-wrap justify-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => update(() => setCategory(null))}
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
                onClick={() => update(() => setCategory(item))}
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

        {availableLetters.length > 1 && (
          <div className="flex flex-wrap justify-center gap-1.5 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => update(() => setLetter(null))}
              className={`min-w-8 rounded-md px-2 py-1 text-xs font-semibold transition ${
                letter === null
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:bg-white/5 hover:text-white"
              }`}
            >
              Tudo
            </button>
            {availableLetters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => update(() => setLetter(item))}
                className={`min-w-8 rounded-md px-2 py-1 text-xs font-semibold transition ${
                  letter === item
                    ? "bg-accent text-white"
                    : "text-zinc-500 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <p className="text-base font-medium text-white">Nenhum jogo aqui</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            {games.length === 0
              ? "Nenhum jogo publicado ainda. Volte em breve."
              : "Nenhum jogo encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((game) => (
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
      )}

      {totalPages > 1 && (
        <nav className="mt-9 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:opacity-40"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter(
              (number) =>
                number === 1 ||
                number === totalPages ||
                Math.abs(number - currentPage) <= 1,
            )
            .map((number, index, list) => (
              <span key={number} className="flex items-center gap-2">
                {index > 0 && number - list[index - 1] > 1 && (
                  <span className="text-zinc-600">…</span>
                )}
                <button
                  type="button"
                  onClick={() => setPage(number)}
                  className={`min-w-9 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    number === currentPage
                      ? "bg-accent text-white"
                      : "border border-border text-zinc-400 hover:border-zinc-600 hover:text-white"
                  }`}
                >
                  {number}
                </button>
              </span>
            ))}
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}
    </section>
  );
}
