export function assertHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL inválida.");
  }
  return parsed;
}

/** Comando Windows sem shell: argv isolado, sem interpretar &, |, ^ ou `. */
export function windowsExternalOpenCommand(url: string): {
  command: string;
  args: string[];
} {
  const safeUrl = assertHttpUrl(url).toString();
  return {
    command: "rundll32",
    args: ["url.dll,FileProtocolHandler", safeUrl],
  };
}
