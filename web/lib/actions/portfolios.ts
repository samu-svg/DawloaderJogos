"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateDestination } from "@/lib/manifest";
import { buildDestination, type FolderPreset } from "@/lib/install-presets";
import { probeDownloadUrl } from "@/lib/download-probe";
import { normalizeDirectUrl, shareOnlyHostName } from "@/lib/direct-url";
import { isPortfolioAdmin } from "@/lib/admin";
import { requireOwnedPortfolio } from "@/lib/catalog";
import { entryIdsInGroup } from "@/lib/entry-groups";
import { slugify, validateSlug } from "@/lib/slug";
import { createClient, currentUser } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidatePortfolioPaths(slug: string) {
  revalidatePath("/painel");
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/api/portfolios/${slug}/manifest`);
  revalidatePath("/baixar");
  revalidatePath(`/baixar/${slug}`);
  revalidatePath("/");
}

function mapEntryInsertError(error: PostgrestError): string {
  if (
    error.code === "23505" ||
    error.message.includes("entries_destination_key") ||
    error.details?.includes("entries_destination_key")
  ) {
    return "Já existe um jogo nesta pasta do HD. Remova o item antigo ou escolha outro nome de pasta.";
  }
  if (error.code === "42501") {
    return "Sem permissão para editar este portfólio. Faça login com a conta correta.";
  }
  if (error.code === "23514") {
    return "O caminho de destino no HD é inválido. Revise o nome da pasta.";
  }
  console.error("insertEntry failed:", error);
  return "Não foi possível salvar o arquivo. Tente outro nome de pasta ou remova o item existente.";
}

async function findExistingDestination(
  portfolioId: string,
  destination: string,
): Promise<{ label: string; destination: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("label, destination")
    .eq("portfolio_id", portfolioId);

  const target = destination.toLowerCase();
  const hit = data?.find((entry) => entry.destination.toLowerCase() === target);
  return hit ?? null;
}

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function createPortfolio(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  if (!isPortfolioAdmin(user.email)) {
    return {
      ok: false,
      error: "Apenas o administrador pode criar portfólios no momento.",
    };
  }

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
    if (error.code === "42501") {
      return {
        ok: false,
        error: "Apenas o administrador pode criar portfólios no momento.",
      };
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
  const user = await requireUser();
  const portfolio = await requireOwnedPortfolio(slug, user.id);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

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
    .eq("slug", slug)
    .eq("owner_id", user.id);

  if (error) {
    return { ok: false, error: "Não foi possível salvar as alterações." };
  }

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deletePortfolio(slug: string): Promise<ActionResult> {
  const user = await requireUser();
  const portfolio = await requireOwnedPortfolio(slug, user.id);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("slug", slug)
    .eq("owner_id", user.id);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o portfólio." };
  }

  revalidatePortfolioPaths(slug);
  redirect("/painel");
}

function parseCoverUrl(
  value: string,
): { ok: true; url: string | null } | { ok: false; error: string } {
  const raw = value.trim();
  if (!raw) return { ok: true, url: null };

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "A capa precisa ser um link http ou https." };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error: "Link da capa inválido." };
  }
}

async function insertEntry(
  portfolioId: string,
  data: {
    label: string;
    destination: string;
    externalUrl: string;
    groupName: string | null;
    isOptional: boolean;
    sizeBytes: number;
    sha256: string | null;
    sortOrder: number;
    coverUrl?: string | null;
  },
): Promise<ActionResult> {
  const existing = await findExistingDestination(portfolioId, data.destination);
  if (existing) {
    return {
      ok: false,
      error: `Já existe «${existing.label}» em ${existing.destination}. Remova esse item ou escolha outra pasta no HD.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("entries").insert({
    portfolio_id: portfolioId,
    label: data.label,
    destination: data.destination,
    external_url: data.externalUrl,
    kind: "external",
    size_bytes: data.sizeBytes,
    sha256: data.sha256,
    group_name: data.groupName,
    is_optional: data.isOptional,
    sort_order: data.sortOrder,
    cover_url: data.coverUrl ?? null,
  });

  if (error) {
    return { ok: false, error: mapEntryInsertError(error) };
  }

  return { ok: true };
}

function parseUrl(
  value: string,
): { ok: false; error: string } | { ok: true; url: string } {
  const raw = value.trim();
  if (!raw) return { ok: false, error: "Informe o link de download." };
  try {
    new URL(raw);
  } catch {
    return { ok: false, error: "O link de download não é válido." };
  }

  const shareOnly = shareOnlyHostName(raw);
  if (shareOnly) {
    return {
      ok: false,
      error: `O ${shareOnly} entrega uma página de compartilhamento, não o arquivo, então nenhum programa consegue baixar por ali. Hospede o arquivo no Google Drive (o link é convertido automaticamente) ou em outro serviço com link direto.`,
    };
  }

  return { ok: true, url: normalizeDirectUrl(raw) };
}

function parseFolderPreset(raw: string): FolderPreset {
  if (raw === "content" || raw === "custom") return raw;
  return "games";
}

/** Cadastra um jogo com 1 ou 2 arquivos (jogo + DLC/conteúdo em pastas diferentes). */
export async function addGamePackage(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const gameTitle = String(formData.get("game_title") ?? "").trim();
  const gameCoverRaw = String(formData.get("game_cover_url") ?? "").trim();
  const gameFile = String(formData.get("game_file") ?? "").trim();
  const gameUrlRaw = String(formData.get("game_url") ?? "").trim();
  const gameFolder = parseFolderPreset(String(formData.get("game_folder") ?? "games"));
  const gameCustomPath = String(formData.get("game_custom_path") ?? "").trim();
  const gameContentId = String(formData.get("game_content_id") ?? "").trim();

  const includeExtra = formData.get("include_extra") === "on";
  const extraTitle = String(formData.get("extra_title") ?? "").trim();
  const extraFile = String(formData.get("extra_file") ?? "").trim();
  const extraUrlRaw = String(formData.get("extra_url") ?? "").trim();
  const extraFolder = parseFolderPreset(String(formData.get("extra_folder") ?? "content"));
  const extraCustomPath = String(formData.get("extra_custom_path") ?? "").trim();
  const extraContentId = String(formData.get("extra_content_id") ?? "").trim();

  if (!gameTitle) return { ok: false, error: "Informe o nome do jogo." };
  if (!gameFile) {
    return { ok: false, error: "Informe o nome do arquivo do jogo." };
  }

  const gameCover = parseCoverUrl(gameCoverRaw);
  if (!gameCover.ok) return gameCover;

  const gameUrl = parseUrl(gameUrlRaw);
  if (!gameUrl.ok) return gameUrl;

  const gameDestination = buildDestination(
    gameFolder,
    gameFile,
    gameCustomPath,
    gameContentId,
  );
  if (!gameDestination.ok) return gameDestination;

  // The link is checked now so a broken one never reaches the desktop app.
  const gameProbe = await probeDownloadUrl(gameUrl.url);
  if (!gameProbe.ok) return { ok: false, error: `${gameTitle}: ${gameProbe.error}` };

  let extra: {
    title: string;
    url: string;
    destination: string;
    sizeBytes: number;
  } | null = null;

  if (includeExtra) {
    if (!extraTitle) return { ok: false, error: "Informe o nome do arquivo extra." };
    if (!extraFile) return { ok: false, error: "Informe o nome do arquivo extra." };

    const extraUrl = parseUrl(extraUrlRaw);
    if (!extraUrl.ok) return extraUrl;

    const extraDestination = buildDestination(
      extraFolder,
      extraFile,
      extraCustomPath,
      extraContentId,
    );
    if (!extraDestination.ok) return extraDestination;

    const extraProbe = await probeDownloadUrl(extraUrl.url);
    if (!extraProbe.ok) return { ok: false, error: `${extraTitle}: ${extraProbe.error}` };

    extra = {
      title: extraTitle,
      url: extraUrl.url,
      destination: extraDestination.destination,
      sizeBytes: extraProbe.sizeBytes,
    };
  }

  const supabase = await createClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!portfolio) return { ok: false, error: "Portfólio não encontrado." };

  const { data: lastEntry } = await supabase
    .from("entries")
    .select("sort_order")
    .eq("portfolio_id", portfolio.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sortOrder = (lastEntry?.sort_order ?? -1) + 1;

  const mainInsert = await insertEntry(portfolio.id, {
    label: gameTitle,
    destination: gameDestination.destination,
    externalUrl: gameUrl.url,
    groupName: "jogo",
    isOptional: false,
    sizeBytes: gameProbe.sizeBytes,
    sha256: null,
    sortOrder: sortOrder++,
    coverUrl: gameCover.url,
  });
  if (!mainInsert.ok) return mainInsert;

  if (extra) {
    const extraInsert = await insertEntry(portfolio.id, {
      label: extra.title,
      destination: extra.destination,
      externalUrl: extra.url,
      groupName: "conteudo",
      isOptional: true,
      sizeBytes: extra.sizeBytes,
      sha256: null,
      sortOrder: sortOrder++,
    });
    if (!extraInsert.ok) return extraInsert;
  }

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function addEntry(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
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
  const portfolio = await requireOwnedPortfolio(slug, user.id);

  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
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

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deleteGameGroup(
  slug: string,
  mainEntryId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const portfolio = await requireOwnedPortfolio(slug, user.id);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("entries")
    .select("id, group_name, sort_order")
    .eq("portfolio_id", portfolio.id);

  const idsToDelete = entryIdsInGroup(entries ?? [], mainEntryId);
  if (!idsToDelete.length) {
    return { ok: false, error: "Jogo não encontrado." };
  }

  const { error } = await supabase
    .from("entries")
    .delete()
    .in("id", idsToDelete)
    .eq("portfolio_id", portfolio.id);

  if (error) {
    return { ok: false, error: "Não foi possível apagar o jogo." };
  }

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deleteEntry(
  slug: string,
  entryId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const portfolio = await requireOwnedPortfolio(slug, user.id);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", entryId)
    .eq("portfolio_id", portfolio.id);

  if (error) {
    return { ok: false, error: "Não foi possível remover o arquivo." };
  }

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deletePortfolioForm(slug: string): Promise<void> {
  await deletePortfolio(slug);
}

export async function deleteGameGroupForm(
  slug: string,
  mainEntryId: string,
): Promise<void> {
  await deleteGameGroup(slug, mainEntryId);
}

export async function deleteEntryForm(
  slug: string,
  entryId: string,
): Promise<void> {
  await deleteEntry(slug, entryId);
}
