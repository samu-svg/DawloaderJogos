const SITE_ORIGIN = "https://montahds.app";

export const FREE_DOWNLOAD_ANNOUNCEMENT_SUBJECT =
  "MontaHD agora permite download grátis";

export function freeDownloadAnnouncementHtml(): string {
  const baixarUrl = `${SITE_ORIGIN}/baixar`;
  const loginUrl = `${SITE_ORIGIN}/login`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
  <h2 style="margin:0 0 16px">Novidade no MontaHD</h2>
  <p>Olá!</p>
  <p>
    Temos uma novidade: o <strong>MontaHD</strong> agora permite
    <strong>download grátis</strong> de jogos para o seu HD.
  </p>
  <p>
    Crie sua conta (ou entre na que você já tem), baixe o app e comece a montar
    seu acervo direto no console.
  </p>
  <p style="margin:24px 0">
    <a href="${baixarUrl}"
       style="display:inline-block;background:#8b5cf6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      Baixar o app MontaHD
    </a>
  </p>
  <p style="font-size:14px;color:#555">
    Já tem conta?
    <a href="${loginUrl}" style="color:#8b5cf6">Entrar no site</a>
  </p>
  <p style="font-size:13px;color:#888;margin-top:32px">
    Você recebeu este e-mail porque tem cadastro no MontaHD.
  </p>
</body>
</html>`;
}

function marketingFromAddress(): string | null {
  const from =
    process.env.RESEND_MARKETING_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "MontaHD <ola@montahds.app>";
  return from || null;
}

function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

export function marketingMailConfigured(): boolean {
  return resendApiKey() !== null && marketingFromAddress() !== null;
}

export type MarketingSendResult =
  | { ok: true; id?: string }
  | { ok: false; reason: string };

/** Um destinatário via API transacional do Resend. */
export async function sendMarketingEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<MarketingSendResult> {
  const apiKey = resendApiKey();
  const from = marketingFromAddress();
  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY não configurada." };
  }
  if (!from) {
    return { ok: false, reason: "Remetente de marketing não configurado." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, reason: body || `HTTP ${response.status}` };
  }

  const payload = (await response.json()) as { id?: string };
  return { ok: true, id: payload.id };
}

const BATCH_SIZE = 100;

/** Até 100 destinatários por chamada (limite da API batch do Resend). */
export async function sendMarketingEmailBatch(input: {
  recipients: string[];
  subject: string;
  html: string;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const apiKey = resendApiKey();
  const from = marketingFromAddress();
  if (!apiKey || !from) {
    return {
      sent: 0,
      failed: input.recipients.length,
      errors: ["Resend não configurado."],
    };
  }

  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      input.recipients.map((to) => ({
        from,
        to: [to],
        subject: input.subject,
        html: input.html,
      })),
    ),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      sent: 0,
      failed: input.recipients.length,
      errors: [body || `HTTP ${response.status}`],
    };
  }

  const payload = (await response.json()) as { data?: { id?: string }[] };
  const sent = payload.data?.length ?? input.recipients.length;
  return { sent, failed: 0, errors: [] };
}

export { BATCH_SIZE };
