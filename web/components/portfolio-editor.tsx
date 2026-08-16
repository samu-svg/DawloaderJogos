"use client";

import { useActionState } from "react";
import { AddGamePackageForm } from "@/components/add-game-package-form";
import {
  deletePortfolioForm,
  deleteEntryForm,
  updatePortfolio,
  type ActionResult,
} from "@/lib/actions/portfolios";
import { formatBytes } from "@/lib/manifest";
import type { EntryRow, PortfolioRow } from "@/lib/database.types";

type FormState = ActionResult | null;

function ErrorBanner({ state }: { state: FormState }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {state.error}
    </p>
  );
}

function SuccessBanner({ state }: { state: FormState }) {
  if (!state?.ok) return null;
  return (
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
      Alterações salvas.
    </p>
  );
}

function groupLabel(group: string | null): string | null {
  if (group === "jogo") return "Jogo";
  if (group === "conteudo") return "DLC / Content";
  if (group === "pasta-local") return "Pasta local (TeraBox)";
  return group;
}

export function PortfolioEditor({
  portfolio,
  entries,
}: {
  portfolio: PortfolioRow;
  entries: EntryRow[];
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState(
    async (_prev: FormState, formData: FormData) =>
      updatePortfolio(portfolio.slug, formData),
    null,
  );

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Configurações</h2>
        <form action={settingsAction} className="mt-4 space-y-4">
          <ErrorBanner state={settingsState} />
          <SuccessBanner state={settingsState} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Título</span>
            <input
              name="title"
              required
              defaultValue={portfolio.title}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Descrição</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={portfolio.description ?? ""}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_public"
              defaultChecked={portfolio.is_public}
              className="rounded"
            />
            Portfólio público
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={settingsPending}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {settingsPending ? "Salvando..." : "Salvar"}
            </button>
            <a
              href={`/api/portfolios/${portfolio.slug}/manifest`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-zinc-600 underline dark:text-zinc-400"
            >
              Ver manifesto
            </a>
          </div>
        </form>
        <form
          action={deletePortfolioForm.bind(null, portfolio.slug)}
          className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800"
          onSubmit={(event) => {
            if (
              !confirm(
                "Excluir este portfólio e todos os arquivos cadastrados nele?",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Excluir portfólio
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Arquivos</h2>
          <span className="text-sm text-zinc-500">{entries.length} item(ns)</span>
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Nenhum arquivo ainda. Adicione o primeiro abaixo.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{entry.label}</p>
                  <p className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
                    {entry.destination}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{entry.external_url}</p>
                  <p className="text-xs text-zinc-500">
                    {formatBytes(entry.size_bytes)}
                    {entry.is_optional ? " · opcional" : ""}
                    {groupLabel(entry.group_name)
                      ? ` · ${groupLabel(entry.group_name)}`
                      : ""}
                  </p>
                </div>
                <form action={deleteEntryForm.bind(null, portfolio.slug, entry.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Adicionar jogo</h2>
        <AddGamePackageForm slug={portfolio.slug} />
      </section>
    </div>
  );
}
