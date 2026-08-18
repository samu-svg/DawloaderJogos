const DEFAULT_PORTFOLIO_ADMIN_EMAIL = "douradosamuel50@gmail.com";

export function portfolioAdminEmail(): string {
  return (process.env.PORTFOLIO_ADMIN_EMAIL ?? DEFAULT_PORTFOLIO_ADMIN_EMAIL)
    .trim()
    .toLowerCase();
}

export function isPortfolioAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === portfolioAdminEmail();
}
