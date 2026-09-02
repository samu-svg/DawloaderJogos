/** Validação e constantes do suporte in-site (sem e-mail externo). */

export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_BODY_MIN = 1;
export const SUPPORT_BODY_MAX = 4000;
/** Tickets ativos (open + answered) por usuário. */
export const SUPPORT_MAX_OPEN_TICKETS = 3;

export type SupportTicketStatus = "open" | "answered" | "closed";

export function sanitizeSupportText(raw: string): string {
  return raw
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function validateSupportSubject(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = sanitizeSupportText(raw).replace(/\n+/g, " ");
  if (value.length < SUPPORT_SUBJECT_MIN) {
    return { ok: false, error: "Assunto muito curto." };
  }
  if (value.length > SUPPORT_SUBJECT_MAX) {
    return { ok: false, error: "Assunto muito longo." };
  }
  return { ok: true, value };
}

export function validateSupportBody(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = sanitizeSupportText(raw);
  if (value.length < SUPPORT_BODY_MIN) {
    return { ok: false, error: "Escreva uma mensagem." };
  }
  if (value.length > SUPPORT_BODY_MAX) {
    return { ok: false, error: "Mensagem muito longa." };
  }
  return { ok: true, value };
}

export function parseSupportStatus(
  value: string | null | undefined,
): SupportTicketStatus | null {
  if (value === "open" || value === "answered" || value === "closed") {
    return value;
  }
  return null;
}

export function supportStatusLabel(status: SupportTicketStatus): string {
  switch (status) {
    case "open":
      return "Aberto";
    case "answered":
      return "Respondido";
    case "closed":
      return "Fechado";
  }
}
