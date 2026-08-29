/** Limite de um arquivo no FAT32 (HD formatado pelo Xbox 360). */
export const FAT32_MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024 - 1;

export function largestEntryBytes(sizes: number[]): number {
  return sizes.reduce((max, size) => Math.max(max, size), 0);
}

export function isOverFat32Limit(sizeBytes: number): boolean {
  return sizeBytes > FAT32_MAX_FILE_BYTES;
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

/** Aviso fixo: processamento no PC, depois cópia para o HD FAT32. */
export function pcSpaceWarning(largestBytes: number): string {
  const sizeLabel = largestBytes > 0 ? formatBytes(largestBytes) : "o maior jogo";
  return (
    `O download e a extração acontecem no PC e só depois o jogo é copiado para o HD ` +
    `(Xbox 360 usa FAT32 e não aceita zip acima de 4 GB). Deixe pelo menos ${sizeLabel} ` +
    `livres no disco do computador — o tamanho do maior jogo selecionado. ` +
    `Os arquivos temporários do PC são apagados quando a cópia termina.`
  );
}

export function pcSpaceShortHint(largestBytes: number): string {
  const sizeLabel = largestBytes > 0 ? formatBytes(largestBytes) : "o maior jogo";
  return (
    `Processamento no PC, depois envio ao HD. Precisa de pelo menos ${sizeLabel} livres ` +
    `no computador (não só no HD). Os temporários são apagados ao concluir.`
  );
}

export function notEnoughPcSpaceMessage(needed: number, free: number): string {
  return (
    `Espaço insuficiente no PC para processar o jogo. ` +
    `Livre: ${formatBytes(free)}. Necessário pelo menos ${formatBytes(needed)} ` +
    `(tamanho do maior jogo). Libere espaço no disco do Windows e tente de novo.`
  );
}
