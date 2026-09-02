"use client";

import Link from "next/link";
import { useState } from "react";
import { ABADAVATAR_PACK, specialInstallSlug } from "@/lib/special-downloads";
import { buildMontaHDCatalogLink } from "@/lib/montahd-link";
import { formatBytes } from "@/lib/manifest";

type AbadAvatarBannerProps = {
  siteUrl: string;
  loggedIn: boolean;
  hasAccess: boolean;
};

export function AbadAvatarBanner({
  siteUrl,
  loggedIn,
  hasAccess,
}: AbadAvatarBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pack = ABADAVATAR_PACK;
  const installSlug = specialInstallSlug(pack.slug);

  async function handleInstall() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/install-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: installSlug, entryIds: [pack.entryId] }),
      });

      if (response.status === 403) {
        window.location.href = "/assinar";
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Não foi possível preparar a instalação.");
      }

      const data = (await response.json()) as { session?: string | null };
      const deepLink = buildMontaHDCatalogLink(siteUrl, installSlug, [pack.entryId], {
        installSession: data.session ?? null,
      });
      window.location.href = deepLink;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao abrir o app.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 via-surface to-surface">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 100% 0%, rgba(16, 185, 129, 0.25), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0 space-y-2 text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            Utilitário Xbox 360
          </span>
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            {pack.title}{" "}
            <span className="text-emerald-300">{pack.subtitle} ✔️</span>
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-zinc-300">
            {pack.description}
          </p>
          <ul className="space-y-1 text-sm text-amber-200/90">
            {pack.requirements.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden>⚠</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            {formatBytes(pack.sizeBytes)} · gravado na raiz do HD como{" "}
            <span className="text-zinc-400">{pack.downloadFileName}</span>
          </p>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {!loggedIn ? (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Entrar para instalar
            </Link>
          ) : !hasAccess ? (
            <Link
              href="/assinar"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Assinar para instalar
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void handleInstall()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Abrindo app…" : "Instalar no HD"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
