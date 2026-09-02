export const DESKTOP_APP_VERSION = "0.6.12";

export const DESKTOP_SETUP_FILENAME = `MontaHD-${DESKTOP_APP_VERSION}-setup.exe`;

/** Tamanho aproximado do instalador (para exibir na UI). */
export const DESKTOP_SETUP_SIZE_LABEL = "≈ 83 MB";

export function getDesktopDownloadUrl(): string {
  const override = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim();
  if (override) return override;
  return `/downloads/${DESKTOP_SETUP_FILENAME}`;
}

export function getDesktopDownloadInfo() {
  return {
    version: DESKTOP_APP_VERSION,
    fileName: DESKTOP_SETUP_FILENAME,
    sizeLabel: DESKTOP_SETUP_SIZE_LABEL,
    href: getDesktopDownloadUrl(),
    platform: "Windows (64-bit)",
  };
}
