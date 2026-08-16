/** URL fictícia no manifesto — o app copia uma pasta local em vez de baixar. */
export const LOCAL_IMPORT_URL = "local://import";

export function isLocalImportUrl(url: string): boolean {
  return url === LOCAL_IMPORT_URL || url.startsWith("local://");
}
