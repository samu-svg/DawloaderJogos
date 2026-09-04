/**
 * Controls how aggressively the pipeline overlaps downloads and extractions.
 * - economico: 1 extract at a time; next download waits until extract finishes.
 * - equilibrado: up to 2 concurrent extracts; downloads continue if space allows.
 * - rapido: up to 5 concurrent extracts before the next download starts.
 */
export type InstallMode = "economico" | "equilibrado" | "rapido";

export const INSTALL_MODES: readonly InstallMode[] = ["economico", "equilibrado", "rapido"];

export const DEFAULT_INSTALL_MODE: InstallMode = "equilibrado";

export const RAPIDO_MAX_CONCURRENT_EXTRACTS = 5;

export const INSTALL_MODE_LABELS: Record<InstallMode, string> = {
  economico: "Pouco espaço — 1 descompactação por vez",
  equilibrado: "Equilibrado (padrão) — até 2 descompactações",
  rapido: "Rápido — até 5 descompactações em paralelo",
};

export function maxConcurrentExtracts(mode: InstallMode): number {
  switch (mode) {
    case "economico":
      return 1;
    case "equilibrado":
      return 2;
    case "rapido":
      return RAPIDO_MAX_CONCURRENT_EXTRACTS;
  }
}

export function isValidInstallMode(value: unknown): value is InstallMode {
  return typeof value === "string" && INSTALL_MODES.includes(value as InstallMode);
}

/** Limite de um arquivo no FAT32 (HD formatado pelo Xbox 360). */
export const FAT32_MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024 - 1;

/** Rótulo usado na UI (limite prático do FAT32). */
export const FAT32_LIMIT_LABEL = "4 GB";

export function largestEntryBytes(sizes: number[]): number {
  return sizes.reduce((max, size) => Math.max(max, size), 0);
}

export function isOverFat32Limit(sizeBytes: number): boolean {
  return sizeBytes > FAT32_MAX_FILE_BYTES;
}

export type DownloadTarget = "hd" | "pc";

/** Tamanho usado na decisão FAT32: o remoto prevalece sobre o catálogo. */
export function resolveKnownSize(catalogSize: number, probedSize = 0): number {
  if (probedSize > 0) return probedSize;
  return catalogSize > 0 ? catalogSize : 0;
}

/** Zip ≤ 4 GB vai direto no HD; só acima disso passa pelo PC. */
export function resolveDownloadTarget(
  catalogSize: number,
  probedSize = 0,
): DownloadTarget {
  return isOverFat32Limit(resolveKnownSize(catalogSize, probedSize)) ? "pc" : "hd";
}

/** Jogos cujo zip não cabe num único arquivo FAT32 — processar no PC. */
export function sizesNeedingPcStaging(sizes: number[]): number[] {
  return sizes.filter((size) => isOverFat32Limit(size));
}

export function largestPcStagingBytes(sizes: number[]): number {
  return largestEntryBytes(sizesNeedingPcStaging(sizes));
}

/** Soma dos N maiores pacotes (N = extrações simultâneas do modo). */
export function peakConcurrentBytes(sizes: number[], mode: InstallMode): number {
  const cap = maxConcurrentExtracts(mode);
  return [...sizes]
    .filter((size) => size > 0)
    .sort((a, b) => b - a)
    .slice(0, cap)
    .reduce((sum, size) => sum + size, 0);
}

export function peakPcStagingBytes(sizes: number[], mode: InstallMode): number {
  return peakConcurrentBytes(sizesNeedingPcStaging(sizes), mode);
}

export function peakHdInstallBytes(sizes: number[], mode: InstallMode): number {
  const hdSizes = sizes.filter((size) => size > 0 && !isOverFat32Limit(size));
  return peakConcurrentBytes(hdSizes, mode);
}

export function hdSpaceNeeded(
  sizes: number[],
  mode: InstallMode,
  retainedBytes = 0,
): number {
  return peakHdInstallBytes(sizes, mode) + Math.max(0, retainedBytes);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatSizeLabel(bytes: number): string {
  return formatBytes(bytes);
}

/** Aviso na tela de instalação conforme a seleção. */
export function installSpaceNotice(
  sizes: number[],
  mode: InstallMode = DEFAULT_INSTALL_MODE,
): string {
  const pcNeeded = largestPcStagingBytes(sizes);
  const pcPeak = peakPcStagingBytes(sizes, mode);
  const hdPeak = peakHdInstallBytes(sizes, mode);
  const hdOnly = sizes.length > 0 && pcNeeded === 0;
  const extracts = maxConcurrentExtracts(mode);
  const modeHint =
    mode === "economico"
      ? " Modo Pouco espaço: 1 descompactação por vez."
      : mode === "equilibrado"
        ? " Modo Equilibrado (padrão): até 2 descompactações ao mesmo tempo."
        : " Modo Rápido: até 5 descompactações em paralelo — o próximo download espera se já houver 5.";

  if (hdOnly || sizes.length === 0) {
    const hdHint =
      hdPeak > 0
        ? ` No HD, reserve cerca de ${formatBytes(hdPeak)} livres para as extrações simultâneas.`
        : "";
    return (
      `Jogos até ${FAT32_LIMIT_LABEL} são baixados e extraídos direto no HD ` +
      `(formato FAT32 do Xbox 360). Não usam o armazenamento do PC.${modeHint}${hdHint}`
    );
  }

  const sizeLabel = formatBytes(pcPeak > 0 ? pcPeak : pcNeeded);
  return (
    `Jogos até ${FAT32_LIMIT_LABEL} instalam direto no HD. ` +
    `Pacotes acima de ${FAT32_LIMIT_LABEL} não cabem num único arquivo FAT32 do Xbox 360: ` +
    `são processados no PC e depois copiados para o HD. ` +
    `Deixe pelo menos ${sizeLabel} livres no computador` +
    (extracts > 1
      ? ` (pico de até ${extracts} extrações ao mesmo tempo). `
      : ` (o maior jogo acima de ${FAT32_LIMIT_LABEL}). `) +
    `Os arquivos temporários do PC são apagados ao terminar.${modeHint}`
  );
}

export function notEnoughPcSpaceMessage(needed: number, free: number): string {
  return (
    `Espaço insuficiente no PC para processar jogos acima de ${FAT32_LIMIT_LABEL}. ` +
    `Livre: ${formatBytes(free)}. Necessário pelo menos ${formatBytes(needed)}. ` +
    `Libere espaço no disco do Windows e tente de novo.`
  );
}

export function notEnoughHdSpaceMessage(
  needed: number,
  free: number,
  reinstall = false,
): string {
  const reason = reinstall
    ? "para reinstalar sem apagar o jogo atual"
    : "para baixar e descompactar";
  return (
    `Espaço insuficiente no HD. Livre: ${formatBytes(free)}. ` +
    `Necessário pelo menos ${formatBytes(needed)} ${reason}. ` +
    `Libere espaço no HD e tente de novo.`
  );
}

/** Margem mínima no disco quando o tamanho do próximo pacote é desconhecido. */
export const PREFETCH_UNKNOWN_SIZE_BUFFER = 512 * 1024 * 1024;

/** Verifica se há espaço para iniciar o download do próximo jogo em paralelo. */
export function hasSpaceForPrefetch(freeBytes: number, sizeBytes: number): boolean {
  if (sizeBytes <= 0) return freeBytes >= PREFETCH_UNKNOWN_SIZE_BUFFER;
  return freeBytes >= sizeBytes;
}

/**
 * Jogos direto no HD primeiro; depois os que passam pelo PC (evita conflito USB).
 * Preserva a ordem relativa dentro de cada grupo — o primeiro da lista começa primeiro.
 */
export function orderDownloadQueue<T>(
  items: T[],
  sizeOf: (item: T) => number,
): T[] {
  const hd: T[] = [];
  const pc: T[] = [];

  for (const item of items) {
    const target = resolveDownloadTarget(sizeOf(item));
    if (target === "hd") hd.push(item);
    else pc.push(item);
  }

  return [...hd, ...pc];
}
