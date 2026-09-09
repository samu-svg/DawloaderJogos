"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { buildMontaHDCatalogLink } from "@/lib/montahd-link";
import { launchMontaHdProtocol } from "@/lib/launch-montahd";
import { InstallOnHdControls } from "@/components/install-on-hd-controls";
import { FREE_PLAN_NAME, PAID_PLAN_NAME, PLAN_SOFTWARE_LINE, freePlanSummary } from "@/lib/plan-copy";

type GameInstallPanelProps = {
  siteUrl: string;
  collectionSlug: string;
  entryIds: string[];
  gameTitle: string;
  gamePath: string;
  access: "anon" | "sem-assinatura" | "liberado";
  isUtility?: boolean;
};

export function GameInstallPanel({
  siteUrl,
  collectionSlug,
  entryIds,
  gameTitle,
  gamePath,
  access,
  isUtility = false,
}: GameInstallPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const lastDeepLink = useRef<string | null>(null);
  const nextParam = encodeURIComponent(gamePath);

  async function install() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/install-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: collectionSlug, entryIds }),
      });

      const data = (await response.json()) as {
        error?: string;
        code?: string;
        session?: string | null;
      };

      if (response.status === 401) {
        window.location.href = `/login?next=${nextParam}`;
        return;
      }

      if (response.status === 403) {
        if (data.code === "PASSWORD_EXPIRED") {
          window.location.href = "/conta";
          return;
        }
        if (data.code === "PAID_REQUIRED") {
          window.location.href = `/assinar?next=${nextParam}`;
          return;
        }
        throw new Error(data.error ?? "Não foi possível preparar o download.");
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível preparar o download.");
      }

      const deepLink = buildMontaHDCatalogLink(
        siteUrl,
        collectionSlug,
        entryIds,
        { installSession: data.session ?? null },
      );
      lastDeepLink.current = deepLink;
      launchMontaHdProtocol(deepLink);
      setLaunched(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao iniciar download.",
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

  if (access === "anon") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent-muted p-6 text-center">
        <h2 className="text-base font-semibold text-white">
          Baixar {gameTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Entre na sua conta e instale este jogo no HD pelo MontaHD. No plano{" "}
          {FREE_PLAN_NAME}: {freePlanSummary()} {PLAN_SOFTWARE_LINE}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/cadastro?next=${nextParam}`}
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Criar conta
          </Link>
          <Link
            href={`/login?next=${nextParam}`}
            className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  const limited = access === "sem-assinatura";

  return (
    <div
      className={`rounded-2xl p-6 text-center ${
        limited
          ? "border border-accent/30 bg-accent-muted"
          : "border border-emerald-500/30 bg-emerald-500/10"
      }`}
    >
      <h2 className="text-base font-semibold text-white">Baixar {gameTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        {isUtility
          ? "Abre o MontaHD com este utilitário marcado. O app grava o .rar na raiz do HD e só baixa se o pack ainda não estiver lá."
          : limited
            ? `Abre o MontaHD com este jogo no plano ${FREE_PLAN_NAME}: ${freePlanSummary()} Assine o ${PAID_PLAN_NAME} para lote e velocidade máxima.`
            : "Abre o MontaHD já com este jogo marcado. Escolha a pasta raiz do seu HD e confirme — o app baixa, verifica e descompacta sozinho."}
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}
      <InstallOnHdControls
        loading={loading}
        launched={launched}
        onInstall={() => void install()}
        onRetry={retryLaunch}
      />
      {limited ? (
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Quer vários jogos de uma vez e velocidade máxima?{" "}
          <Link
            href={`/assinar?next=${nextParam}`}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Assinar {PAID_PLAN_NAME}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
