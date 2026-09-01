import type { ResolvedManifestEntry } from "./manifest";

export type RequestedEntry = {
  id?: unknown;
  label?: unknown;
  destination?: unknown;
};

export type RejectedEntry = {
  entryId: string;
  label: string;
  error: string;
};

export type TrustedEntryResolution = {
  entries: ResolvedManifestEntry[];
  rejected: RejectedEntry[];
};

/**
 * Rebuilds a download list from the manifest the main process fetched itself.
 *
 * The renderer legitimately decides *which* entries to install and *where* to
 * put them, so `id` and `destination` are taken from its request. Everything
 * that decides what actually gets executed on the user's disk — the download
 * URL, the entry kind and the expected hash — is read back from the trusted
 * manifest instead. Without this, a tampered renderer could point an install at
 * any host, or relabel a hosted entry as `external` to skip the SHA-256 check
 * that `assertHostedSha256` only enforces for hosted files.
 *
 * The destination is not validated here: every path that touches the disk runs
 * it through `resolveUnderRoot` first, which rejects anything escaping the root.
 */
export function resolveTrustedEntries(
  trusted: ReadonlyMap<string, ResolvedManifestEntry>,
  requested: readonly RequestedEntry[],
): TrustedEntryResolution {
  const entries: ResolvedManifestEntry[] = [];
  const rejected: RejectedEntry[] = [];
  const seen = new Set<string>();

  for (const item of requested) {
    const id = typeof item?.id === "string" ? item.id : "";
    const label = typeof item?.label === "string" ? item.label : id;

    if (!id) {
      rejected.push({
        entryId: "",
        label,
        error: "Item sem identificador. Recarregue o catálogo.",
      });
      continue;
    }

    const source = trusted.get(id);
    if (!source) {
      rejected.push({
        entryId: id,
        label,
        error: "Este item não está no catálogo carregado. Recarregue e tente de novo.",
      });
      continue;
    }

    if (seen.has(id)) continue;
    seen.add(id);

    const destination =
      typeof item.destination === "string" && item.destination.trim()
        ? item.destination.trim()
        : source.destination;

    entries.push({ ...source, destination });
  }

  return { entries, rejected };
}
