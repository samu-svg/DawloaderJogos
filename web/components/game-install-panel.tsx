"use client";

import Link from "next/link";
import { useState } from "react";
import { buildMontaHDCatalogLink } from "@/lib/montahd-link";
import { getDesktopDownloadInfo } from "@/lib/desktop-download";

type GameInstallPanelProps = {
  siteUrl: string;
  collectionSlug: string;
  entryIds: string[];
  gameTitle: string;
  access: "anon" | "sem-assinatura" | "liberado";
};

export function GameInstallPanel({
  siteUrl,
  collectionSlug,
  entryIds,
  gameTitle,
  access,
}: GameInstallPanelProps) {
  const download = getDesktopDownloadInfo();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function install() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/install-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: collectionSlug, entryIds }),
      });

      if (response.status === 403) {
        window.location.href = "/assinar?next=/";
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Não foi possível preparar o download.");
      }

      const data = (await response.json()) as { session?: string | null };
      window.location.href = buildMontaHDCatalogLink(
        siteUrl,
        collectionSlug,
        entryIds,
        { installSession: data.session ?? null },
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao iniciar download.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (access === "anon") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent-muted p-6 text-center">
        <h2 className="text-base font-semibold text-white">
          Baixar {gameTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          O download é feito pelo app MontaHD, que instala o jogo direto na
          pasta certa do HD. Crie sua conta e assine o software — os arquivos
          não são vendidos separadamente.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/cadastro?next=/assinar"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Criar conta
          </Link>
          <Link
            href="/app"
            className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            Como o app funciona
          </Link>
        </div>
      </div>
    );
  }

  if (access === "sem-assinatura") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent-muted p-6 text-center">
        <h2 className="text-base font-semibold text-white">
          Baixar {gameTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Assine o software MontaHD para baixar este e qualquer outro jogo do
          acervo. Você paga pelo app, não pelos arquivos.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/assinar?next=/"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Liberar o app
          </Link>
          <Link
            href="/app"
            className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            Ver detalhes do app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
      <h2 className="text-base font-semibold text-white">Baixar {gameTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        Abre o MontaHD já com este jogo marcado. Escolha a pasta raiz do seu HD
        (vinculado à assinatura) e confirme — o app baixa, verifica e descompacta sozinho.
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void install()}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Preparando..." : "Instalar no HD"}
        </button>
        <a
          href={download.href}
          download={download.fileName}
          className="text-sm text-zinc-400 underline-offset-2 hover:text-white hover:underline"
        >
          Ainda não tenho o app ({download.version})
        </a>
      </div>
    </div>
  );
}
