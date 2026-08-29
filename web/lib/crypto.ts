import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const PREFIX = "v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não está definida. Use 32 bytes em hex (64 caracteres).",
    );
  }

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === 32) return fromBase64;

  throw new Error("ENCRYPTION_KEY deve ter 32 bytes (hex de 64 chars ou base64).");
}

export function encryptSensitive(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, encrypted, tag]).toString("base64url");
}

export function decryptSensitive(value: string): string {
  if (!isEncrypted(value)) return value;

  const key = encryptionKey();
  const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Payload cifrado inválido.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function fingerprintLookup(fingerprint: string): string {
  const key = encryptionKey();
  return createHmac("sha256", key).update(fingerprint.trim().toLowerCase()).digest("hex");
}
