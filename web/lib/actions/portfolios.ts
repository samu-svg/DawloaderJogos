"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateDestination } from "@/lib/manifest";
import { buildDestination, buildFolderDestination, type FolderPreset } from "@/lib/install-presets";
import { PASTA_LOCAL_GROUP } from "@/lib/local-import";
import { isTeraboxUrl } from "@/lib/terabox";
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
  },
): Promise<ActionResult> {
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
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Dois arquivos não podem ir para a mesma pasta no HD.",
      };
    }
    return { ok: false, error: "Não foi possível salvar o arquivo." };
  }

  return { ok: true };
}

function parseUrl(
  value: string,
): { ok: false; error: string } | { ok: true; url: string } {
  const url = value.trim();
  if (!url) return { ok: false, error: "Informe o link de download." };
  try {
    new URL(url);
  } catch {
    return { ok: false, error: "O link de download não é válido." };
  }
  return { ok: true, url };
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
  await requireUser();

  const gameTitle = String(formData.get("game_title") ?? "").trim();
  const gameFile = String(formData.get("game_file") ?? "").trim();
  const gameUrlRaw = String(formData.get("game_url") ?? "").trim();
  const deliveryMode = String(formData.get("delivery_mode") ?? "download");
  const isFolderLocal = deliveryMode === "folder-local";
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
    return {
      ok: false,
      error: isFolderLocal
        ? "Informe o nome da pasta do jogo."
        : "Informe o nome do arquivo do jogo.",
    };
  }

  let gameExternalUrl: string;
  let gameGroupName: string;
  let gameDestination: { ok: true; destination: string } | { ok: false; error: string };

  if (isFolderLocal) {
    const gameUrl = parseUrl(gameUrlRaw);
    if (!gameUrl.ok) {
      return { ok: false, error: "Informe o link do TeraBox." };
    }
    if (!isTeraboxUrl(gameUrl.url)) {
      return {
        ok: false,
        error:
          "Informe um link válido do TeraBox (terabox.com, 1024tera.com, etc.). O arquivo será baixado como .zip.",
      };
    }
    gameExternalUrl = gameUrl.url;
    gameGroupName = PASTA_LOCAL_GROUP;
    gameDestination = buildFolderDestination(
      gameFolder,
      gameFile,
      gameCustomPath,
      gameContentId,
    );
  } else {
    const gameUrl = parseUrl(gameUrlRaw);
    if (!gameUrl.ok) return gameUrl;
    gameExternalUrl = gameUrl.url;
    gameGroupName = "jogo";
    gameDestination = buildDestination(
      gameFolder,
      gameFile,
      gameCustomPath,
      gameContentId,
    );
  }

  if (!gameDestination.ok) return gameDestination;

  if (isFolderLocal) {
    const supabase = await createClient();
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!portfolio) return { ok: false, error: "Portfólio não encontrado." };

    const { data: lastEntry } = await supabase
      .from("entries")
      .select("sort_order")
      .eq("portfolio_id", portfolio.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = (lastEntry?.sort_order ?? -1) + 1;

    const insert = await insertEntry(portfolio.id, {
      label: gameTitle,
      destination: gameDestination.destination,
      externalUrl: gameExternalUrl,
      groupName: gameGroupName,
      isOptional: false,
      sizeBytes: 0,
      sha256: null,
      sortOrder,
    });
    if (!insert.ok) return insert;

    revalidatePath(`/painel/${slug}`);
    revalidatePath(`/api/portfolios/${slug}/manifest`);
    return { ok: true };
  }

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

    const supabase = await createClient();
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("slug", slug)
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
      externalUrl: gameExternalUrl,
      groupName: gameGroupName,
      isOptional: false,
      sizeBytes: 0,
      sha256: null,
      sortOrder: sortOrder++,
    });
    if (!mainInsert.ok) return mainInsert;

    const extraInsert = await insertEntry(portfolio.id, {
      label: extraTitle,
      destination: extraDestination.destination,
      externalUrl: extraUrl.url,
      groupName: "conteudo",
      isOptional: true,
      sizeBytes: 0,
      sha256: null,
      sortOrder: sortOrder++,
    });
    if (!extraInsert.ok) return extraInsert;

    revalidatePath(`/painel/${slug}`);
    revalidatePath(`/api/portfolios/${slug}/manifest`);
    return { ok: true };
  }

  const supabase = await createClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("slug", slug)
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
    externalUrl: gameExternalUrl,
    groupName: gameGroupName,
    isOptional: false,
    sizeBytes: 0,
    sha256: null,
    sortOrder: sortOrder++,
  });
  if (!mainInsert.ok) return mainInsert;

  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/api/portfolios/${slug}/manifest`);
  return { ok: true };
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
