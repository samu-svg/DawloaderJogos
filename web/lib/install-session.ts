import { createHmac, timingSafeEqual } from "node:crypto";

export type InstallSessionPayload = {
  typ: "install";
  sub: string;
  slug: string;
  entries?: string[];
  exp: number;
};

function tokenSecret(): string | null {
  return process.env.MANIFEST_TOKEN_SECRET?.trim() || null;
}

export function createInstallSessionToken(input: {
  userId: string;
  slug: string;
  entryIds?: string[];
  ttlSeconds?: number;
}): string | null {
  const secret = tokenSecret();
  if (!secret) return null;

  const payload: InstallSessionPayload = {
    typ: "install",
    sub: input.userId,
    slug: input.slug,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 900),
  };

  if (input.entryIds?.length) {
    payload.entries = input.entryIds;
  }

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyInstallSessionToken(token: string): InstallSessionPayload | null {
  const secret = tokenSecret();
  if (!secret) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as InstallSessionPayload;

    if (payload.typ !== "install") return null;
    if (!payload.sub || !payload.slug || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
