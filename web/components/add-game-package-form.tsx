"use client";

import { useActionState, useState } from "react";
import { addGamePackage, type ActionResult } from "@/lib/actions/portfolios";
import type { FolderPreset } from "@/lib/install-presets";

function FolderFields({
  prefix,
  defaultPreset,
}: {
  prefix: "game" | "extra";
  defaultPreset: FolderPreset;
}) {
  const [preset, setPreset] = useState<FolderPreset>(defaultPreset);

  return (
    <>
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Instalar na pasta</span>
        <select
          name={`${prefix}_folder`}
          value={preset}
          onChange={(event) => setPreset(event.target.value as FolderPreset)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="games">Games — jogo (ISO)</option>
          <option value="content">Content — DLC / conteúdo extra</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>

      {preset === "content" && (
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">ID do título (Content)</span>
          <input
            name={`${prefix}_content_id`}
            defaultValue="0000000000000000"
            placeholder="16 caracteres hex, ex.: 4D5307E6"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      )}

      {preset === "custom" && (
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Caminho personalizado</span>
          <input
            name={`${prefix}_custom_path`}
            placeholder="Ex.: Games/MeuJogo.iso"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      )}
    </>
  );
}

export function AddGamePackageForm({ slug }: { slug: string }) {
  const [includeExtra, setIncludeExtra] = useState(false);
  const [state, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      addGamePackage(slug, formData),
    null,
  );

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      {!state?.ok && state && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          Jogo cadastrado. Quem baixar poderá ajustar a pasta de cada arquivo no app.
        </p>
      )}

      <p className="text-sm text-zinc-600 sm:col-span-2 dark:text-zinc-400">
        Cadastre o jogo principal e, se quiser, um segundo arquivo (DLC ou Content)
        em outra pasta do mesmo HD.
      </p>

      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Nome do jogo</span>
        <input
          name="game_title"
          required
          placeholder="Ex.: Halo 3"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Arquivo do jogo</span>
        <input
          name="game_file"
          required
          placeholder="Ex.: Halo 3.iso"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Link de download</span>
        <input
          name="game_url"
          required
          type="url"
          placeholder="https://..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <FolderFields prefix="game" defaultPreset="games" />

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="include_extra"
          checked={includeExtra}
          onChange={(event) => setIncludeExtra(event.target.checked)}
          className="rounded"
        />
        Incluir segundo arquivo (DLC ou Content em pasta diferente)
      </label>

      {includeExtra && (
        <>
          <div className="border-t border-zinc-200 pt-4 sm:col-span-2 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Arquivo extra</h3>
          </div>

          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Nome do extra</span>
            <input
              name="extra_title"
              required={includeExtra}
              placeholder="Ex.: Halo 3 — mapas DLC"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Arquivo</span>
            <input
              name="extra_file"
              required={includeExtra}
              placeholder="Ex.: dlcmaps.pak"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Link de download</span>
            <input
              name="extra_url"
              required={includeExtra}
              type="url"
              placeholder="https://..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <FolderFields prefix="extra" defaultPreset="content" />
        </>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {pending ? "Salvando..." : "Adicionar jogo"}
        </button>
      </div>
    </form>
  );
}
