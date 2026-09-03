import type { PipelineEntry } from "./download-pipeline";

/** Controle de pause/cancel por entry durante uma sessão de download. */
export class DownloadSession {
  private readonly globalAbort = new AbortController();
  private readonly entryControllers = new Map<string, AbortController>();
  private readonly itemsById = new Map<string, PipelineEntry>();
  readonly extraQueue: PipelineEntry[] = [];
  readonly pausedEntries = new Set<string>();
  readonly cancelledEntries = new Set<string>();
  queueBlocked = false;

  registerItems(items: PipelineEntry[]): void {
    for (const item of items) {
      this.itemsById.set(item.entry.id, item);
    }
  }

  signalFor(entryId: string): AbortSignal {
    const entryAbort = new AbortController();
    this.entryControllers.set(entryId, entryAbort);

    if (this.globalAbort.signal.aborted) {
      entryAbort.abort();
      return entryAbort.signal;
    }

    this.globalAbort.signal.addEventListener("abort", () => entryAbort.abort(), {
      once: true,
    });
    return entryAbort.signal;
  }

  pauseEntry(entryId: string): void {
    this.pausedEntries.add(entryId);
    this.entryControllers.get(entryId)?.abort();
  }

  pauseAll(): void {
    this.queueBlocked = true;
    for (const entryId of this.itemsById.keys()) {
      this.pauseEntry(entryId);
    }
    for (const entryId of this.entryControllers.keys()) {
      this.pauseEntry(entryId);
    }
  }

  resumeEntry(entryId: string): void {
    this.pausedEntries.delete(entryId);
    this.cancelledEntries.delete(entryId);
  }

  /** Recoloca um item pausado na fila da sessão atual. */
  requeue(entryId: string): boolean {
    const item = this.itemsById.get(entryId);
    if (!item) return false;
    this.resumeEntry(entryId);
    if (!this.extraQueue.some((queued) => queued.entry.id === entryId)) {
      this.extraQueue.push(item);
    }
    return true;
  }

  resumeAll(): void {
    this.queueBlocked = false;
    this.pausedEntries.clear();
  }

  cancelEntry(entryId: string): void {
    this.cancelledEntries.add(entryId);
    this.pausedEntries.delete(entryId);
    this.entryControllers.get(entryId)?.abort();
  }

  cancelAll(): void {
    this.globalAbort.abort();
    for (const ctrl of this.entryControllers.values()) {
      ctrl.abort();
    }
  }

  isPaused(entryId: string): boolean {
    return this.pausedEntries.has(entryId);
  }

  isCancelled(entryId: string): boolean {
    return this.cancelledEntries.has(entryId);
  }

  clearEntry(entryId: string): void {
    this.entryControllers.delete(entryId);
  }

  dispose(): void {
    this.entryControllers.clear();
    this.extraQueue.length = 0;
  }
}

let activeSession: DownloadSession | null = null;

export function beginDownloadSession(): DownloadSession {
  activeSession?.cancelAll();
  activeSession = new DownloadSession();
  return activeSession;
}

export function getActiveDownloadSession(): DownloadSession | null {
  return activeSession;
}

export function endDownloadSession(): void {
  activeSession?.dispose();
  activeSession = null;
}
