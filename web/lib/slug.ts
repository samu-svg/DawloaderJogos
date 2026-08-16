const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (slug.length < 3) {
    return { ok: false, error: "O endereço precisa ter pelo menos 3 caracteres." };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error:
        "Use apenas letras minúsculas, números e hífens. Não comece nem termine com hífen.",
    };
  }
  return { ok: true };
}
