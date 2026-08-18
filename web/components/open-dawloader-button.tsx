"use client";

import Link from "next/link";
import { buildDawloaderCatalogLink } from "@/lib/dawloader-link";
import { getDesktopDownloadInfo } from "@/lib/desktop-download";

type OpenDawloaderButtonProps = {
  siteUrl: string;
  slug: string;
  catalogTitle: string;
  entryIds: string[];
  selectedCount: number;
};

export function OpenDawloaderButton({
  siteUrl,
  slug,
  catalogTitle,
  entryIds,
  selectedCount,
}: OpenDawloaderButtonProps) {
  const deepLink = buildDawloaderCatalogLink(siteUrl, slug, entryIds);
  const download = getDesktopDownloadInfo();
  const disabled = selectedCount === 0;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
      <h2 className="text-lg font-semibold">Baixar com o Dawloader</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {disabled ? (
          <>Selecione pelo menos um jogo acima para abrir no app.</>
        ) : selectedCount === 1 ? (
          <>
            Abre o app com <strong>1 jogo</strong> de{" "}
            <strong>{catalogTitle}</strong> — escolha a pasta do HD e baixe.
          </>
        ) : (
          <>
            Abre o app com <strong>{selectedCount} jogos</strong> de{" "}
            <strong>{catalogTitle}</strong> — escolha a pasta do HD e baixe.
          </>
        )}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {disabled ? (
          <span className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-zinc-400 px-5 py-2.5 text-sm font-medium text-white">
            Abrir no Dawloader
          </span>
        ) : (
          <a
            href={deepLink}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Abrir no Dawloader
          </a>
        )}
        <Link
          href={download.href}
          download={download.fileName}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-white/60 dark:border-zinc-700 dark:hover:bg-zinc-900/40"
        >
          Baixar app ({download.version})
        </Link>
      </div>
      <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
        Na primeira vez, instale o app e abra-o uma vez. Depois o botão abre o
        Dawloader só com os jogos que você marcou.
      </p>
    </section>
  );
}
