const SPECIAL_INSTALL_PREFIX = "special-";

export function isSpecialInstallSlug(slug: string): boolean {
  return slug.startsWith(SPECIAL_INSTALL_PREFIX);
}

export function packSlugFromInstallSlug(installSlug: string): string | null {
  if (!isSpecialInstallSlug(installSlug)) return null;
  const packSlug = installSlug.slice(SPECIAL_INSTALL_PREFIX.length).trim();
  return packSlug || null;
}
