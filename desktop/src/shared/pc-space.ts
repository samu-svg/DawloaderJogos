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

/** Jogos cujo zip não cabe num único arquivo FAT32 — processar no PC. */
export function sizesNeedingPcStaging(sizes: number[]): number[] {
  return sizes.filter((size) => isOverFat32Limit(size));
}

export function largestPcStagingBytes(sizes: number[]): number {
  return largestEntryBytes(sizesNeedingPcStaging(sizes));
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
export function installSpaceNotice(sizes: number[]): string {
  const pcNeeded = largestPcStagingBytes(sizes);
  const hdOnly = sizes.length > 0 && pcNeeded === 0;

  if (hdOnly || sizes.length === 0) {
    return (
      `Jogos até ${FAT32_LIMIT_LABEL} são baixados e extraídos direto no HD ` +
      `(formato FAT32 do Xbox 360). Não usam o armazenamento do PC.`
    );
  }

  const sizeLabel = formatBytes(pcNeeded);
  return (
    `Jogos até ${FAT32_LIMIT_LABEL} instalam direto no HD. ` +
    `Pacotes acima de ${FAT32_LIMIT_LABEL} não cabem num único arquivo FAT32 do Xbox 360: ` +
    `são processados no PC e depois copiados para o HD. ` +
    `Deixe pelo menos ${sizeLabel} livres no computador (o maior jogo acima de ${FAT32_LIMIT_LABEL}). ` +
    `Os arquivos temporários do PC são apagados ao terminar.`
  );
}

export function notEnoughPcSpaceMessage(needed: number, free: number): string {
  return (
    `Espaço insuficiente no PC para processar jogos acima de ${FAT32_LIMIT_LABEL}. ` +
    `Livre: ${formatBytes(free)}. Necessário pelo menos ${formatBytes(needed)}. ` +
    `Libere espaço no disco do Windows e tente de novo.`
  );
}
