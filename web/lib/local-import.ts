/** URL fictícia no manifesto — o app copia uma pasta local em vez de baixar. */
export const LOCAL_IMPORT_URL = "local://import";

export const PASTA_LOCAL_GROUP = "pasta-local";

export function isLocalImportUrl(url: string): boolean {
  return url === LOCAL_IMPORT_URL || url.startsWith("local://");
}

export function isPastaLocalGroup(group: string | null | undefined): boolean {
  return group === PASTA_LOCAL_GROUP;
}

/** URL usada no manifesto para o app desktop (sempre importação local). */
export function manifestDownloadUrl(
  group: string | null | undefined,
  externalUrl: string | null | undefined,
): string | null {
  if (isPastaLocalGroup(group)) return LOCAL_IMPORT_URL;
  return externalUrl ?? null;
}
