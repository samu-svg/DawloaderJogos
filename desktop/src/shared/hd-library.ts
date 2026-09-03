export const HD_INDEX_VERSION = 1 as const;

export type DeletePathCheck =
  | { ok: true; destination: string }
  | { ok: false; error: string };

export interface HdLibraryHint {
  id?: string;
  label: string;
  destination: string;
  group?: string;
  sizeBytes?: number;
}

export interface HdInstalledRecord {
  id: string;
  label: string;
  destination: string;
  group?: string;
  sizeBytes?: number;
  installedAt: string;
}

export interface HdLibraryIndex {
  version: typeof HD_INDEX_VERSION;
  updatedAt: string;
  labels: HdLibraryHint[];
  items: HdInstalledRecord[];
}

export interface HdScannedItem {
  destination: string;
  sizeBytes: number;
}

export interface HdLibraryItem {
  id: string;
  label: string;
  destination: string;
  group: string;
  sizeBytes: number;
  source: "index" | "scan";
  knownName: boolean;
  titleId: string | null;
  gameName: string | null;
  detailName: string | null;
}

export type TitleIdMap = Record<string, string>;

const HEX_ID = /^[0-9a-fA-F]{8,16}$/;
const TITLE_ID = /^[0-9a-fA-F]{8}$/;
const ALL_ZEROS = /^0+$/i;

export function emptyHdIndex(): HdLibraryIndex {
  return {
    version: HD_INDEX_VERSION,
    updatedAt: new Date(0).toISOString(),
    labels: [],
    items: [],
  };
}

export function normalizeRel(input: string): string {
  return input.replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\/+/, "");
}

export function stripArchiveSuffix(destination: string): string {
  return normalizeRel(destination).replace(/\.(zip|7z|rar)$/i, "");
}

/** Pasta/arquivo que fica no HD depois da instalação (zip vira pasta sem a extensão). */
export function installedDestinationFromManifest(destination: string): string {
  return stripArchiveSuffix(destination);
}

export function destinationKey(destination: string): string {
  return stripArchiveSuffix(destination).toLowerCase();
}

export function destinationsRelated(a: string, b: string): boolean {
  const left = destinationKey(a);
  const right = destinationKey(b);
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function inferGroup(destination: string): string {
  const root = normalizeRel(destination).split("/")[0]?.toLowerCase();
  if (root === "content") return "conteudo";
  if (root === "games") return "jogo";
  return "utilitario";
}

export function titleIdFromDestination(destination: string): string | null {
  const segments = normalizeRel(destination).split("/").filter(Boolean);
  const rest = segments.slice(1);
  const eight = rest.find((segment) => TITLE_ID.test(segment) && !ALL_ZEROS.test(segment));
  if (eight) return eight.toUpperCase();
  const any = rest.find((segment) => HEX_ID.test(segment) && !ALL_ZEROS.test(segment));
  return any ? any.toUpperCase() : null;
}

/** Último segmento que não é Title ID / perfil hex (ex.: MapPack). */
export function folderDetailFromPath(destination: string): string | null {
  const segments = normalizeRel(destination).split("/").filter(Boolean);
  const rest = segments.slice(1);
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    if (!HEX_ID.test(rest[index])) return rest[index];
  }
  return null;
}

export function displayNameFromPath(destination: string): string {
  const detail = folderDetailFromPath(destination);
  if (detail) return detail;

  const titleId = titleIdFromDestination(destination);
  const segments = normalizeRel(destination).split("/").filter(Boolean);
  if (!titleId) return segments[0] ?? destination;

  const root = segments[0]?.toLowerCase();
  if (root === "content") {
    return `DLC ${titleId}`;
  }
  return titleId;
}

export function resolveScanLabel(
  destination: string,
  titleIds: TitleIdMap = {},
): { label: string; knownName: boolean; gameName: string | null; detailName: string | null } {
  const titleId = titleIdFromDestination(destination);
  const gameName = titleId ? titleIds[titleId] ?? titleIds[titleId.toLowerCase()] ?? null : null;
  const detailName = folderDetailFromPath(destination);

  if (gameName && detailName && detailName.toLowerCase() !== gameName.toLowerCase()) {
    return {
      label: `${gameName} — ${detailName}`,
      knownName: true,
      gameName,
      detailName,
    };
  }
  if (gameName) {
    return { label: gameName, knownName: true, gameName, detailName };
  }

  const label = displayNameFromPath(destination);
  return {
    label,
    knownName: !isCodeOnlyDisplayName(label),
    gameName: null,
    detailName,
  };
}

/** Label que ainda é só Title ID / DLC+hex — UI mostra tag "código". */
export function isCodeOnlyDisplayName(label: string): boolean {
  const trimmed = label.trim();
  if (HEX_ID.test(trimmed)) return true;
  return /^DLC\s+[0-9a-fA-F]{8,16}$/i.test(trimmed);
}

export function matchHint(
  destination: string,
  hints: HdLibraryHint[],
): HdLibraryHint | null {
  for (const hint of hints) {
    if (destinationsRelated(destination, hint.destination)) return hint;
  }
  return null;
}

export function shouldTreatAsInstallUnit(
  relativePath: string,
  children: { isDirectory: boolean }[],
  depth: number,
  maxDepth = 3,
): boolean {
  const rel = normalizeRel(relativePath);
  if (!rel || rel.toLowerCase() === "content" || rel.toLowerCase() === "games") {
    return false;
  }
  if (depth >= maxDepth) return true;
  if (children.length === 0) return true;
  return children.some((child) => !child.isDirectory);
}

const PROTECTED_ROOT_NAMES = new Set([
  "games",
  "content",
  "cache",
  ".montahd",
]);

export function validateDeleteDestination(input: string): DeletePathCheck {
  const destination = normalizeRel(input);
  const segments = destination.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { ok: false, error: "Informe a pasta a excluir." };
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return { ok: false, error: 'O caminho não pode conter "." nem "..".' };
  }

  const root = segments[0]?.toLowerCase();

  if (segments.length === 1) {
    if (PROTECTED_ROOT_NAMES.has(root) || root.startsWith(".")) {
      return {
        ok: false,
        error: "Não é possível excluir esta pasta do HD.",
      };
    }
    return { ok: true, destination: segments[0] };
  }

  if (root !== "games" && root !== "content") {
    return {
      ok: false,
      error: "Só é possível excluir itens nas pastas Games ou Content, ou arquivos na raiz do HD.",
    };
  }
  if (segments.length < 2) {
    return {
      ok: false,
      error: "Não é possível excluir a pasta Games ou Content inteira.",
    };
  }

  return { ok: true, destination: segments.join("/") };
}

/** Pasta/arquivo a apagar no HD a partir do destino do manifesto. */
export function deleteTargetFromManifest(destination: string): string {
  const dest = normalizeRel(destination);
  if (/\.(rar|7z)$/i.test(dest)) return dest;
  return stripArchiveSuffix(dest);
}

/** Pais que podem ser removidos se ficarem vazios — nunca Games, Content ou a raiz. */
export function emptyParentsToRemove(destination: string): string[] {
  const segments = normalizeRel(destination).split("/").filter(Boolean);
  const parents: string[] = [];
  for (let length = segments.length - 1; length >= 2; length -= 1) {
    parents.push(segments.slice(0, length).join("/"));
  }
  return parents;
}

export function upsertLabel(
  index: HdLibraryIndex,
  hint: HdLibraryHint,
): HdLibraryIndex {
  const key = destinationKey(hint.destination);
  const next: HdLibraryHint = {
    id: hint.id,
    label: hint.label,
    destination: installedDestinationFromManifest(hint.destination),
    group: hint.group,
    sizeBytes: hint.sizeBytes,
  };
  const existing = index.labels.findIndex(
    (item) => destinationKey(item.destination) === key,
  );
  if (existing >= 0) index.labels[existing] = { ...index.labels[existing], ...next };
  else index.labels.push(next);
  return index;
}

export function upsertInstalled(
  index: HdLibraryIndex,
  record: Omit<HdInstalledRecord, "installedAt"> & { installedAt?: string },
): HdLibraryIndex {
  const destination = installedDestinationFromManifest(record.destination);
  const key = destinationKey(destination);
  const item: HdInstalledRecord = {
    id: record.id,
    label: record.label,
    destination,
    group: record.group,
    sizeBytes: record.sizeBytes,
    installedAt: record.installedAt ?? new Date().toISOString(),
  };
  const existing = index.items.findIndex(
    (entry) => destinationKey(entry.destination) === key,
  );
  if (existing >= 0) index.items[existing] = { ...index.items[existing], ...item };
  else index.items.push(item);
  upsertLabel(index, item);
  index.updatedAt = item.installedAt;
  return index;
}

export function removeInstalled(
  index: HdLibraryIndex,
  destination: string,
): HdLibraryIndex {
  const key = destinationKey(destination);
  index.items = index.items.filter(
    (item) =>
      destinationKey(item.destination) !== key &&
      !destinationsRelated(item.destination, destination),
  );
  index.updatedAt = new Date().toISOString();
  return index;
}

export function parseHdIndex(raw: unknown): HdLibraryIndex {
  if (!raw || typeof raw !== "object") return emptyHdIndex();
  const data = raw as Partial<HdLibraryIndex>;
  const items = Array.isArray(data.items)
    ? data.items.filter(
        (item): item is HdInstalledRecord =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.label === "string" &&
              typeof item.destination === "string",
          ),
      )
    : [];
  const labels = Array.isArray(data.labels)
    ? data.labels.filter(
        (item): item is HdLibraryHint =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof item.label === "string" &&
              typeof item.destination === "string",
          ),
      )
    : [];
  return {
    version: HD_INDEX_VERSION,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
    labels,
    items,
  };
}

export function mergeHdLibrary(input: {
  scanned: HdScannedItem[];
  index: HdInstalledRecord[];
  hints: HdLibraryHint[];
  titleIds?: TitleIdMap;
}): HdLibraryItem[] {
  const usedScans = new Set<number>();
  const items: HdLibraryItem[] = [];
  const titleIds = normalizeTitleIdMap(input.titleIds);

  for (const record of input.index) {
    const scanIndex = input.scanned.findIndex((item) =>
      destinationsRelated(item.destination, record.destination),
    );
    if (scanIndex === -1) continue;
    usedScans.add(scanIndex);
    const scanned = input.scanned[scanIndex];
    const destination = pickListedDestination(record.destination, scanned.destination);
    items.push({
      id: record.id,
      label: record.label,
      destination,
      group: record.group || inferGroup(record.destination),
      sizeBytes: scanned.sizeBytes || record.sizeBytes || 0,
      source: "index",
      knownName: true,
      ...namesForDestination(destination, record.label, titleIds, true),
    });
  }

  for (let index = 0; index < input.scanned.length; index += 1) {
    if (usedScans.has(index)) continue;
    const scanned = input.scanned[index];
    const hint = matchHint(scanned.destination, input.hints);
    const resolved = resolveScanLabel(scanned.destination, titleIds);
    const label = hint?.label ?? resolved.label;
    items.push({
      id: hint?.id ?? `scan:${destinationKey(scanned.destination)}`,
      label,
      destination: scanned.destination,
      group: hint?.group || inferGroup(scanned.destination),
      sizeBytes: scanned.sizeBytes,
      source: "scan",
      knownName: Boolean(hint) || resolved.knownName,
      ...namesForDestination(
        scanned.destination,
        label,
        titleIds,
        Boolean(hint) || resolved.knownName,
      ),
    });
  }

  return items.sort(compareLibraryItems);
}

function normalizeTitleIdMap(titleIds: TitleIdMap | undefined): TitleIdMap {
  const next: TitleIdMap = {};
  if (!titleIds) return next;
  for (const [id, name] of Object.entries(titleIds)) {
    if (!id || !name.trim()) continue;
    next[id.toUpperCase()] = name.trim();
  }
  return next;
}

function namesForDestination(
  destination: string,
  label: string,
  titleIds: TitleIdMap,
  knownName: boolean,
): Pick<HdLibraryItem, "titleId" | "gameName" | "detailName"> {
  const titleId = titleIdFromDestination(destination);
  const mapped = titleId ? titleIds[titleId] ?? null : null;
  const detailName = folderDetailFromPath(destination);
  let gameName = mapped;
  if (!gameName && inferGroup(destination) === "jogo" && knownName && !isCodeOnlyDisplayName(label)) {
    gameName = label;
  }
  if (!gameName && label.includes(" — ")) {
    gameName = label.split(" — ")[0]?.trim() || null;
  }
  return { titleId, gameName, detailName };
}

function compareLibraryItems(a: HdLibraryItem, b: HdLibraryItem): number {
  const groupA = a.gameName || a.label;
  const groupB = b.gameName || b.label;
  const byGroup = groupA.localeCompare(groupB, "pt-BR", { sensitivity: "base" });
  if (byGroup !== 0) return byGroup;
  const byLabel = a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
  if (byLabel !== 0) return byLabel;
  return a.destination.localeCompare(b.destination, "en", { sensitivity: "base" });
}

function pickListedDestination(recordDest: string, scanDest: string): string {
  const record = installedDestinationFromManifest(recordDest);
  const scan = normalizeRel(scanDest);
  if (destinationKey(record) === destinationKey(scan)) return record;
  if (destinationKey(scan).startsWith(`${destinationKey(record)}/`)) return record;
  return scan;
}
