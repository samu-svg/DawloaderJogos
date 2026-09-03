/** Tempo até remover o iframe oculto usado para abrir o protocolo. */
export const LAUNCH_IFRAME_CLEANUP_MS = 4000;

const PROTOCOL_PREFIX = "montahd://";

export type LaunchMontaHdHost = {
  createElement: (tagName: "iframe") => {
    style: { display: string };
    src: string;
    setAttribute: (name: string, value: string) => void;
    remove: () => void;
  };
  body: { appendChild: (node: unknown) => void } | null;
  setTimeout: (fn: () => void, ms: number) => unknown;
};

function defaultHost(): LaunchMontaHdHost | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  if (!document.body) return null;
  return {
    createElement: (tagName) => document.createElement(tagName),
    body: document.body,
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  };
}

/**
 * Abre um deep link `montahd://` sem navegar a página (`location.href`).
 * Usa um iframe oculto e remove depois de alguns segundos.
 */
export function launchMontaHdProtocol(
  deepLink: string,
  host: LaunchMontaHdHost | null = defaultHost(),
): void {
  if (!host?.body) return;
  if (!deepLink.startsWith(PROTOCOL_PREFIX)) return;

  const iframe = host.createElement("iframe");
  iframe.setAttribute("hidden", "");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.style.display = "none";
  iframe.src = deepLink;
  host.body.appendChild(iframe);

  host.setTimeout(() => {
    iframe.remove();
  }, LAUNCH_IFRAME_CLEANUP_MS);
}
