export const DESKTOP_APP_VERSION = "0.4.0";

export const DESKTOP_PORTABLE_FILENAME = `MontaHD-${DESKTOP_APP_VERSION}-portable.exe`;

/** Tamanho aproximado do instalador portable (para exibir na UI). */
export const DESKTOP_PORTABLE_SIZE_LABEL = "≈ 74 MB";

export function getDesktopDownloadUrl(): string {
  const override = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim();
  if (override) return override;
  return `/downloads/${DESKTOP_PORTABLE_FILENAME}`;
}

export function getDesktopDownloadInfo() {
  return {
    version: DESKTOP_APP_VERSION,
    fileName: DESKTOP_PORTABLE_FILENAME,
    sizeLabel: DESKTOP_PORTABLE_SIZE_LABEL,
    href: getDesktopDownloadUrl(),
    platform: "Windows (64-bit)",
  };
}
