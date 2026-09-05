"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getDesktopBuild,
  getDesktopBuilds,
  type DesktopBuildId,
} from "@/lib/desktop-download";
import { detectWindowsBuildIdFromNavigator } from "@/lib/windows-build";

function BuildAnchor({
  id,
  className,
  children,
}: {
  id: DesktopBuildId;
  className: string;
  children: ReactNode;
}) {
  const build = getDesktopBuild(id);
  return (
    <a href={build.href} download={build.fileName} className={className}>
      {children}
    </a>
  );
}

export function DesktopDownloadPicker({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [detected, setDetected] = useState<DesktopBuildId>("win10-x64");
  const [selected, setSelected] = useState<DesktopBuildId>("win10-x64");

  useEffect(() => {
    const id = detectWindowsBuildIdFromNavigator();
    setDetected(id);
    setSelected(id);
  }, []);
  const builds = getDesktopBuilds();
  const current = getDesktopBuild(selected);
  const others = builds.filter((item) => item.id !== selected);

  return (
    <div className={compact ? "space-y-3" : "w-full max-w-md space-y-4"}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">
          {selected === detected ? "Versão sugerida para este PC" : "Versão escolhida"}
        </p>
        <p className="text-sm font-medium text-white">{current.title}</p>
        <p className="text-xs leading-5 text-zinc-500">{current.detail}</p>
        <p className="text-[11px] text-zinc-600">
          v{current.version} · {current.sizeLabel}
        </p>
      </div>

      <BuildAnchor
        id={current.id}
        className={
          compact
            ? "inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
            : "inline-flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover sm:w-auto"
        }
      >
        Baixar instalador
      </BuildAnchor>

      <details className="group">
        <summary className="cursor-pointer text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
          Outras versões do Windows
        </summary>
        <ul className="mt-2 space-y-2">
          {others.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item.id)}
                className="text-left text-xs leading-5 text-zinc-400 transition hover:text-white"
              >
                <span className="font-medium text-zinc-300">{item.title}</span>
                <span className="block text-zinc-600">{item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
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
    <BuildAnchor id={build.id} className={className}>
      Baixar MontaHD {build.version} ({build.sizeLabel})
    </BuildAnchor>
  );
}
