"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OpenDawloaderButton } from "@/components/open-dawloader-button";
import { GameCoverFrame } from "@/components/game-cover";
import {
  entryIdsForSelectedGames,
  groupCatalogGames,
  type CatalogPortfolioDetail,
} from "@/lib/catalog";
import { formatBytes } from "@/lib/manifest";

type CatalogBrowserProps = {
  catalogs: CatalogPortfolioDetail[];
  activeSlug: string;
  siteUrl: string;
};

function formatGameTitle(label: string): string {
  if (!label) return "Jogo";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function CatalogBrowser({
  catalogs,
  activeSlug,
  siteUrl,
}: CatalogBrowserProps) {
  const router = useRouter();
  const activeCatalog =
    catalogs.find((catalog) => catalog.slug === activeSlug) ?? catalogs[0];

  const games = useMemo(
    () => (activeCatalog ? groupCatalogGames(activeCatalog.entries) : []),
    [activeCatalog],
  );

  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(
    () => new Set(games.map((game) => game.id)),
  );

  useEffect(() => {
    setSelectedGameIds(new Set(games.map((game) => game.id)));
  }, [games]);

  if (!activeCatalog) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p className="text-zinc-600 dark:text-zinc-400">
          Nenhum catálogo público disponível no momento.
        </p>
      </div>
    );
  }

  const totalBytes = games.reduce((sum, game) => sum + game.totalBytes, 0);
  const allSelected =
    games.length > 0 && games.every((game) => selectedGameIds.has(game.id));
  const selectedCount = games.filter((game) => selectedGameIds.has(game.id)).length;
  const selectedEntryIds = entryIdsForSelectedGames(games, selectedGameIds);

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
      checked ? new Set(games.map((game) => game.id)) : new Set(),
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Catálogos</h1>
          {catalogs.length > 1 ? (
            <label className="mt-3 block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Trocar catálogo
              </span>
              <select
                value={activeCatalog.slug}
                onChange={(event) =>
                  router.push(`/baixar?catalog=${event.target.value}`)
                }
                className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {catalogs.map((catalog) => (
                  <option key={catalog.slug} value={catalog.slug}>
                    {catalog.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-lg font-medium">{activeCatalog.title}</p>
          )}
          {activeCatalog.description && (
            <p className="text-zinc-600 dark:text-zinc-400">
              {activeCatalog.description}
            </p>
          )}
          <p className="text-sm text-zinc-500">
            {games.length} jogo(s)
            {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
          </p>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            Este catálogo ainda não tem jogos cadastrados.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setAllSelected(event.target.checked)}
                className="rounded"
              />
              Selecionar todos
            </label>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {selectedCount} de {games.length} selecionado(s)
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game) => {
              const isSelected = selectedGameIds.has(game.id);
              return (
                <li key={game.id}>
                  <button
                    type="button"
                    onClick={() => toggleGame(game.id)}
                    aria-pressed={isSelected}
                    className={`block w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:shadow-md dark:bg-zinc-950 ${
                      isSelected
                        ? "border-zinc-950 ring-2 ring-zinc-950 dark:border-zinc-50 dark:ring-zinc-50"
                        : "border-zinc-200 opacity-80 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-full">
                      <GameCoverFrame
                        title={game.label}
                        coverUrl={game.coverUrl}
                      />
                      <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-md border border-white/80 bg-black/50 text-xs text-white backdrop-blur">
                        {isSelected ? "✓" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5 p-4">
                      <h2 className="font-semibold leading-snug">
                        {formatGameTitle(game.label)}
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {game.sizeBytes > 0
                          ? formatBytes(game.sizeBytes)
                          : "Tamanho sob consulta"}
                        {game.extraCount > 0
                          ? ` · +${game.extraCount} extra(s)`
                          : ""}
                        {game.optional ? " · opcional" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <OpenDawloaderButton
        siteUrl={siteUrl}
        slug={activeCatalog.slug}
        catalogTitle={activeCatalog.title}
        entryIds={selectedEntryIds}
        selectedCount={selectedCount}
      />
    </div>
  );
}
