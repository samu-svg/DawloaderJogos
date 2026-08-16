import { app } from "electron";
import path from "node:path";

/** Caminho dos arquivos estáticos do renderer (dev e empacotado). */
export function rendererPath(...parts: string[]): string {
  return path.join(app.getAppPath(), "renderer", ...parts);
}

/** Caminho do preload compilado ao lado do main process. */
export function preloadPath(): string {
  return path.join(__dirname, "preload.js");
}
