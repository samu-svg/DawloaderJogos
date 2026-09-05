import { Readable } from "node:stream";

type WebReadable = {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: Uint8Array }>;
    releaseLock: () => void;
  };
};

async function* webStreamChunks(stream: WebReadable): AsyncGenerator<Buffer> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield Buffer.from(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Node 18+ tem `Readable.fromWeb`. Electron 22 (Node 16) recebe o body do undici
 * como web stream e precisa do fallback.
 */
export function readableFromWebBody(body: unknown): Readable {
  if (!body) {
    throw new Error("Resposta sem corpo para gravar.");
  }

  const fromWeb = (
    Readable as unknown as {
      fromWeb?: (stream: unknown) => Readable;
    }
  ).fromWeb;
  if (typeof fromWeb === "function") {
    return fromWeb(body);
  }

  if (typeof (body as Readable).on === "function" && typeof (body as Readable).pipe === "function") {
    return body as Readable;
  }

  if (typeof (body as WebReadable).getReader === "function") {
    return Readable.from(webStreamChunks(body as WebReadable));
  }

  throw new Error("Não foi possível ler o download neste Windows.");
}
