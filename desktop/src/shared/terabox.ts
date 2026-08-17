const TERABOX_HOSTS = [
  "terabox.com",
  "1024tera.com",
  "1024terabox.com",
  "4funbox.com",
  "freeterabox.com",
  "teraboxapp.com",
  "dubox.com",
];

export function isTeraboxUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url.trim());
    if (protocol !== "http:" && protocol !== "https:") return false;
    const host = hostname.toLowerCase().replace(/^www\./, "");
    return TERABOX_HOSTS.some(
      (known) => host === known || host.endsWith(`.${known}`),
    );
  } catch {
    return false;
  }
}
