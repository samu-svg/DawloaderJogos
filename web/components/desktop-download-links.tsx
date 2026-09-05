"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getDesktopBuild,
  getDesktopBuilds,
  type DesktopBuildId,
  type DesktopBuildInfo,
} from "@/lib/desktop-download";
import { detectWindowsBuildIdFromNavigator } from "@/lib/windows-build";

function BuildTile({
  build,
  suggested,
}: {
  build: DesktopBuildInfo;
  suggested: boolean;
}) {
  return (
    <a
      href={build.href}
      download={build.fileName}
      className={
        suggested
          ? "flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 transition hover:border-accent hover:bg-accent/25"
          : "flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-black/20 px-3 py-2 transition hover:border-zinc-500 hover:bg-white/5"
      }
    >
      <span className="min-w-0 text-left">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-[13px] font-semibold leading-5 text-white">
            {build.title}
          </span>
          {suggested && (
            <span className="rounded-full bg-accent/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-accent-hover">
              Sugerido
            </span>
          )}
          {build.preview && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-200">
              Nova
            </span>
          )}
        </span>
        <span className="block text-[11px] text-zinc-500">
          v{build.version} · {build.sizeLabel}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-accent-hover">
        Baixar
      </span>
    </a>
  );
}

function BuildRow({
  build,
  suggested,
  compact,
}: {
  build: DesktopBuildInfo;
  suggested: boolean;
  compact: boolean;
}) {
  return (
    <a
      href={build.href}
      download={build.fileName}
      className={
        suggested
          ? "flex items-start justify-between gap-3 rounded-xl border border-accent/40 bg-accent/15 px-3.5 py-3 transition hover:border-accent hover:bg-accent/25"
          : "flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-black/20 px-3.5 py-3 transition hover:border-zinc-500 hover:bg-white/5"
      }
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-white">{build.title}</span>
          {suggested && (
            <span className="rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-hover">
              Sugerido
            </span>
          )}
          {build.preview && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Nova
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-400">
          {build.detail}
        </span>
        <span className="mt-0.5 block text-[11px] text-zinc-500">
          v{build.version} · {build.sizeLabel}
        </span>
      </span>
      <span
        className={
          compact
            ? "shrink-0 self-center text-xs font-semibold text-accent-hover"
            : "shrink-0 self-center rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
        }
      >
        Baixar
      </span>
    </a>
  );
}

export function DesktopDownloadPicker({
  compact = false,
  variant = "full",
}: {
  compact?: boolean;
  variant?: "full" | "strip" | "inline";
}) {
  const [suggested, setSuggested] = useState<DesktopBuildId>("win10-x64");

  useEffect(() => {
    setSuggested(detectWindowsBuildIdFromNavigator());
  }, []);

  const builds = getDesktopBuilds();

  if (variant === "inline") {
    return (
      <ul className="flex flex-wrap items-center gap-1.5">
        {builds.map((build) => (
          <li key={build.id}>
            <a
              href={build.href}
              download={build.fileName}
              className={
                build.id === suggested
                  ? "inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/20 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent/30"
                  : "inline-flex items-center gap-1.5 rounded-lg border border-border bg-black/20 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              }
            >
              {build.title.replace("Windows ", "Win ")}
              {build.preview ? (
                <span className="text-[9px] uppercase text-amber-200">Nova</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  const strip = variant === "strip" || compact;

  if (strip) {
    return (
      <div className={compact ? "w-full max-w-md space-y-2" : "w-full space-y-2"}>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {builds.map((build) => (
            <li key={build.id}>
              <BuildTile build={build} suggested={build.id === suggested} />
            </li>
          ))}
        </ul>
        <p className="text-[11px] leading-4 text-zinc-500">
          Versões <span className="font-semibold text-amber-200">Nova</span> ainda
          podem falhar.{" "}
          <Link
            href="/suporte"
            className="font-semibold text-zinc-300 underline underline-offset-2 hover:text-white"
          >
            Suporte em 24h
          </Link>
          . No Windows, se aparecer o aviso de proteção, use Mais informações →
          Executar assim mesmo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Escolha o instalador do seu Windows
      </p>
      <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3 text-xs leading-5 text-emerald-100/90">
        O aplicativo é totalmente seguro. Se o Google ou o Chrome bloquear o
        download, clique em{" "}
        <strong className="font-semibold text-white">Manter</strong> ou{" "}
        <strong className="font-semibold text-white">Aceitar</strong>. No
        Windows, se aparecer “O Windows protegeu o computador”, escolha{" "}
        <strong className="font-semibold text-white">Mais informações</strong> e
        depois{" "}
        <strong className="font-semibold text-white">Executar assim mesmo</strong>.
      </p>
      <ul className="space-y-2">
        {builds.map((build) => (
          <li key={build.id}>
            <BuildRow
              build={build}
              suggested={build.id === suggested}
              compact={false}
            />
          </li>
        ))}
      </ul>
      <p
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-5 text-amber-100/90"
        role="note"
      >
        As versões marcadas como{" "}
        <strong className="font-semibold text-amber-50">Nova</strong> (32-bit e
        Windows 7/8/8.1) ainda podem apresentar instabilidade. Se algo não
        funcionar,{" "}
        <Link
          href="/suporte"
          className="font-semibold text-white underline underline-offset-2 hover:text-amber-100"
        >
          fale com o suporte
        </Link>{" "}
        — resolvemos em até 24 horas.
      </p>
    </div>
  );
}

export function DesktopDownloadFallbackLink({
  className,
}: {
  className: string;
}) {
  const [id, setId] = useState<DesktopBuildId>("win10-x64");

  useEffect(() => {
    setId(detectWindowsBuildIdFromNavigator());
  }, []);

  const build = getDesktopBuild(id);
  return (
    <a href={build.href} download={build.fileName} className={className}>
      Baixar MontaHD {build.version} ({build.sizeLabel})
    </a>
  );
}
