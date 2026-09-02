import { existsSync, statSync } from "node:fs";
import { readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import {
  destinationsRelated,
  installedDestinationFromManifest,
} from "../shared/hd-library";
import {
  classifyInstallPresence,
  HD_PARTIAL_SUFFIX,
  STAGING_PARTIAL_NAME,
  installDirForDestPath,
  type EntryInstallState,
} from "../shared/install-state";
import { deleteHdItem, readHdIndex } from "./hd-library";
import { isPathUnderRoot } from "../shared/path-safety";
import {
  hdMarkersForEntry,
  isDeliverableArchiveDestination,
} from "../shared/special-downloads";
import { resolveUnderRoot } from "./paths";
import { removeStagingEntry, stagingEntryDir } from "./staging";

const HD_META_DIR = ".montahd";

export async function inspectInstallStates(
  rootDir: string,
  entries: { id: string; label: string; destination: string }[],
  stagingRoot: string,
): Promise<EntryInstallState[]> {
  const index = await readHdIndex(rootDir);
  const found: EntryInstallState[] = [];

  for (const entry of entries) {
    const resolved = resolveUnderRoot(rootDir, entry.destination);
    if (!resolved.ok) continue;

    const destPath = resolved.fullPath;
    const installDir = installDirForDestPath(destPath);
    const destIsArchive = isDeliverableArchiveDestination(entry.destination);
    const destFileExists = existsSync(destPath) && isFile(destPath);
    const destExists = destIsArchive
      ? destFileExists
      : existsSync(installDir) && isDirectory(installDir);
    const hdPartialExists = existsSync(destPath + HD_PARTIAL_SUFFIX);
    const stagingPartialExists = existsSync(
      path.join(stagingEntryDir(stagingRoot, entry.id), STAGING_PARTIAL_NAME),
    );
    const markerPresent = hdMarkersForEntry(entry.id).some((marker) => {
      const markerResolved = resolveUnderRoot(rootDir, marker);
      if (!markerResolved.ok) return false;
      return existsSync(markerResolved.fullPath);
    });
    const deliverableOnDisk = destFileExists || markerPresent;
    const indexed = index.items.some(
      (item) =>
        (item.id === entry.id ||
          destinationsRelated(item.destination, entry.destination)) &&
        (destExists || deliverableOnDisk),
    );

    const classified = classifyInstallPresence({
      destExists,
      destFileExists,
      hdPartialExists,
      stagingPartialExists,
      indexed,
      deliverableOnDisk,
    });

    if (classified.kind === "clean") continue;
    found.push({
      entryId: entry.id,
      label: entry.label,
      destination: entry.destination,
      kind: classified.kind,
      canResume: classified.canResume,
    });
  }

  return found;
}

export async function clearEntryInstallFiles(options: {
  rootDir: string;
  destination: string;
  entryId: string;
  stagingRoot: string;
}): Promise<void> {
  const { rootDir, destination, entryId, stagingRoot } = options;
  const resolved = resolveUnderRoot(rootDir, destination);
  if (!resolved.ok) throw new Error(resolved.error);

  const destPath = resolved.fullPath;
  const installDir = installDirForDestPath(destPath);
  const installRel = installedDestinationFromManifest(destination);

  await unlink(destPath + HD_PARTIAL_SUFFIX).catch(() => undefined);

  if (destPath.toLowerCase() !== installDir.toLowerCase() && existsSync(destPath)) {
    try {
      if (statSync(destPath).isFile()) await unlink(destPath);
    } catch {
      // arquivo em uso — a exclusão da pasta ainda segue
    }
  }

  try {
    await deleteHdItem(rootDir, installRel);
  } catch {
    if (existsSync(installDir) && isPathUnderRoot(rootDir, installDir)) {
      await rm(installDir, { recursive: true, force: true });
    }
  }

  await removeStagingEntry(stagingEntryDir(stagingRoot, entryId));
}

export async function removeStaleHdExtractDirs(rootDir: string): Promise<void> {
  const dir = path.join(rootDir, HD_META_DIR);
  if (!existsSync(dir)) return;
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith("extract-")) continue;
    await rm(path.join(dir, name), { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}

function isFile(target: string): boolean {
  try {
    return statSync(target).isFile();
  } catch {
    return false;
  }
}

function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}
