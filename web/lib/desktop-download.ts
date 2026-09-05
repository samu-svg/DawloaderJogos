import type { DesktopBuildId } from "@/lib/windows-build";

export type { DesktopBuildId };

export const DESKTOP_APP_VERSION = "0.6.26";

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
};

const BUILDS: readonly DesktopBuildInfo[] = [
  {
    id: "win10-x64",
    title: "Windows 10 / 11 64-bit",
    platform: "Windows 10 / 11 (64-bit)",
    detail: "Recomendado na maioria dos PCs atuais.",
    fileName: DESKTOP_SETUP_FILENAME,
    href: `/downloads/${DESKTOP_SETUP_FILENAME}`,
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
    href: `/downloads/MontaHD-${DESKTOP_APP_VERSION}-ia32-setup.exe`,
    sizeLabel: "≈ 87 MB",
    version: DESKTOP_APP_VERSION,
  },
  {
    id: "win7-x64",
    title: "Windows 7 / 8 / 8.1 64-bit",
    platform: "Windows 7 / 8 / 8.1 (64-bit)",
    detail: "Linha legado. Precisa de SP1 e TLS 1.2 para baixar os jogos.",
    fileName: `MontaHD-${DESKTOP_APP_VERSION}-legacy-x64-setup.exe`,
    href: `/downloads/legacy/MontaHD-${DESKTOP_APP_VERSION}-legacy-x64-setup.exe`,
    sizeLabel: "≈ 71 MB",
    version: DESKTOP_APP_VERSION,
  },
  {
    id: "win7-ia32",
    title: "Windows 7 / 8 / 8.1 32-bit",
    platform: "Windows 7 / 8 / 8.1 (32-bit)",
    detail: "Linha legado. Precisa de SP1 e TLS 1.2 para baixar os jogos.",
    fileName: `MontaHD-${DESKTOP_APP_VERSION}-legacy-ia32-setup.exe`,
    href: `/downloads/legacy/MontaHD-${DESKTOP_APP_VERSION}-legacy-ia32-setup.exe`,
    sizeLabel: "≈ 68 MB",
    version: DESKTOP_APP_VERSION,
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
