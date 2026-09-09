export type DownloadPlan = "free" | "paid";

/** 625_000 B/s = 5 Mbps no plano grátis. */
export const DEFAULT_FREE_DOWNLOAD_BYTES_PER_SECOND = 625_000;

/** Máximo de HDs ativos por assinatura (padrão: 1). */
export function planMaxHds(): number {
  const parsed = Number(process.env.PLAN_MAX_HDS);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return 1;
}

export function isDownloadPlan(value: unknown): value is DownloadPlan {
  return value === "free" || value === "paid";
}

export function freeMaxBytesPerSecond(): number {
  const parsed = Number(process.env.FREE_DOWNLOAD_BYTES_PER_SECOND);
  if (Number.isFinite(parsed) && parsed >= 1024) {
    return Math.floor(parsed);
  }
  return DEFAULT_FREE_DOWNLOAD_BYTES_PER_SECOND;
}

/** `0` = sem teto (plano Completo). */
export function maxBytesPerSecondForPlan(plan: DownloadPlan): number {
  return plan === "paid" ? 0 : freeMaxBytesPerSecond();
}

/** Mbps efetivos do teto grátis — usado na UI. */
export function freeDownloadMbps(): number {
  return (freeMaxBytesPerSecond() * 8) / 1_000_000;
}

export function freeDownloadSpeedLabel(): string {
  const mbps = freeDownloadMbps();
  if (!Number.isFinite(mbps) || mbps <= 0) return "5 Mbps";
  if (mbps >= 10) return `${Math.round(mbps)} Mbps`;
  const rounded = Math.round(mbps * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} Mbps` : `${rounded} Mbps`;
}

export function afterAuthPath(hasPaidAccess: boolean): string {
  return hasPaidAccess ? "/baixar" : "/";
}
