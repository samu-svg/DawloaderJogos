"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OpenMontaHDButton } from "@/components/open-montahd-button";
import { GameStoreCard } from "@/components/game-store-card";
import {
  entryIdsForSelectedGames,
  groupCatalogGames,
  type CatalogPortfolioDetail,
} from "@/lib/catalog-shared";
import { formatBytes } from "@/lib/manifest";

type CatalogBrowserProps = {
  catalogs: CatalogPortfolioDetail[];
  activeSlug: string;
  siteUrl: string;
};

export function CatalogBrowser({
  catalogs,
  activeSlug,
  siteUrl,
}: CatalogBrowserProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const activeCatalog =
    catalogs.find((catalog) => catalog.slug === activeSlug) ?? catalogs[0];

  const games = useMemo(() => {
    const grouped = activeCatalog
      ? groupCatalogGames(activeCatalog.entries)
      : [];
    const query = search.trim().toLowerCase();
    if (!query) return grouped;
    return grouped.filter((game) =>
      game.label.toLowerCase().includes(query),
    );
  }, [activeCatalog, search]);

  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(
    () => new Set(games.map((game) => game.id)),
  );

  useEffect(() => {
    setSelectedGameIds(new Set(games.map((game) => game.id)));
  }, [games]);

  if (!activeCatalog) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-zinc-500">Nenhuma coleção disponível no momento.</p>
      </div>
    );
  }

  const totalBytes = games.reduce((sum, game) => sum + game.totalBytes, 0);
  const allSelected =
    games.length > 0 && games.every((game) => selectedGameIds.has(game.id));
  const selectedCount = games.filter((game) =>
    selectedGameIds.has(game.id),
  ).length;
  const selectedEntryIds = entryIdsForSelectedGames(games, selectedGameIds);
  const selectedTotalBytes = games.reduce(
    (sum, game) =>
      selectedGameIds.has(game.id) ? sum + game.totalBytes : sum,
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
      checked ? new Set(games.map((game) => game.id)) : new Set(),
    );
  }

  return (
    <div className="space-y-8 pb-28">
      <div className="space-y-6">
        <header className="page-header !mb-0">
          <p className="page-eyebrow text-accent">Meu acervo</p>
          <h1 className="page-title">{activeCatalog.title}</h1>
          {activeCatalog.description && (
            <p className="page-lead">{activeCatalog.description}</p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            {games.length} título(s)
            {totalBytes > 0 ? ` · ${formatBytes(totalBytes)} no total` : ""}
          </p>
        </header>

        {catalogs.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {catalogs.map((catalog) => (
              <button
                key={catalog.slug}
                type="button"
                onClick={() => router.push(`/baixar?catalog=${catalog.slug}`)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  catalog.slug === activeCatalog.slug
                    ? "bg-accent text-white"
                    : "border border-border bg-surface text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {catalog.title}
              </button>
            ))}
          </div>
        )}

        <div className="relative mx-auto max-w-md">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogo..."
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-4 pr-4 text-center text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <p className="text-center text-sm text-zinc-500">
          Clique nos jogos para marcar ou desmarcar. Depois use{" "}
          <strong className="font-medium text-zinc-400">Instalar no HD</strong>{" "}
          para enviar todos de uma vez ao app.
        </p>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-zinc-500">
            {search
              ? "Nenhum jogo encontrado com esse nome."
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
              {selectedCount} de {games.length} selecionado(s)
              {selectedTotalBytes > 0
                ? ` · ${formatBytes(selectedTotalBytes)}`
                : ""}
            </p>
          </div>

          <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {games.map((game) => (
              <li key={game.id}>
                <GameStoreCard
                  title={game.label}
                  coverUrl={game.coverUrl}
                  sizeBytes={game.sizeBytes}
                  selected={selectedGameIds.has(game.id)}
                  onClick={() => toggleGame(game.id)}
                  compact
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <OpenMontaHDButton
        siteUrl={siteUrl}
        slug={activeCatalog.slug}
        catalogTitle={activeCatalog.title}
        entryIds={selectedEntryIds}
        selectedCount={selectedCount}
        selectedTotalBytes={selectedTotalBytes}
      />
    </div>
  );
}
