/** Tempo até remover o âncora oculta usada para abrir o protocolo. */
export const LAUNCH_ANCHOR_CLEANUP_MS = 4000;

const PROTOCOL_PREFIX = "montahd://";

export type LaunchMontaHdHost = {
  createElement: (tagName: "a") => {
    style: { display: string };
    href: string;
    setAttribute: (name: string, value: string) => void;
    click: () => void;
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
    body: {
      appendChild(node) {
        document.body.appendChild(node as Node);
      },
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  };
}

/**
 * Abre um deep link `montahd://` sem navegar a página (`location.href`)
 * e sem iframe — o CSP de produção só permite `frame-src` para o próprio
 * site e o Stripe, então `montahd://` num iframe é bloqueado.
 */
export function launchMontaHdProtocol(
  deepLink: string,
  host: LaunchMontaHdHost | null = defaultHost(),
): void {
  if (!host?.body) return;
  if (!deepLink.startsWith(PROTOCOL_PREFIX)) return;

  const anchor = host.createElement("a");
  anchor.setAttribute("hidden", "");
  anchor.setAttribute("aria-hidden", "true");
  anchor.setAttribute("tabindex", "-1");
  anchor.setAttribute("rel", "noopener");
  anchor.style.display = "none";
  anchor.href = deepLink;
  host.body.appendChild(anchor);
  anchor.click();

  host.setTimeout(() => {
    anchor.remove();
  }, LAUNCH_ANCHOR_CLEANUP_MS);
}
