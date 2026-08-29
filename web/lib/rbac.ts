export type Role = "admin" | "editor" | "user";

const RANK: Record<Role, number> = {
  user: 0,
  editor: 1,
  admin: 2,
};

export function hasMinRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

export function canAccessPainel(role: Role): boolean {
  return role === "admin" || role === "editor";
}

export function canCreatePortfolio(role: Role): boolean {
  return role === "admin";
}

export function canDeletePortfolio(role: Role): boolean {
  return role === "admin";
}

export function canEditPortfolio(role: Role): boolean {
  return role === "admin" || role === "editor";
}

export function hasSubscriptionBypass(role: Role): boolean {
  return role === "admin";
}

export function parseRole(value: string | null | undefined): Role {
  if (value === "admin" || value === "editor" || value === "user") return value;
  return "user";
}

/** Bootstrap admin from env only — never a hardcoded mailbox. */
export function portfolioAdminEmail(): string {
  return (process.env.PORTFOLIO_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  const expected = portfolioAdminEmail();
  if (!expected || !email) return false;
  return email.trim().toLowerCase() === expected;
}
