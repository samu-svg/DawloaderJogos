import { FORGOT_PASSWORD_PATH, isWellFormedEmail } from "./password-recovery.ts";

export const EMAIL_CONFIRM_PATH = "/confirmar-email";

const CONFIRMATION_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "email",
]);

export type AuthCallbackKind = "confirm" | "recovery" | "unknown";

export function isEmailConfirmationType(
  type: string | null | undefined,
): boolean {
  return Boolean(type && CONFIRMATION_TYPES.has(type));
}

export function authCallbackUrl(
  origin: string,
  intent: "confirm" | "recovery",
): string {
  return `${origin.replace(/\/$/, "")}/auth/callback?intent=${intent}`;
}

export function resolveAuthCallbackKind(input: {
  type?: string | null;
  intent?: string | null;
  nonce?: string | null;
}): AuthCallbackKind {
  const type = input.type ?? null;
  const intent = input.intent ?? null;
  if (intent === "confirm" || isEmailConfirmationType(type)) return "confirm";
  if (intent === "recovery" || type === "recovery") return "recovery";
  if (input.nonce) return "recovery";
  return "unknown";
}

export function authCallbackFailurePath(
  kind: AuthCallbackKind,
  flag: "erro" | "expirado",
): string {
  if (kind === "confirm") return `${EMAIL_CONFIRM_PATH}?${flag}=1`;
  return `${FORGOT_PASSWORD_PATH}?${flag}=1`;
}

export function confirmEmailPath(input?: {
  email?: string;
  enviado?: boolean;
}): string {
  const params = new URLSearchParams();
  const email = input?.email?.trim().toLowerCase() ?? "";
  if (isWellFormedEmail(email)) params.set("email", email);
  if (input?.enviado) params.set("enviado", "1");
  const query = params.toString();
  return query ? `${EMAIL_CONFIRM_PATH}?${query}` : EMAIL_CONFIRM_PATH;
}
