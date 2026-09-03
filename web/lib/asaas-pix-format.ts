export type PixQrView = {
  encodedImage: string;
  payload: string;
  expirationDate: string | null;
};

export type PixCheckoutView = {
  paymentId: string;
  status: string;
  paid: boolean;
  expired: boolean;
  planId: "1m" | "2m" | "3m";
  planTitle: string;
  priceLabel: string;
  value: number;
  qr: PixQrView | null;
};

export function isAsaasPaymentId(value: string): boolean {
  return /^pay_[A-Za-z0-9]+$/.test(value.trim());
}

export function asaasPaymentIsPaid(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "RECEIVED" || normalized === "CONFIRMED";
}

export function asaasPaymentIsExpired(status: string): boolean {
  return status.trim().toUpperCase() === "OVERDUE";
}

export function pixCheckoutPath(paymentId: string): string {
  return `/assinar/pix?payment=${encodeURIComponent(paymentId)}`;
}

export function pixPlanPath(planId: "1m" | "2m" | "3m"): string {
  return `/assinar/pix?plan=${planId}`;
}

export function pixQrImageSrc(encodedImage: string): string {
  const value = encodedImage.replace(/\s+/g, "");
  if (value.startsWith("data:")) return value;
  return `data:image/png;base64,${value}`;
}

export function parseAsaasDateTime(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, year, month, day, hour, minute, second] = match;
  // Asaas envia horário local da conta (America/Sao_Paulo, UTC-3).
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) + 3,
      Number(minute),
      Number(second),
    ),
  );
}

export function qrCodeIsExpired(expirationDate: string | null | undefined): boolean {
  const date = parseAsaasDateTime(expirationDate);
  if (!date) return false;
  return date.getTime() <= Date.now();
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
