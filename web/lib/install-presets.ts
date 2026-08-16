import { validateDestination } from "./manifest";

export type FolderPreset = "games" | "content" | "custom";

export function buildDestination(
  preset: FolderPreset,
  fileName: string,
  customPath?: string,
  contentTitleId?: string,
): { ok: true; destination: string } | { ok: false; error: string } {
  const safeName = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!safeName) {
    return { ok: false, error: "Informe o nome do arquivo com extensão." };
  }

  let raw: string;
  switch (preset) {
    case "games":
      raw = `Games/${safeName}`;
      break;
    case "content": {
      const id = (contentTitleId ?? "0000000000000000").trim();
      if (!/^[0-9a-fA-F]{16}$/.test(id)) {
        return {
          ok: false,
          error: "O ID do Content deve ter 16 caracteres hexadecimais.",
        };
      }
      raw = `Content/${id}/${safeName}`;
      break;
    }
    case "custom":
      raw = (customPath ?? "").trim();
      if (!raw) {
        return { ok: false, error: "Informe o caminho personalizado." };
      }
      break;
  }

  return validateDestination(raw);
}

export function presetLabel(preset: FolderPreset): string {
  switch (preset) {
    case "games":
      return "Games (jogo ISO)";
    case "content":
      return "Content (DLC / extra)";
    case "custom":
      return "Personalizado";
  }
}

/** Destino para pasta inteira (importação local — ex.: jogo baixado do TeraBox). */
export function buildFolderDestination(
  preset: FolderPreset,
  folderName: string,
  customPath?: string,
  contentTitleId?: string,
): { ok: true; destination: string } | { ok: false; error: string } {
  const safeName = folderName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!safeName) {
    return { ok: false, error: "Informe o nome da pasta do jogo." };
  }

  let raw: string;
  switch (preset) {
    case "games":
      raw = `Games/${safeName}`;
      break;
    case "content": {
      const id = (contentTitleId ?? "0000000000000000").trim();
      if (!/^[0-9a-fA-F]{16}$/.test(id)) {
        return {
          ok: false,
          error: "O ID do Content deve ter 16 caracteres hexadecimais.",
        };
      }
      raw = `Content/${id}/${safeName}`;
      break;
    }
    case "custom":
      raw = (customPath ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
      if (!raw) {
        return { ok: false, error: "Informe o caminho personalizado da pasta." };
      }
      break;
  }

  return validateDestination(raw);
}
