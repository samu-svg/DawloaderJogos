import type { DesktopBuildId } from "./windows-build.ts";
import { isWindowsBuildId } from "./windows-build.ts";

export type { DesktopBuildId };

export function desktopDownloadApiHref(buildId: DesktopBuildId): string {
  return `/api/desktop-download?build=${encodeURIComponent(buildId)}`;
}

export const DESKTOP_APP_VERSION = "0.6.31";

export const DESKTOP_SETUP_FILENAME = `MontaHD-${DESKTOP_APP_VERSION}-setup.exe`;

/** Tamanho aproximado do instalador (para exibir na UI). */
export const DESKTOP_SETUP_SIZE_LABEL = "≈ 93 MB";

export type DesktopBuildInfo = {
  id: DesktopBuildId;
  title: string;
  platform: string;
  detail: string;
  fileName: string;
  href: string;
  sizeLabel: string;
  version: string;
  recommended?: boolean;
  /** 32-bit e Windows 7/8 — recém-lançadas, ainda em estabilização. */
  preview?: boolean;
};

const BUILDS: readonly DesktopBuildInfo[] = [
  {
    id: "win10-x64",
    title: "Windows 10 / 11 64-bit",
    platform: "Windows 10 / 11 (64-bit)",
    detail: "Recomendado na maioria dos PCs atuais.",
    fileName: DESKTOP_SETUP_FILENAME,
    href: desktopDownloadApiHref("win10-x64"),
    sizeLabel: DESKTOP_SETUP_SIZE_LABEL,
    version: DESKTOP_APP_VERSION,
    recommended: true,
  },
  {
    id: "win10-ia32",
    title: "Windows 10 / 11 32-bit",
    platform: "Windows 10 / 11 (32-bit)",
    detail: "Só para PCs 32-bit. Não instale no Windows 64-bit.",
    fileName: `MontaHD-${DESKTOP_APP_VERSION}-ia32-setup.exe`,
    href: desktopDownloadApiHref("win10-ia32"),
    sizeLabel: "≈ 87 MB",
    version: DESKTOP_APP_VERSION,
    preview: true,
  },
  {
    id: "win7-x64",
    title: "Windows 7 / 8 / 8.1 64-bit",
    platform: "Windows 7 / 8 / 8.1 (64-bit)",
    detail: "Linha legado. Precisa de SP1 e TLS 1.2 para baixar os jogos.",
    fileName: `MontaHD-${DESKTOP_APP_VERSION}-legacy-x64-setup.exe`,
    href: desktopDownloadApiHref("win7-x64"),
    sizeLabel: "≈ 71 MB",
    version: DESKTOP_APP_VERSION,
    preview: true,
  },
  {
    id: "win7-ia32",
    title: "Windows 7 / 8 / 8.1 32-bit",
    platform: "Windows 7 / 8 / 8.1 (32-bit)",
    detail: "Linha legado. Precisa de SP1 e TLS 1.2 para baixar os jogos.",
    fileName: `MontaHD-${DESKTOP_APP_VERSION}-legacy-ia32-setup.exe`,
    href: desktopDownloadApiHref("win7-ia32"),
    sizeLabel: "≈ 68 MB",
    version: DESKTOP_APP_VERSION,
    preview: true,
  },
];

export function getDesktopBuilds(): readonly DesktopBuildInfo[] {
  return BUILDS;
}

export function getDesktopBuild(id: DesktopBuildId): DesktopBuildInfo {
  const build = BUILDS.find((item) => item.id === id);
  if (!build) return BUILDS[0];
  return build;
}

export function getDesktopDownloadUrl(): string {
  const override = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim();
  if (override) return override;
  return desktopDownloadApiHref("win10-x64");
}

export function resolveDesktopBuildId(raw: string | null | undefined): DesktopBuildId | null {
  const value = raw?.trim();
  if (!value || !isWindowsBuildId(value)) return null;
  return value;
}

const INSTALLER_FILE =
  /^MontaHD-\d+\.\d+\.\d+(?:-ia32|-legacy-ia32|-legacy-x64)?-setup\.exe$/;

export function desktopInstallerR2Key(fileName: string): string {
  if (fileName.includes("-legacy-")) {
    return `installers/legacy/${fileName}`;
  }
  return `installers/${fileName}`;
}

export function isKnownInstallerFileName(fileName: string): boolean {
  if (!INSTALLER_FILE.test(fileName)) return false;
  return BUILDS.some((build) => build.fileName === fileName);
}

/** URL pública do instalador (auto-update e redirect para R2 em /downloads/). */
export function desktopBuildPublicPath(build: DesktopBuildInfo): string {
  if (build.id === "win7-x64") {
    return `/downloads/legacy/MontaHD-${build.version}-legacy-x64-setup.exe`;
  }
  if (build.id === "win7-ia32") {
    return `/downloads/legacy/MontaHD-${build.version}-legacy-ia32-setup.exe`;
  }
  if (build.id === "win10-ia32") {
    return `/downloads/MontaHD-${build.version}-ia32-setup.exe`;
  }
  return `/downloads/${DESKTOP_SETUP_FILENAME}`;
}

/** Build 64-bit atual — compatível com links e cards antigos. */
export function getDesktopDownloadInfo() {
  const override = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim();
  const recommended = BUILDS[0];
  return {
    version: recommended.version,
    fileName: recommended.fileName,
    sizeLabel: recommended.sizeLabel,
    href: override || recommended.href,
    platform: recommended.platform,
  };
}
