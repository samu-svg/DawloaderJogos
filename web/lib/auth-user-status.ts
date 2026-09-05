/** Status de confirmação de um usuário Auth, sem chamar o provedor. */

export type AuthUserConfirmation = {
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export type ExistingSignupDecision = "resend" | "reject" | "unknown";

export function parseAdminUsersList(body: unknown): AuthUserConfirmation[] {
  if (Array.isArray(body)) {
    return body.filter(isAuthUserRecord);
  }
  if (!body || typeof body !== "object") return [];
  const users = (body as { users?: unknown }).users;
  if (!Array.isArray(users)) return [];
  return users.filter(isAuthUserRecord);
}

function isAuthUserRecord(value: unknown): value is AuthUserConfirmation {
  return Boolean(value) && typeof value === "object";
}

export function findUserInAdminList(
  users: AuthUserConfirmation[],
  email: string,
): AuthUserConfirmation | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return (
    users.find((user) => (user.email ?? "").trim().toLowerCase() === normalized) ??
    null
  );
}

export function isAuthEmailConfirmed(
  user: AuthUserConfirmation | null | undefined,
): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

/** Conta existente não confirmada: reenviar. Confirmada: recusar cadastro. */
export function decideExistingSignup(
  user: AuthUserConfirmation | null | undefined,
): ExistingSignupDecision {
  if (!user) return "unknown";
  if (isAuthEmailConfirmed(user)) return "reject";
  return "resend";
}
