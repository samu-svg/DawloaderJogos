"use client";

import { useEffect, useRef, useState } from "react";
import { buildMontaHDCatalogLink } from "@/lib/montahd-link";
import { launchMontaHdProtocol } from "@/lib/launch-montahd";
import { formatBytes } from "@/lib/manifest";
import { InstallOnHdControls } from "@/components/install-on-hd-controls";

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
  const disabled = selectedCount === 0;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const lastDeepLink = useRef<string | null>(null);
  const selectionKey = `${slug}:${entryIds.join(",")}`;

  useEffect(() => {
    setLaunched(false);
    setError(null);
    lastDeepLink.current = null;
  }, [selectionKey]);

  async function installSelected() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/install-session", {
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

      const data = (await response.json()) as { session?: string | null };
      const deepLink = buildMontaHDCatalogLink(siteUrl, slug, entryIds, {
        installSession: data.session ?? null,
      });
      lastDeepLink.current = deepLink;
      launchMontaHdProtocol(deepLink);
      setLaunched(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao iniciar instalação.",
      );
    } finally {
      setLoading(false);
    }
  }

  function retryLaunch() {
    if (lastDeepLink.current) {
      launchMontaHdProtocol(lastDeepLink.current);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-3">
        {error && (
          <p className="rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="font-semibold text-white">
              {disabled
                ? "Selecione jogos para instalar"
                : selectedCount === 1
                  ? "1 jogo selecionado"
                  : `${selectedCount} jogos selecionados`}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {disabled
                ? "Marque as capas e envie a seleção ao MontaHD."
                : `${catalogTitle}${
                    selectedTotalBytes > 0
                      ? ` · ${formatBytes(selectedTotalBytes)}`
                      : ""
                  }`}
            </p>
          </div>
          <InstallOnHdControls
            layout="bar"
            loading={loading}
            launched={launched}
            disabled={disabled}
            onInstall={() => void installSelected()}
            onRetry={retryLaunch}
          />
        </div>
      </div>
    </div>
  );
}
