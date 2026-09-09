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

/** `0` = sem teto (plano pago). */
export function maxBytesPerSecondForPlan(plan: DownloadPlan): number {
  return plan === "paid" ? 0 : freeMaxBytesPerSecond();
}

export function afterAuthPath(hasPaidAccess: boolean): string {
  return hasPaidAccess ? "/baixar" : "/";
}
