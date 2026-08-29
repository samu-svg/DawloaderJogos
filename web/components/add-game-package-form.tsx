"use client";

import { useState, useTransition } from "react";
import { addGamePackage, type ActionResult } from "@/lib/actions/portfolios";
import type { FolderPreset } from "@/lib/install-presets";
import { formatBytes } from "@/lib/manifest";
import {
  DEFAULT_R2_PART_SIZE,
  uploadFileToR2,
  type R2UploadResult,
} from "@/lib/r2-client-upload";

type SourceMode = "r2-import" | "r2" | "external";

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
            placeholder="Ex.: Games/MeuJogo.zip"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      )}
    </>
  );
}

function SourceToggle({
  prefix,
  mode,
  onChange,
  r2Enabled,
}: {
  prefix: "game" | "extra";
  mode: SourceMode;
  onChange: (mode: SourceMode) => void;
  r2Enabled: boolean;
}) {
  if (!r2Enabled) return null;

  return (
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <input type="hidden" name={`${prefix}_source`} value={mode} />
      <button
        type="button"
        onClick={() => onChange("r2-import")}
        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
          mode === "r2-import"
            ? "border-orange-500 bg-orange-50 text-orange-900 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-200"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        }`}
      >
        Importar do R2
      </button>
      <button
        type="button"
        onClick={() => onChange("r2")}
        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
          mode === "r2"
            ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        }`}
      >
        Enviar pelo site
      </button>
      <button
        type="button"
        onClick={() => onChange("external")}
        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
          mode === "external"
            ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        }`}
      >
        Link externo
      </button>
    </div>
  );
}

export function AddGamePackageForm({
  slug,
  r2Enabled,
}: {
  slug: string;
  r2Enabled: boolean;
}) {
  const [includeExtra, setIncludeExtra] = useState(false);
  const [gameSource, setGameSource] = useState<SourceMode>(
    r2Enabled ? "r2-import" : "external",
  );
  const [extraSource, setExtraSource] = useState<SourceMode>(
    r2Enabled ? "r2-import" : "external",
  );
  const [gameFileName, setGameFileName] = useState("");
  const [extraFileName, setExtraFileName] = useState("");
  const [state, setState] = useState<ActionResult | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  async function uploadIfNeeded(
    mode: SourceMode,
    file: File | null,
    label: string,
  ): Promise<R2UploadResult | null> {
    if (mode !== "r2") return null;
    if (!file) throw new Error(`Selecione o arquivo de ${label}.`);

    setUploadLabel(`Enviando ${label} para o R2…`);
    setUploadProgress({ loaded: 0, total: file.size });

    return uploadFileToR2({
      file,
      portfolioSlug: slug,
      partSize: DEFAULT_R2_PART_SIZE,
      onProgress: (loaded, total) => setUploadProgress({ loaded, total }),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const gameFileInput = form.elements.namedItem("game_file_input") as HTMLInputElement | null;
    const extraFileInput = form.elements.namedItem("extra_file_input") as HTMLInputElement | null;

    startTransition(async () => {
      try {
        if (gameSource === "r2") {
          const uploaded = await uploadIfNeeded(
            "r2",
            gameFileInput?.files?.[0] ?? null,
            "jogo",
          );
          if (!uploaded) throw new Error("Falha ao enviar o jogo para o R2.");
          formData.set("game_storage_key", uploaded.storageKey);
          formData.set("game_size_bytes", String(uploaded.sizeBytes));
        }

        if (includeExtra && extraSource === "r2") {
          const uploaded = await uploadIfNeeded(
            "r2",
            extraFileInput?.files?.[0] ?? null,
            "extra",
          );
          if (!uploaded) throw new Error("Falha ao enviar o extra para o R2.");
          formData.set("extra_storage_key", uploaded.storageKey);
          formData.set("extra_size_bytes", String(uploaded.sizeBytes));
        }

        setUploadLabel("Salvando jogo…");
        setUploadProgress(null);
        const result = await addGamePackage(slug, formData);
        setState(result);
        if (result.ok) {
          form.reset();
          setGameFileName("");
          setExtraFileName("");
          setGameSource(r2Enabled ? "r2-import" : "external");
          setExtraSource(r2Enabled ? "r2-import" : "external");
        }
      } catch (error) {
        setState({
          ok: false,
          error: error instanceof Error ? error.message : "Erro ao enviar o arquivo.",
        });
      } finally {
        setUploadLabel(null);
        setUploadProgress(null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
      {!state?.ok && state && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          Jogo cadastrado.
        </p>
      )}

      {uploadLabel && (
        <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 sm:col-span-2 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
          <p>{uploadLabel}</p>
          {uploadProgress && uploadProgress.total > 0 && (
            <p className="font-mono text-xs">
              {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700 sm:col-span-2 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {r2Enabled ? (
          <>
            <p>
              <strong>Importar do R2</strong> — suba o arquivo com rclone/Cyberduck e informe o
              caminho no bucket (ex.: <code>jogos/Halo3.zip</code>). O site valida e cadastra no
              app.
            </p>
            <p>
              <strong>Enviar pelo site</strong> — upload direto pelo navegador (alternativa).
            </p>
            <p>
              <strong>Link externo</strong> — URL direta de outro serviço.
            </p>
          </>
        ) : (
          <>
            <p>
              Configure as credenciais R2 no servidor para enviar arquivos pela plataforma. Por
              enquanto, use um <strong>link direto</strong>.
            </p>
            <p>
              Não serve: TeraBox, MEGA, MediaFire e afins — entregam página em vez do arquivo.
            </p>
          </>
        )}
      </div>

      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Nome do jogo</span>
        <input
          name="game_title"
          required
          placeholder="Ex.: Halo 3"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Capa do jogo (opcional)</span>
        <input
          name="game_cover_url"
          type="url"
          placeholder="https://... (jpg, png ou webp)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <SourceToggle
        prefix="game"
        mode={gameSource}
        onChange={setGameSource}
        r2Enabled={r2Enabled}
      />

      {gameSource === "r2-import" ? (
        <>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Caminho no bucket R2</span>
            <input
              name="game_import_key"
              required
              placeholder="jogos/Halo3.zip"
              onChange={(event) => {
                const key = event.target.value.trim();
                const base = key.split("/").pop();
                if (base) setGameFileName(base);
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="text-xs text-zinc-500">
              Caminho dentro do bucket <code>montahd-games</code>, sem barra no início.
            </span>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Nome do arquivo no HD</span>
            <input
              name="game_file"
              required
              value={gameFileName}
              onChange={(event) => setGameFileName(event.target.value)}
              placeholder="Ex.: Halo3.zip"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </>
      ) : gameSource === "r2" ? (
        <>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Arquivo do jogo</span>
            <input
              name="game_file_input"
              type="file"
              required
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setGameFileName(file.name);
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
            />
          </label>
          <input type="hidden" name="game_file" value={gameFileName} required />
        </>
      ) : (
        <>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Arquivo do jogo</span>
            <input
              name="game_file"
              required
              placeholder="Ex.: Halo 3.zip"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Link direto do arquivo</span>
            <input
              name="game_url"
              required
              type="url"
              placeholder="https://..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </>
      )}

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

          <SourceToggle
            prefix="extra"
            mode={extraSource}
            onChange={setExtraSource}
            r2Enabled={r2Enabled}
          />

          {extraSource === "r2-import" ? (
            <>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Caminho no bucket R2</span>
                <input
                  name="extra_import_key"
                  required={includeExtra}
                  placeholder="jogos/extras/dlc.zip"
                  onChange={(event) => {
                    const key = event.target.value.trim();
                    const base = key.split("/").pop();
                    if (base) setExtraFileName(base);
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Nome do arquivo no HD</span>
                <input
                  name="extra_file"
                  required={includeExtra}
                  value={extraFileName}
                  onChange={(event) => setExtraFileName(event.target.value)}
                  placeholder="Ex.: dlcmaps.pak"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </>
          ) : extraSource === "r2" ? (
            <>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Arquivo</span>
                <input
                  name="extra_file_input"
                  type="file"
                  required={includeExtra}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setExtraFileName(file.name);
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
                />
              </label>
              <input type="hidden" name="extra_file" value={extraFileName} required={includeExtra} />
            </>
          ) : (
            <>
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
                <span className="text-sm font-medium">Link direto do arquivo</span>
                <input
                  name="extra_url"
                  required={includeExtra}
                  type="url"
                  placeholder="https://..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </>
          )}

          <FolderFields prefix="extra" defaultPreset="content" />
        </>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {pending
            ? uploadLabel ?? "Processando…"
            : gameSource === "r2"
              ? "Enviar para R2 e cadastrar"
              : gameSource === "r2-import"
                ? "Importar do R2 e cadastrar"
                : "Adicionar jogo"}
        </button>
      </div>
    </form>
  );
}
