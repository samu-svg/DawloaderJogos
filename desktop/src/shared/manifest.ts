export const MANIFEST_VERSION = 1 as const;

const MAX_DESTINATION_LENGTH = 200;
const MAX_DESTINATION_DEPTH = 12;

const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const ILLEGAL_CHARACTERS = /[<>:"|?*\u0000-\u001f]/;

export type ManifestEntryKind = "hosted" | "external";

export function normalizeManifestSha256(
  value: string | null | undefined,
): string | undefined {
  const hash = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(hash) ? hash : undefined;
}

export function assertHostedSha256(
  kind: ManifestEntryKind | undefined,
  sha256: string | undefined,
): void {
  if (kind !== "hosted") return;
  if (!normalizeManifestSha256(sha256)) {
    throw new Error(
      "Este arquivo hospedado não tem SHA-256. Recusado por segurança.",
    );
  }
}

export interface ResolvedManifestEntry {
  id: string;
  label: string;
  destination: string;
  sizeBytes: number;
  kind?: ManifestEntryKind;
  sha256?: string;
  optional?: boolean;
  group?: string;
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
  expiresAt: string;
  entries: ResolvedManifestEntry[];
}

export type PathValidation =
  | { ok: true; destination: string }
  | { ok: false; error: string };

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

export function findDuplicateDestinations(
  entries: Pick<ResolvedManifestEntry, "destination">[],
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    const key = entry.destination.toLowerCase();
    if (seen.has(key)) duplicates.add(entry.destination);
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
