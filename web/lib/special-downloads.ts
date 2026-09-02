import {
  MANIFEST_VERSION,
  type Manifest,
  type ResolvedManifestEntry,
  validateDestination,
} from "@/lib/manifest";
import { downloadUrlTtl, headObjectSize, signDownloadUrl } from "@/lib/storage";

export type SpecialDownload = {
  slug: string;
  /** Id estável no manifesto do app. */
  entryId: string;
  title: string;
  subtitle: string;
  description: string;
  requirements: string[];
  storageKey: string;
  /** Nome do arquivo na raiz do HD escolhido no app. */
  downloadFileName: string;
  sizeBytes: number;
  hdPresenceMarkers?: string[];
};

const SPECIAL_INSTALL_PREFIX = "special-";

/** Slug usado no deep link e no token de manifesto (`montahd://install/special-abadavatar/...`). */
export function specialInstallSlug(packSlug: string): string {
  return `${SPECIAL_INSTALL_PREFIX}${packSlug.trim()}`;
}

export function isSpecialInstallSlug(slug: string): boolean {
  return slug.startsWith(SPECIAL_INSTALL_PREFIX);
}

export function packSlugFromInstallSlug(installSlug: string): string | null {
  if (!isSpecialInstallSlug(installSlug)) return null;
  const packSlug = installSlug.slice(SPECIAL_INSTALL_PREFIX.length).trim();
  return packSlug || null;
}

/** Pack utilitário no R2 — fora do catálogo de jogos. */
export const ABADAVATAR_PACK: SpecialDownload = {
  slug: "abadavatar",
  entryId: "abadavatar",
  title: "AbadAvatar v1.3 + AutoStart",
  subtitle: "Pack completo",
  description:
    "Utilitário para avatar e boot automático no Xbox 360. O app MontaHD grava o .rar na raiz do HD escolhido — extraia no PC e copie conforme as instruções do pack.",
  requirements: [
    "O HD deve estar formatado no Xbox no formato FAT32 antes de usar o pack.",
  ],
  storageKey: "jogos/Pack -AbadAvatar V1.3 + AutoStart Imediato !.rar",
  downloadFileName: "Pack -AbadAvatar V1.3 + AutoStart Imediato.rar",
  sizeBytes: 426_379_519,
  /** Pastas/arquivos na raiz do HD que indicam pack já copiado ou extraído. */
  hdPresenceMarkers: [
    "Pack -AbadAvatar V1.3 + AutoStart Imediato.rar",
    "AbadAvatar",
    "BadUpdate",
  ],
};

const PACKS: Record<string, SpecialDownload> = {
  [ABADAVATAR_PACK.slug]: ABADAVATAR_PACK,
};

export function getSpecialDownload(slug: string): SpecialDownload | null {
  return PACKS[slug] ?? null;
}

export function listSpecialDownloads(): SpecialDownload[] {
  return Object.values(PACKS);
}

/** Manifesto de um único arquivo na raiz do HD (sem extração automática — .rar). */
export async function buildSpecialDownloadManifest(
  pack: SpecialDownload,
  includeDownloadUrls: boolean,
): Promise<Manifest> {
  const path = validateDestination(pack.downloadFileName);
  if (!path.ok) {
    throw new Error(path.error);
  }

  let sizeBytes = pack.sizeBytes;
  try {
    sizeBytes = await headObjectSize(pack.storageKey);
  } catch {
    // mantém tamanho do catálogo estático
  }

  const downloadUrl = includeDownloadUrls
    ? await signDownloadUrl(pack.storageKey, pack.downloadFileName)
    : "";

  const entry: ResolvedManifestEntry = {
    id: pack.entryId,
    label: `${pack.title} — ${pack.subtitle}`,
    destination: path.destination,
    sizeBytes,
    kind: "external",
    group: "Utilitário",
    downloadUrl,
  };

  const expiresAt = new Date(Date.now() + downloadUrlTtl() * 1000).toISOString();

  return {
    version: MANIFEST_VERSION,
    portfolio: {
      slug: specialInstallSlug(pack.slug),
      title: pack.title,
      description: pack.description,
      updatedAt: expiresAt,
    },
    totalBytes: sizeBytes,
    expiresAt,
    entries: [entry],
  };
}
