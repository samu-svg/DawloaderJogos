"use client";

import { useState } from "react";
import Link from "next/link";
import { buildMontaHDCatalogLink } from "@/lib/montahd-link";
import { getDesktopDownloadInfo } from "@/lib/desktop-download";
import { formatBytes } from "@/lib/manifest";

type OpenMontaHDButtonProps = {
  siteUrl: string;
  slug: string;
  catalogTitle: string;
  entryIds: string[];
  selectedCount: number;
  selectedTotalBytes?: number;
};

export function OpenMontaHDButton({
  siteUrl,
  slug,
  catalogTitle,
  entryIds,
  selectedCount,
  selectedTotalBytes = 0,
}: OpenMontaHDButtonProps) {
  const download = getDesktopDownloadInfo();
  const disabled = selectedCount === 0;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function installSelected() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/manifest-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, entryIds }),
      });

      if (response.status === 403) {
        window.location.href = "/assinar?next=/baixar";
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Não foi possível preparar a instalação.");
      }

      const data = (await response.json()) as { token?: string | null };
      const deepLink = buildMontaHDCatalogLink(
        siteUrl,
        slug,
        entryIds,
        data.token ?? null,
      );
      window.location.href = deepLink;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao iniciar instalação.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">
              {disabled
                ? "Selecione jogos para instalar"
                : selectedCount === 1
                  ? "1 jogo selecionado"
                  : `${selectedCount} jogos selecionados`}
            </p>
            {!disabled && (
              <p className="text-sm text-zinc-500">
                Coleção{" "}
                <strong className="text-zinc-400">{catalogTitle}</strong>
                {selectedTotalBytes > 0
                  ? ` · ${formatBytes(selectedTotalBytes)}`
                  : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={download.href}
              download={download.fileName}
              className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              App Windows
            </Link>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => void installSelected()}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Preparando..." : "Instalar no HD"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
