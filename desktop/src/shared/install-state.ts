export const HD_PARTIAL_SUFFIX = ".montahd.partial";
export const STAGING_PARTIAL_NAME = "download.partial";

export type EntryInstallKind = "clean" | "installed" | "incomplete";

export interface InstallPresenceFlags {
  destExists: boolean;
  destFileExists: boolean;
  hdPartialExists: boolean;
  stagingPartialExists: boolean;
  indexed: boolean;
}

export interface EntryInstallState {
  entryId: string;
  label: string;
  destination: string;
  kind: Exclude<EntryInstallKind, "clean">;
  canResume: boolean;
}

export function installDirForDestPath(destPath: string): string {
  return destPath.toLowerCase().endsWith(".zip") ? destPath.slice(0, -4) : destPath;
}

export function classifyInstallPresence(flags: InstallPresenceFlags): {
  kind: EntryInstallKind;
  canResume: boolean;
} {
  const hasPartial = flags.hdPartialExists || flags.stagingPartialExists;

  if (flags.indexed && flags.destExists) {
    return { kind: "installed", canResume: false };
  }

  if (hasPartial && !flags.destExists && !flags.destFileExists) {
    return { kind: "incomplete", canResume: true };
  }

  if (flags.destExists || flags.destFileExists || hasPartial) {
    return { kind: "incomplete", canResume: false };
  }

  return { kind: "clean", canResume: false };
}
