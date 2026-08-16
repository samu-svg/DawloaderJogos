"use client";

import { useActionState } from "react";
import { createPortfolio, type ActionResult } from "@/lib/actions/portfolios";
import { slugify } from "@/lib/slug";

export function NovoPortfolioForm() {
  const [state, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      createPortfolio(formData),
    null,
  );

  return (
    <form action={action} className="space-y-5">
      {!state?.ok && state && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Título</span>
        <input
          name="title"
          required
          placeholder="Ex.: Meu pacote Xbox 360"
          onChange={(event) => {
            const slugInput = document.querySelector<HTMLInputElement>(
              'input[name="slug"]',
            );
            if (slugInput && !slugInput.dataset.touched) {
              slugInput.value = slugify(event.target.value);
            }
          }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Endereço do portfólio</span>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <span className="text-sm text-zinc-500">/painel/</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
            placeholder="meu-pacote"
            onChange={(event) => {
              event.currentTarget.dataset.touched = "true";
            }}
            className="w-full bg-transparent outline-none"
          />
        </div>
        <p className="text-xs text-zinc-500">
          Letras minúsculas, números e hífens. Usado na API do manifesto.
        </p>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Descrição</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Opcional: o que este portfólio contém?"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_public" defaultChecked className="rounded" />
        Tornar público (qualquer pessoa pode baixar pelo manifesto)
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-950 px-5 py-2.5 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {pending ? "Criando..." : "Criar portfólio"}
      </button>
    </form>
  );
}
