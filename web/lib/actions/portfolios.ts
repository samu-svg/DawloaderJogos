"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateDestination } from "@/lib/manifest";
import { slugify, validateSlug } from "@/lib/slug";
import { createClient, currentUser } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function createPortfolio(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugInput || slugify(title);
  const isPublic = formData.get("is_public") === "on";

  if (!title) {
    return { ok: false, error: "Informe um título." };
  }

  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) return slugCheck;

  const supabase = await createClient();
  const { error } = await supabase.from("portfolios").insert({
    owner_id: user.id,
    title,
    description: description || null,
    slug,
    is_public: isPublic,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Este endereço já está em uso. Escolha outro." };
    }
    return { ok: false, error: "Não foi possível criar o portfólio." };
  }

  revalidatePath("/painel");
  redirect(`/painel/${slug}`);
}

export async function updatePortfolio(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPublic = formData.get("is_public") === "on";

  if (!title) {
    return { ok: false, error: "Informe um título." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolios")
    .update({
      title,
      description: description || null,
      is_public: isPublic,
    })
    .eq("slug", slug);

  if (error) {
    return { ok: false, error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/painel");
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/api/portfolios/${slug}/manifest`);
  return { ok: true };
}

export async function deletePortfolio(slug: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("portfolios").delete().eq("slug", slug);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o portfólio." };
  }

  revalidatePath("/painel");
  redirect("/painel");
}

export async function addEntry(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  const destinationRaw = String(formData.get("destination") ?? "").trim();
  const externalUrl = String(formData.get("external_url") ?? "").trim();
  const groupName = String(formData.get("group_name") ?? "").trim();
  const sizeBytesRaw = String(formData.get("size_bytes") ?? "").trim();
  const sha256 = String(formData.get("sha256") ?? "").trim().toLowerCase();
  const isOptional = formData.get("is_optional") === "on";

  if (!label) return { ok: false, error: "Informe o nome do arquivo." };
  if (!externalUrl) return { ok: false, error: "Informe o link de download." };

  try {
    new URL(externalUrl);
  } catch {
    return { ok: false, error: "O link de download não é válido." };
  }

  const destination = validateDestination(destinationRaw);
  if (!destination.ok) return destination;

  if (sha256 && !/^[0-9a-f]{64}$/.test(sha256)) {
    return { ok: false, error: "O SHA-256 deve ter 64 caracteres hexadecimais." };
  }

  const sizeBytes = sizeBytesRaw ? Number(sizeBytesRaw) : 0;
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return { ok: false, error: "O tamanho informado não é válido." };
  }

  const supabase = await createClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado." };
  }

  const { data: lastEntry } = await supabase
    .from("entries")
    .select("sort_order")
    .eq("portfolio_id", portfolio.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("entries").insert({
    portfolio_id: portfolio.id,
    label,
    destination: destination.destination,
    external_url: externalUrl,
    kind: "external",
    size_bytes: sizeBytes,
    sha256: sha256 || null,
    group_name: groupName || null,
    is_optional: isOptional,
    sort_order: (lastEntry?.sort_order ?? -1) + 1,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Já existe um arquivo com este destino neste portfólio.",
      };
    }
    return { ok: false, error: "Não foi possível adicionar o arquivo." };
  }

  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/api/portfolios/${slug}/manifest`);
  return { ok: true };
}

export async function deleteEntry(
  slug: string,
  entryId: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", entryId);

  if (error) {
    return { ok: false, error: "Não foi possível remover o arquivo." };
  }

  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/api/portfolios/${slug}/manifest`);
  return { ok: true };
}

export async function deletePortfolioForm(slug: string): Promise<void> {
  await deletePortfolio(slug);
}

export async function deleteEntryForm(
  slug: string,
  entryId: string,
): Promise<void> {
  await deleteEntry(slug, entryId);
}
