"use client";

import Link from "next/link";
import { deletePortfolioForm } from "@/lib/actions/portfolios";

type PortfolioListCardProps = {
  slug: string;
  title: string;
  description: string | null;
  isPublic: boolean;
};

export function PortfolioListCard({
  slug,
  title,
  description,
  isPublic,
}: PortfolioListCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/painel/${slug}`} className="min-w-0 flex-1">
          <h2 className="font-semibold hover:underline">{title}</h2>
        </Link>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
            isPublic
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          {isPublic ? "Público" : "Privado"}
        </span>
      </div>

      {description && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}

      <p className="mt-4 font-mono text-xs text-zinc-500">
        /api/portfolios/{slug}/manifest
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/painel/${slug}`}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Editar
        </Link>
        <form
          action={deletePortfolioForm.bind(null, slug)}
          onSubmit={(event) => {
            if (
              !confirm(
                `Excluir o portfólio «${title}» e todos os jogos cadastrados nele?`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Excluir
          </button>
        </form>
      </div>
    </article>
  );
}
