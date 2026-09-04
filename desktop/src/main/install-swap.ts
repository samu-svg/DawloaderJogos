import { existsSync, statSync } from "node:fs";
import { readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { isPathUnderRoot } from "../shared/path-safety.ts";
import { ensureDir } from "./ensure-dir.ts";
import { safeStagingId } from "./staging.ts";

const SWAP_DIR = ".montahd";
const OUTGOING = "outgoing";

export function outgoingSwapDir(hdRoot: string, entryId: string): string {
  return path.join(path.resolve(hdRoot), SWAP_DIR, OUTGOING, safeStagingId(entryId));
}

function payloadPath(hdRoot: string, entryId: string): string {
  return path.join(outgoingSwapDir(hdRoot, entryId), "payload");
}

function rootHoldDir(hdRoot: string, entryId: string): string {
  return path.join(outgoingSwapDir(hdRoot, entryId), "root");
}

function assertUnderHdRoot(hdRoot: string, targetPath: string): string {
  const root = path.resolve(hdRoot);
  const target = path.resolve(targetPath);
  if (!isPathUnderRoot(root, target) || target === root) {
    throw new Error("Caminho de instalação fora do HD escolhido.");
  }
  return target;
}

function safeRootName(name: string): string {
  const base = path.basename(name.trim());
  if (!base || base === "." || base === "..") {
    throw new Error("Nome inválido na raiz do HD.");
  }
  return base;
}

async function movePath(from: string, to: string): Promise<void> {
  await ensureDir(path.dirname(to));
  await rename(from, to);
}

async function removeIfExists(target: string): Promise<void> {
  if (!existsSync(target)) return;
  await rm(target, { recursive: true, force: true });
}

/**
 * Outgoing presente = instalação ainda não foi confirmada. Devolve o destino
 * antigo mesmo se já houver pasta nova (ela pode estar pela metade).
 */
export async function recoverInterruptedDestSwap(
  hdRoot: string,
  entryId: string,
  destPath: string,
): Promise<void> {
  const dest = assertUnderHdRoot(hdRoot, destPath);
  const held = payloadPath(hdRoot, entryId);
  if (!existsSync(held)) return;

  await removeIfExists(dest);
  await movePath(held, dest);
}

export async function recoverInterruptedRootSwap(
  hdRoot: string,
  entryId: string,
): Promise<void> {
  const heldDir = rootHoldDir(hdRoot, entryId);
  if (!existsSync(heldDir)) return;

  let names: string[] = [];
  try {
    names = await readdir(heldDir);
  } catch {
    return;
  }

  const root = path.resolve(hdRoot);
  for (const name of names) {
    const held = path.join(heldDir, name);
    const live = path.join(root, name);
    if (!isPathUnderRoot(root, live) || live === root) continue;
    await removeIfExists(live);
    if (existsSync(held)) await movePath(held, live);
  }
}

/** Tira o destino atual do caminho sem apagar: rename para `.montahd/outgoing`. */
export async function retireDestToOutgoing(
  hdRoot: string,
  entryId: string,
  destPath: string,
): Promise<boolean> {
  const dest = assertUnderHdRoot(hdRoot, destPath);
  if (!existsSync(dest)) return false;

  await recoverInterruptedDestSwap(hdRoot, entryId, dest);
  if (!existsSync(dest)) return false;

  const held = payloadPath(hdRoot, entryId);
  await removeIfExists(held);
  await movePath(dest, held);
  return true;
}

export async function restoreDestFromOutgoing(
  hdRoot: string,
  entryId: string,
  destPath: string,
): Promise<void> {
  const dest = assertUnderHdRoot(hdRoot, destPath);
  const held = payloadPath(hdRoot, entryId);
  if (!existsSync(held)) return;

  await removeIfExists(dest);
  await movePath(held, dest);
}

export async function discardDestOutgoing(
  hdRoot: string,
  entryId: string,
): Promise<void> {
  await removeIfExists(payloadPath(hdRoot, entryId));
}

export async function retireRootNamesToOutgoing(
  hdRoot: string,
  entryId: string,
  names: readonly string[],
): Promise<void> {
  await recoverInterruptedRootSwap(hdRoot, entryId);

  const root = path.resolve(hdRoot);
  const heldDir = rootHoldDir(hdRoot, entryId);
  await ensureDir(heldDir);

  for (const raw of names) {
    const name = safeRootName(raw);
    const live = path.join(root, name);
    if (!isPathUnderRoot(root, live) || live === root) continue;
    if (!existsSync(live)) continue;
    const held = path.join(heldDir, name);
    await removeIfExists(held);
    await movePath(live, held);
  }
}

export async function restoreRootFromOutgoing(
  hdRoot: string,
  entryId: string,
): Promise<void> {
  const heldDir = rootHoldDir(hdRoot, entryId);
  if (!existsSync(heldDir)) return;

  const root = path.resolve(hdRoot);
  let names: string[] = [];
  try {
    names = await readdir(heldDir);
  } catch {
    return;
  }

  for (const name of names) {
    const held = path.join(heldDir, name);
    const live = path.join(root, name);
    if (!isPathUnderRoot(root, live) || live === root) continue;
    await removeIfExists(live);
    if (existsSync(held)) await movePath(held, live);
  }
}

export async function discardRootOutgoing(
  hdRoot: string,
  entryId: string,
): Promise<void> {
  await removeIfExists(rootHoldDir(hdRoot, entryId));
}

export async function discardAllOutgoing(
  hdRoot: string,
  entryId: string,
): Promise<void> {
  await removeIfExists(outgoingSwapDir(hdRoot, entryId));
}

/**
 * Copia/grava no destino só depois de afastar o que já estava lá.
 * Se a instalação falhar, o destino antigo volta.
 */
export async function withDestSwap<T>(
  hdRoot: string,
  entryId: string,
  destPath: string,
  install: () => Promise<T>,
): Promise<T> {
  await recoverInterruptedDestSwap(hdRoot, entryId, destPath);
  const retired = await retireDestToOutgoing(hdRoot, entryId, destPath);
  try {
    const result = await install();
    await discardAllOutgoing(hdRoot, entryId);
    return result;
  } catch (error) {
    const dest = assertUnderHdRoot(hdRoot, destPath);
    await removeIfExists(dest);
    if (retired) await restoreDestFromOutgoing(hdRoot, entryId, destPath);
    throw error;
  }
}

export async function withRootSwap<T>(
  hdRoot: string,
  entryId: string,
  names: readonly string[],
  install: () => Promise<T>,
): Promise<T> {
  await recoverInterruptedRootSwap(hdRoot, entryId);
  await retireRootNamesToOutgoing(hdRoot, entryId, names);
  try {
    const result = await install();
    await discardAllOutgoing(hdRoot, entryId);
    return result;
  } catch (error) {
    const root = path.resolve(hdRoot);
    for (const raw of names) {
      const name = safeRootName(raw);
      const live = path.join(root, name);
      if (!isPathUnderRoot(root, live) || live === root) continue;
      await removeIfExists(live);
    }
    await restoreRootFromOutgoing(hdRoot, entryId);
    throw error;
  }
}

export function existingPathKind(
  targetPath: string,
): "missing" | "file" | "directory" {
  if (!existsSync(targetPath)) return "missing";
  try {
    return statSync(targetPath).isDirectory() ? "directory" : "file";
  } catch {
    return "missing";
  }
}
