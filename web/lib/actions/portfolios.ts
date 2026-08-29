"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { requireEditablePortfolio } from "@/lib/catalog";
import { entryIdsInGroup } from "@/lib/entry-groups";
import { probeDownloadUrl } from "@/lib/download-probe";
import { normalizeDirectUrl, shareOnlyHostName } from "@/lib/direct-url";
import { buildDestination, type FolderPreset } from "@/lib/install-presets";
import { logError } from "@/lib/logger";
import { validateDestination } from "@/lib/manifest";
import { canCreatePortfolio, canDeletePortfolio } from "@/lib/rbac";
import { slugify, validateSlug } from "@/lib/slug";
import { deleteObject, headObjectSize } from "@/lib/storage";
import {
  hostedStorageKeyAllowed,
  isValidImportStorageKey,
  normalizeImportStorageKey,
  storageKeyBelongsToPortfolio,
} from "@/lib/storage-keys";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidatePortfolioPaths(slug: string) {
  revalidatePath("/painel");
  revalidatePath(`/painel/${slug}`);
  revalidatePath(`/api/portfolios/${slug}/manifest`);
  revalidatePath("/baixar");
  revalidatePath(`/baixar/${slug}`);
  revalidatePath("/");
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23505" || (error?.message ?? "").includes("entries_destination_key");
}

function mapEntryInsertError(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "23505" || message.includes("entries_destination_key")) {
    return "Já existe um jogo nesta pasta do HD. Remova o item antigo ou escolha outro nome de pasta.";
  }
  if (code === "23514" || message.includes("23514")) {
    return "O caminho de destino no HD é inválido. Revise o nome da pasta.";
  }
  logError("insertEntry failed", error);
  return "Não foi possível salvar o arquivo. Tente outro nome de pasta ou remova o item existente.";
}

async function findExistingDestination(
  portfolioId: string,
  destination: string,
): Promise<{ label: string; destination: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select("label, destination")
    .eq("portfolio_id", portfolioId);
  if (error) throw new Error(error.message);
  const target = destination.toLowerCase();
  const hit = (data ?? []).find((entry) => entry.destination.toLowerCase() === target);
  return hit ?? null;
}

export async function createPortfolio(formData: FormData): Promise<ActionResult> {
  const user = await requireAppUser();

  if (!canCreatePortfolio(user.role)) {
    return {
      ok: false,
      error: "Apenas o administrador pode criar portfólios.",
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
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Este endereço já está em uso. Escolha outro." };
    }
    return { ok: false, error: "Não foi possível criar o portfólio." };
  }

  await recordAudit({
    actorId: user.id,
    action: "portfolio.create",
    entity: "portfolio",
    entityId: slug,
    metadata: { title },
  });

  revalidatePath("/painel");
  redirect(`/painel/${slug}`);
}

export async function updatePortfolio(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAppUser();
  const portfolio = await requireEditablePortfolio(slug, user);
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
    .eq("slug", slug);
  if (error) return { ok: false, error: "Não foi possível atualizar o portfólio." };

  await recordAudit({
    actorId: user.id,
    action: "portfolio.update",
    entity: "portfolio",
    entityId: slug,
  });

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deletePortfolio(slug: string): Promise<ActionResult> {
  const user = await requireAppUser();
  if (!canDeletePortfolio(user.role)) {
    return { ok: false, error: "Apenas o administrador pode excluir portfólios." };
  }

  const portfolio = await requireEditablePortfolio(slug, user);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
  const { data: hostedEntries } = await supabase
    .from("entries")
    .select("kind, storage_key")
    .eq("portfolio_id", portfolio.id);

  await deleteHostedObjects(hostedEntries ?? []);

  const { error } = await supabase.from("portfolios").delete().eq("slug", slug);
  if (error) return { ok: false, error: "Não foi possível excluir o portfólio." };

  await recordAudit({
    actorId: user.id,
    action: "portfolio.delete",
    entity: "portfolio",
    entityId: slug,
  });

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

type EntryInsertSource =
  | { kind: "external"; externalUrl: string }
  | { kind: "hosted"; storageKey: string };

async function deleteHostedObjects(
  entries: { kind: string; storage_key: string | null }[],
): Promise<void> {
  for (const entry of entries) {
    if (entry.kind !== "hosted" || !entry.storage_key) continue;
    try {
      await deleteObject(entry.storage_key);
    } catch (error) {
      logError("Failed to delete R2 object", error, { storageKey: entry.storage_key });
    }
  }
}

async function insertEntry(
  portfolioId: string,
  data: {
    label: string;
    destination: string;
    source: EntryInsertSource;
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

  if (
    data.source.kind === "hosted" &&
    !hostedStorageKeyAllowed(data.source.storageKey, portfolioId)
  ) {
    return { ok: false, error: "Chave R2 inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("entries").insert({
    portfolio_id: portfolioId,
    label: data.label,
    destination: data.destination,
    external_url: data.source.kind === "external" ? data.source.externalUrl : null,
    storage_key: data.source.kind === "hosted" ? data.source.storageKey : null,
    kind: data.source.kind,
    size_bytes: data.sizeBytes,
    sha256: data.sha256,
    group_name: data.groupName,
    is_optional: data.isOptional,
    sort_order: data.sortOrder,
    cover_url: data.coverUrl ?? null,
  });
  if (error) return { ok: false, error: mapEntryInsertError(error) };

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

function parseHostedFile(
  portfolioId: string,
  storageKeyRaw: string,
  sizeRaw: string,
): { ok: true; storageKey: string; sizeBytes: number } | { ok: false; error: string } {
  const storageKey = storageKeyRaw.trim();
  const sizeBytes = Number(sizeRaw);

  if (!storageKey) {
    return { ok: false, error: "Envie o arquivo para o R2 antes de salvar." };
  }

  if (!storageKeyBelongsToPortfolio(storageKey, portfolioId)) {
    return { ok: false, error: "Arquivo R2 inválido para este portfólio." };
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: "Tamanho do arquivo inválido." };
  }

  return { ok: true, storageKey, sizeBytes };
}

async function parseR2Import(
  storageKeyRaw: string,
): Promise<
  { ok: true; storageKey: string; sizeBytes: number } | { ok: false; error: string }
> {
  const storageKey = normalizeImportStorageKey(storageKeyRaw);
  if (!storageKey) {
    return { ok: false, error: "Informe o caminho do arquivo no bucket R2." };
  }
  if (!isValidImportStorageKey(storageKey)) {
    return { ok: false, error: "Caminho R2 inválido. Use algo como jogos/Halo3.zip" };
  }

  try {
    const sizeBytes = await headObjectSize(storageKey);
    return { ok: true, storageKey, sizeBytes };
  } catch {
    return {
      ok: false,
      error: `Arquivo não encontrado no R2: ${storageKey}`,
    };
  }
}

function parseFolderPreset(raw: string): FolderPreset {
  if (raw === "content" || raw === "custom") return raw;
  return "games";
}

export async function addGamePackage(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAppUser();

  const gameTitle = String(formData.get("game_title") ?? "").trim();
  const gameCoverRaw = String(formData.get("game_cover_url") ?? "").trim();
  const gameFile = String(formData.get("game_file") ?? "").trim();
  const gameSource = String(formData.get("game_source") ?? "external").trim();
  const gameUrlRaw = String(formData.get("game_url") ?? "").trim();
  const gameStorageKeyRaw = String(formData.get("game_storage_key") ?? "").trim();
  const gameImportKeyRaw = String(formData.get("game_import_key") ?? "").trim();
  const gameSizeRaw = String(formData.get("game_size_bytes") ?? "").trim();
  const gameFolder = parseFolderPreset(String(formData.get("game_folder") ?? "games"));
  const gameCustomPath = String(formData.get("game_custom_path") ?? "").trim();
  const gameContentId = String(formData.get("game_content_id") ?? "").trim();

  const includeExtra = formData.get("include_extra") === "on";
  const extraTitle = String(formData.get("extra_title") ?? "").trim();
  const extraFile = String(formData.get("extra_file") ?? "").trim();
  const extraSource = String(formData.get("extra_source") ?? "external").trim();
  const extraUrlRaw = String(formData.get("extra_url") ?? "").trim();
  const extraStorageKeyRaw = String(formData.get("extra_storage_key") ?? "").trim();
  const extraImportKeyRaw = String(formData.get("extra_import_key") ?? "").trim();
  const extraSizeRaw = String(formData.get("extra_size_bytes") ?? "").trim();
  const extraFolder = parseFolderPreset(String(formData.get("extra_folder") ?? "content"));
  const extraCustomPath = String(formData.get("extra_custom_path") ?? "").trim();
  const extraContentId = String(formData.get("extra_content_id") ?? "").trim();

  if (!gameTitle) return { ok: false, error: "Informe o nome do jogo." };
  if (!gameFile) {
    return { ok: false, error: "Informe o nome do arquivo do jogo." };
  }

  const gameCover = parseCoverUrl(gameCoverRaw);
  if (!gameCover.ok) return gameCover;

  const portfolio = await requireEditablePortfolio(slug, user);
  if (!portfolio) return { ok: false, error: "Portfólio não encontrado." };

  let gameSourceData: EntryInsertSource;
  let gameSizeBytes: number;

  if (gameSource === "r2") {
    const hosted = parseHostedFile(portfolio.id, gameStorageKeyRaw, gameSizeRaw);
    if (!hosted.ok) return hosted;
    gameSourceData = { kind: "hosted", storageKey: hosted.storageKey };
    gameSizeBytes = hosted.sizeBytes;
  } else if (gameSource === "r2-import") {
    const imported = await parseR2Import(
      gameStorageKeyRaw || gameImportKeyRaw,
    );
    if (!imported.ok) return imported;
    gameSourceData = { kind: "hosted", storageKey: imported.storageKey };
    gameSizeBytes = imported.sizeBytes;
  } else {
    const gameUrl = parseUrl(gameUrlRaw);
    if (!gameUrl.ok) return gameUrl;
    const gameProbe = await probeDownloadUrl(gameUrl.url);
    if (!gameProbe.ok) return { ok: false, error: `${gameTitle}: ${gameProbe.error}` };
    gameSourceData = { kind: "external", externalUrl: gameUrl.url };
    gameSizeBytes = gameProbe.sizeBytes;
  }

  const gameDestination = buildDestination(
    gameFolder,
    gameFile,
    gameCustomPath,
    gameContentId,
  );
  if (!gameDestination.ok) return gameDestination;

  let extra: {
    title: string;
    source: EntryInsertSource;
    destination: string;
    sizeBytes: number;
  } | null = null;

  if (includeExtra) {
    if (!extraTitle) return { ok: false, error: "Informe o nome do arquivo extra." };
    if (!extraFile) return { ok: false, error: "Informe o nome do arquivo extra." };

    const extraDestination = buildDestination(
      extraFolder,
      extraFile,
      extraCustomPath,
      extraContentId,
    );
    if (!extraDestination.ok) return extraDestination;

    if (extraSource === "r2") {
      const hosted = parseHostedFile(portfolio.id, extraStorageKeyRaw, extraSizeRaw);
      if (!hosted.ok) return hosted;
      extra = {
        title: extraTitle,
        source: { kind: "hosted", storageKey: hosted.storageKey },
        destination: extraDestination.destination,
        sizeBytes: hosted.sizeBytes,
      };
    } else if (extraSource === "r2-import") {
      const imported = await parseR2Import(
        extraStorageKeyRaw || extraImportKeyRaw,
      );
      if (!imported.ok) return imported;
      extra = {
        title: extraTitle,
        source: { kind: "hosted", storageKey: imported.storageKey },
        destination: extraDestination.destination,
        sizeBytes: imported.sizeBytes,
      };
    } else {
      const extraUrl = parseUrl(extraUrlRaw);
      if (!extraUrl.ok) return extraUrl;
      const extraProbe = await probeDownloadUrl(extraUrl.url);
      if (!extraProbe.ok) return { ok: false, error: `${extraTitle}: ${extraProbe.error}` };
      extra = {
        title: extraTitle,
        source: { kind: "external", externalUrl: extraUrl.url },
        destination: extraDestination.destination,
        sizeBytes: extraProbe.sizeBytes,
      };
    }
  }

  const supabase = await createClient();
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
    source: gameSourceData,
    groupName: "jogo",
    isOptional: false,
    sizeBytes: gameSizeBytes,
    sha256: null,
    sortOrder: sortOrder++,
    coverUrl: gameCover.url,
  });
  if (!mainInsert.ok) return mainInsert;

  if (extra) {
    const extraInsert = await insertEntry(portfolio.id, {
      label: extra.title,
      destination: extra.destination,
      source: extra.source,
      groupName: "conteudo",
      isOptional: true,
      sizeBytes: extra.sizeBytes,
      sha256: null,
      sortOrder: sortOrder++,
    });
    if (!extraInsert.ok) return extraInsert;
  }

  await recordAudit({
    actorId: user.id,
    action: "entry.create",
    entity: "portfolio",
    entityId: slug,
    metadata: { label: gameTitle },
  });

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function addEntry(
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAppUser();
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

  const portfolio = await requireEditablePortfolio(slug, user);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
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
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "Já existe um arquivo com este destino neste portfólio.",
      };
    }
    return { ok: false, error: "Não foi possível adicionar o arquivo." };
  }

  await recordAudit({
    actorId: user.id,
    action: "entry.create",
    entity: "portfolio",
    entityId: slug,
    metadata: { label },
  });

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deleteGameGroup(
  slug: string,
  mainEntryId: string,
): Promise<ActionResult> {
  const user = await requireAppUser();
  const portfolio = await requireEditablePortfolio(slug, user);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("entries")
    .select("id, kind, storage_key, group_name, sort_order")
    .eq("portfolio_id", portfolio.id);

  const idsToDelete = entryIdsInGroup(
    (entries ?? []).map((entry) => ({
      id: entry.id,
      group_name: entry.group_name,
      sort_order: entry.sort_order,
    })),
    mainEntryId,
  );
  if (!idsToDelete.length) {
    return { ok: false, error: "Jogo não encontrado." };
  }

  const toRemove = (entries ?? []).filter((entry) => idsToDelete.includes(entry.id));
  await deleteHostedObjects(toRemove);

  await supabase
    .from("entries")
    .delete()
    .in("id", idsToDelete)
    .eq("portfolio_id", portfolio.id);

  await recordAudit({
    actorId: user.id,
    action: "entry.delete_group",
    entity: "portfolio",
    entityId: slug,
    metadata: { mainEntryId },
  });

  revalidatePortfolioPaths(slug);
  return { ok: true };
}

export async function deleteEntry(
  slug: string,
  entryId: string,
): Promise<ActionResult> {
  const user = await requireAppUser();
  const portfolio = await requireEditablePortfolio(slug, user);
  if (!portfolio) {
    return { ok: false, error: "Portfólio não encontrado ou sem permissão." };
  }

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("kind, storage_key")
    .eq("id", entryId)
    .eq("portfolio_id", portfolio.id)
    .maybeSingle();

  if (entry) {
    await deleteHostedObjects([entry]);
  }

  await supabase
    .from("entries")
    .delete()
    .eq("id", entryId)
    .eq("portfolio_id", portfolio.id);

  await recordAudit({
    actorId: user.id,
    action: "entry.delete",
    entity: "entry",
    entityId: entryId,
  });

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
