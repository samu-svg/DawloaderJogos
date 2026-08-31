import { app } from "electron";
import path from "node:path";
import { firstExistingPath } from "../shared/first-existing-path";

function rendererCandidates(...parts: string[]): string[] {
  const candidates = [
    path.join(app.getAppPath(), "renderer", ...parts),
    path.join(__dirname, "..", "..", "renderer", ...parts),
  ];
  if (app.isPackaged && process.resourcesPath) {
    candidates.unshift(
      path.join(process.resourcesPath, "app.asar.unpacked", "renderer", ...parts),
    );
  }
  return candidates;
}

/** Caminho dos arquivos estáticos do renderer (dev, asar e asar.unpacked). */
export function rendererPath(...parts: string[]): string {
  return firstExistingPath(rendererCandidates(...parts));
}

/** Caminho do preload compilado ao lado do main process. */
export function preloadPath(): string {
  return path.join(__dirname, "preload.js");
}
