import { timingSafeEqual } from "node:crypto";

export const PASSWORD_RECOVERY_COOKIE = "mh_pw_recovery";
export const PASSWORD_RECOVERY_NONCE_COOKIE = "mh_pw_reset";
export const PASSWORD_RECOVERY_PATH = "/redefinir-senha";
export const FORGOT_PASSWORD_PATH = "/esqueci-senha";

const COOKIE_MAX_AGE_SEC = 15 * 60;

export function passwordRecoveryCookieOptions(maxAge = COOKIE_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function clearPasswordRecoveryCookieOptions() {
  return passwordRecoveryCookieOptions(0);
}

export function isPasswordRecoveryPath(path: string): boolean {
  return (
    path === PASSWORD_RECOVERY_PATH ||
    path.startsWith("/api/auth/reset-password") ||
    path.startsWith("/api/auth/recovery-lock") ||
    path.startsWith("/auth/callback")
  );
}

export function isPasswordRecoveryCallback(input: {
  type: string | null;
  nonce: string | null;
}): boolean {
  return input.type === "recovery" || Boolean(input.nonce);
}

export function parseAuthCallbackHash(hash: string): {
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
} {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) {
    return { type: null, accessToken: null, refreshToken: null };
  }
  const params = new URLSearchParams(raw);
  return {
    type: params.get("type"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

export function isWellFormedEmail(email: string): boolean {
  if (email.length < 5 || email.length > 254) return false;
  if (email.includes(" ") || email.includes("\n") || email.includes("\r")) {
    return false;
  }
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
