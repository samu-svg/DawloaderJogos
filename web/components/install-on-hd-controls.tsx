"use client";

import {
  DesktopDownloadFallbackLink,
  DesktopDownloadPicker,
} from "@/components/desktop-download-links";

type InstallOnHdControlsProps = {
  loading: boolean;
  launched: boolean;
  disabled?: boolean;
  onInstall: () => void;
  onRetry: () => void;
  layout?: "card" | "bar";
};

export function InstallOnHdControls({
  loading,
  launched,
  disabled = false,
  onInstall,
  onRetry,
  layout = "card",
}: InstallOnHdControlsProps) {
  const isBar = layout === "bar";

  const primaryClass = isBar
    ? "rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
    : "rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50";

  const linkClass = isBar
    ? "text-sm text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
    : "text-sm text-zinc-400 underline-offset-2 hover:text-white hover:underline";

  const captionClass = "text-xs font-medium text-zinc-500";

  if (launched) {
    return (
      <div
        className={
          isBar
            ? "flex max-w-xl flex-col items-center gap-3 sm:items-end"
            : "mt-5 space-y-4"
        }
      >
        <p
          className={
            isBar
              ? "text-sm leading-6 text-zinc-400 sm:text-right"
              : "text-sm leading-6 text-zinc-300"
          }
        >
          O MontaHD deve ter aberto. Não abriu? O Windows às vezes pergunta se
          pode abrir o app — aceite. Se nada acontecer, baixe o instalador.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
          <button type="button" onClick={onRetry} className={primaryClass}>
            Tentar abrir de novo
          </button>
          <DesktopDownloadFallbackLink className={linkClass} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isBar
          ? "flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-end"
          : "mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
      }
    >
      <div
        className={
          isBar
            ? "flex flex-col items-center gap-1 sm:items-end"
            : "flex flex-col items-center gap-1.5"
        }
      >
        <p className={captionClass}>Já tenho o app</p>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={onInstall}
          className={primaryClass}
        >
          {loading ? "Preparando..." : "Instalar no HD"}
        </button>
      </div>
      <div
        className={
          isBar
            ? "flex flex-col items-center gap-1 sm:items-end"
            : "flex flex-col items-center gap-1.5"
        }
      >
        <p className={captionClass}>Ainda não tenho o app</p>
        {isBar ? (
          <DesktopDownloadFallbackLink className={linkClass} />
        ) : (
          <DesktopDownloadPicker compact />
        )}
      </div>
    </div>
  );
}
