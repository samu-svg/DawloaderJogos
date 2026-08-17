/**
 * Hosts that only publish a share *page*: the file is behind a session, an
 * anti-robot check or a JS player, so no program can fetch the bytes from the
 * link the person copies.
 */
const SHARE_ONLY_HOSTS: { match: RegExp; name: string }[] = [
  { match: /(^|\.)(terabox|1024tera|1024terabox|teraboxapp|4funbox|freeterabox|dubox)\./, name: "TeraBox" },
  { match: /(^|\.)mega\.(nz|io)$/, name: "MEGA" },
  { match: /(^|\.)mediafire\.com$/, name: "MediaFire" },
  { match: /(^|\.)pcloud\.(com|link)$/, name: "pCloud" },
  { match: /(^|\.)wetransfer\.com$/, name: "WeTransfer" },
  { match: /(^|\.)sendspace\.com$/, name: "SendSpace" },
  { match: /(^|\.)1fichier\.com$/, name: "1fichier" },
];

export function shareOnlyHostName(url: string): string | null {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return SHARE_ONLY_HOSTS.find((entry) => entry.match.test(host))?.name ?? null;
  } catch {
    return null;
  }
}

function googleDriveFileId(url: URL): string | null {
  const fromPath = /\/file\/d\/([\w-]{10,})/.exec(url.pathname);
  if (fromPath) return fromPath[1];

  const id = url.searchParams.get("id");
  return id && /^[\w-]{10,}$/.test(id) ? id : null;
}

/**
 * Turns a share link into the address that actually serves the bytes, for the
 * hosts that publish one. Anything else is returned untouched.
 */
export function normalizeDirectUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim();
  }

  const host = url.hostname.toLowerCase();

  if (host.endsWith("drive.google.com") || host.endsWith("drive.usercontent.google.com")) {
    const id = googleDriveFileId(url);
    if (id) {
      return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
    }
  }

  if (host.endsWith("dropbox.com")) {
    url.searchParams.set("dl", "1");
    return url.toString();
  }

  // github.com/user/repo/blob/... só devolve a página; raw entrega o arquivo.
  if (host === "github.com" && url.pathname.includes("/blob/")) {
    return `https://raw.githubusercontent.com${url.pathname.replace("/blob/", "/")}`;
  }

  return url.toString();
}
