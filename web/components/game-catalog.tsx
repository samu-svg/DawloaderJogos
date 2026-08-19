"use client";

import { useMemo, useState } from "react";
import { GameCard } from "@/components/game-card";
import { gameInitialGroup } from "@/lib/catalog-shared";
import { formatBytes } from "@/lib/manifest";

export type CatalogGameItem = {
  id: string;
  slug: string;
  label: string;
  coverUrl: string | null;
  sizeBytes: number;
  extraCount: number;
  collectionSlug: string;
  collectionTitle: string;
  platform: string;
};

export type CatalogCollectionItem = {
  slug: string;
  title: string;
  gameCount: number;
};

type GameCatalogProps = {
  games: CatalogGameItem[];
  collections: CatalogCollectionItem[];
  initialCollection?: string | null;
};

type SortMode = "az" | "za" | "maiores";

const PAGE_SIZE = 30;
const LETTERS = ["#", ...Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
)];

export function GameCatalog({
  games,
  collections,
  initialCollection = null,
}: GameCatalogProps) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState<string | null>(initialCollection);
  const [letter, setLetter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("az");
  const [page, setPage] = useState(1);

  const availableLetters = useMemo(() => {
    const set = new Set(games.map((game) => gameInitialGroup(game.label)));
    return LETTERS.filter((item) => set.has(item));
  }, [games]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = games.filter((game) => {
      if (collection && game.collectionSlug !== collection) return false;
      if (letter && gameInitialGroup(game.label) !== letter) return false;
      if (query && !game.label.toLowerCase().includes(query)) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (sort === "maiores") return b.sizeBytes - a.sizeBytes;
      const comparison = a.label.localeCompare(b.label, "pt-BR");
      return sort === "za" ? -comparison : comparison;
    });
  }, [games, search, collection, letter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shown = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const totalBytes = filtered.reduce((sum, game) => sum + game.sizeBytes, 0);

  function update(action: () => void) {
    action();
    setPage(1);
  }

  return (
    <section id="jogos" className="scroll-mt-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <input
            type="search"
            value={search}
            onChange={(event) => update(() => setSearch(event.target.value))}
            placeholder="Buscar jogo por nome..."
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-center text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent sm:max-w-md"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Ordenar:</span>
            <select
              value={sort}
              onChange={(event) =>
                update(() => setSort(event.target.value as SortMode))
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="maiores">Maiores primeiro</option>
            </select>
          </div>
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
              Todas as coleções ({games.length})
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
                {item.title} ({item.gameCount})
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

      <p className="mt-4 text-center text-sm text-zinc-500">
        {filtered.length} jogo(s)
        {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
        {totalPages > 1 ? ` · página ${currentPage} de ${totalPages}` : ""}
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-14 text-center">
          <p className="text-zinc-500">
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
                title={game.label}
                slug={game.slug}
                coverUrl={game.coverUrl}
                sizeBytes={game.sizeBytes}
                platform={game.platform}
                extraCount={game.extraCount}
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
