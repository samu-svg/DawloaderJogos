"use client";

import { useEffect, useState } from "react";
import {
  getDesktopBuild,
  getDesktopBuilds,
  type DesktopBuildId,
  type DesktopBuildInfo,
} from "@/lib/desktop-download";
import { detectWindowsBuildIdFromNavigator } from "@/lib/windows-build";

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
}: {
  compact?: boolean;
}) {
  const [suggested, setSuggested] = useState<DesktopBuildId>("win10-x64");

  useEffect(() => {
    setSuggested(detectWindowsBuildIdFromNavigator());
  }, []);

  const builds = getDesktopBuilds();

  return (
    <div className={compact ? "w-full max-w-md space-y-2" : "w-full max-w-lg space-y-2"}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Escolha o instalador do seu Windows
      </p>
      <ul className="space-y-2">
        {builds.map((build) => (
          <li key={build.id}>
            <BuildRow
              build={build}
              suggested={build.id === suggested}
              compact={compact}
            />
          </li>
        ))}
      </ul>
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
