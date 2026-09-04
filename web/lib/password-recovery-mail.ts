import { logError } from "./logger.ts";

export type RecoveryMailInput = {
  to: string;
  otp: string;
  actionLink: string;
};

function resendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  const from =
    process.env.RESEND_FROM?.trim() || "MontaHD <noreply@montahds.app>";
  return { apiKey, from };
}

export function recoveryMailConfigured(): boolean {
  return resendConfig() !== null;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function recoveryHtml(input: RecoveryMailInput): string {
  const otp = escapeHtml(input.otp);
  const link = escapeHtml(input.actionLink);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h2 style="margin:0 0 12px">Redefinir senha — MontaHD</h2>
  <p>Recebemos um pedido para trocar a senha da sua conta.</p>
  <p style="font-size:14px;color:#555">Use o código no site (<strong>Esqueceu a senha?</strong>):</p>
  <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:16px 0">${otp}</p>
  <p style="font-size:14px;color:#555">Ou toque no botão (funciona no celular):</p>
  <p style="margin:20px 0">
    <a href="${link}" style="display:inline-block;background:#8b5cf6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Redefinir senha</a>
  </p>
  <p style="font-size:13px;color:#666">Se você não pediu isso, ignore este e-mail.</p>
</body>
</html>`;
}

export async function sendRecoveryMail(
  input: RecoveryMailInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const config = resendConfig();
  if (!config) {
    return { ok: false, reason: "RESEND_API_KEY não configurada." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: "Redefinir senha — MontaHD",
      html: recoveryHtml(input),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logError("Resend rejeitou e-mail de recuperação", body, {
      status: response.status,
    });
    return { ok: false, reason: "Resend rejeitou o envio." };
  }

  return { ok: true };
}
