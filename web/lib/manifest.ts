export const MANIFEST_VERSION = 1 as const;

/** Maximum length of a destination path, in characters. */
const MAX_DESTINATION_LENGTH = 200;
/** Maximum number of nested folders in a destination path. */
const MAX_DESTINATION_DEPTH = 12;

/**
 * Windows refuses to create files with these names in any directory, with or
 * without an extension. A manifest containing one would fail mid-download.
 */
const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const ILLEGAL_CHARACTERS = /[<>:"|?*\u0000-\u001f]/;

export type EntrySource =
  | { kind: "hosted"; storageKey: string }
  | { kind: "external"; url: string };

export type ManifestEntryKind = "hosted" | "external";

export function normalizeManifestSha256(
  value: string | null | undefined,
): string | undefined {
  const hash = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(hash) ? hash : undefined;
}

export interface ManifestEntry {
  id: string;
  /** Human readable name shown in the client before confirming. */
  label: string;
  /** Path relative to the root folder the user picks. Always uses "/". */
  destination: string;
  sizeBytes: number;
  kind?: ManifestEntryKind;
  /** Lowercase hex SHA-256. Absent means the client cannot verify the file. */
  sha256?: string;
  /** Entries the user may skip, e.g. optional extras. */
  optional?: boolean;
  /** Free-form grouping used only for display. */
  group?: string;
}

export interface ResolvedManifestEntry extends ManifestEntry {
  /** Ready-to-use download URL. Expires for hosted files. */
  downloadUrl: string;
}

export interface Manifest {
  version: typeof MANIFEST_VERSION;
  portfolio: {
    slug: string;
    title: string;
    description: string | null;
    updatedAt: string;
  };
  totalBytes: number;
  /** When the hosted download URLs stop working; the client refetches after this. */
  expiresAt: string;
  entries: ResolvedManifestEntry[];
}

/**
 * Same shape as {@link Manifest} minus the download URLs, served to callers
 * that may see what the catalog contains but are not authorized to fetch the
 * bytes — currently a browser session, which cannot prove an HD binding.
 */
export interface ManifestPreview extends Omit<Manifest, "entries"> {
  entries: ManifestEntry[];
}

/** Drops signed URLs so a metadata-only response cannot be reused as a download list. */
export function omitDownloadUrls(entries: ResolvedManifestEntry[]): ManifestEntry[] {
  return entries.map(({ downloadUrl: _downloadUrl, ...entry }) => entry);
}

export type PathValidation =
  | { ok: true; destination: string }
  | { ok: false; error: string };

/**
 * Validates and normalizes a destination path.
 *
 * Everything the client writes lands under a root folder the user picks, so a
 * path that escapes that root is the difference between a downloader and a
 * malware dropper. Rejection happens here, on write, and again in the client
 * before any bytes touch the disk.
 */
export function validateDestination(input: string): PathValidation {
  const raw = input.trim();

  if (raw.length === 0) {
    return { ok: false, error: "Informe a pasta de destino." };
  }
  if (raw.length > MAX_DESTINATION_LENGTH) {
    return {
      ok: false,
      error: `O caminho passa de ${MAX_DESTINATION_LENGTH} caracteres.`,
    };
  }
  if (/^[A-Za-z]:/.test(raw)) {
    return {
      ok: false,
      error:
        "Não use letra de unidade. O caminho é relativo à pasta que a pessoa escolher.",
    };
  }

  const path = raw.replace(/\\/g, "/");

  if (path.startsWith("/")) {
    return {
      ok: false,
      error:
        "O caminho não pode começar com barra. Use algo como Games/MeuJogo.",
    };
  }

  const segments = path.split("/").filter((segment, index, all) => {
    // A single trailing slash is a harmless way to write a folder.
    return !(segment === "" && index === all.length - 1);
  });

  if (segments.length > MAX_DESTINATION_DEPTH) {
    return {
      ok: false,
      error: `São no máximo ${MAX_DESTINATION_DEPTH} pastas encadeadas.`,
    };
  }

  for (const segment of segments) {
    if (segment === "") {
      return { ok: false, error: "O caminho tem uma barra dupla ou sobrando." };
    }
    if (segment === "." || segment === "..") {
      return {
        ok: false,
        error: 'O caminho não pode conter "." nem "..".',
      };
    }
    if (ILLEGAL_CHARACTERS.test(segment)) {
      return {
        ok: false,
        error: 'Estes caracteres não são aceitos em nomes de pasta: < > : " | ? *',
      };
    }
    if (segment.endsWith(" ") || segment.endsWith(".")) {
      return {
        ok: false,
        error: `"${segment}" não pode terminar com espaço ou ponto.`,
      };
    }
    const baseName = segment.split(".")[0].toLowerCase();
    if (RESERVED_WINDOWS_NAMES.has(baseName)) {
      return {
        ok: false,
        error: `"${segment}" é um nome reservado do Windows e não pode ser usado.`,
      };
    }
  }

  return { ok: true, destination: segments.join("/") };
}

/**
 * Two entries writing to the same path would silently overwrite each other on
 * the user's disk, so a manifest with duplicates is rejected as a whole.
 */
export function findDuplicateDestinations(entries: ManifestEntry[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    const key = entry.destination.toLowerCase();
    if (seen.has(key)) {
      duplicates.add(entry.destination);
    }
    seen.add(key);
  }

  return [...duplicates];
}

export function formatBytes(bytes: number): string {
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

/** Tamanho agregado em GB inteiro (ex.: 1069 GB). Abaixo de 1 GB, usa formatBytes. */
export function formatBytesDetailed(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";

  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Math.round(gb)} GB`;
  return formatBytes(bytes);
}
