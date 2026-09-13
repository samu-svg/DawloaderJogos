/**
 * Envia e-mail de novidade (download grátis) para usuários cadastrados no Supabase.
 *
 * Uso:
 *   node --env-file=.env.local --experimental-strip-types scripts/send-free-download-announcement.ts --dry-run
 *   node --env-file=.env.local --experimental-strip-types scripts/send-free-download-announcement.ts --test seu@email.com
 *   node --env-file=.env.local --experimental-strip-types scripts/send-free-download-announcement.ts
 *
 * Flags:
 *   --dry-run     Lista destinatários sem enviar
 *   --test EMAIL  Envia só para um endereço (teste)
 *   --all         Inclui e-mails ainda não confirmados (padrão: só confirmados)
 */

import { createServiceRoleClient } from "../lib/supabase/service-role.ts";
import {
  BATCH_SIZE,
  FREE_DOWNLOAD_ANNOUNCEMENT_SUBJECT,
  freeDownloadAnnouncementHtml,
  marketingMailConfigured,
  sendMarketingEmail,
  sendMarketingEmailBatch,
} from "../lib/marketing-mail.ts";

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const includeUnconfirmed = argv.includes("--all");
  const testIndex = argv.indexOf("--test");
  const testEmail =
    testIndex >= 0 ? argv[testIndex + 1]?.trim().toLowerCase() : undefined;
  if (testIndex >= 0 && !testEmail) {
    console.error("Use --test com um endereço de e-mail.");
    process.exit(1);
  }
  return { dryRun, includeUnconfirmed, testEmail };
}

async function listRecipientEmails(includeUnconfirmed: boolean): Promise<string[]> {
  const admin = createServiceRoleClient();
  const emails = new Set<string>();
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    for (const user of data.users) {
      const email = user.email?.trim().toLowerCase();
      if (!email) continue;
      if (!includeUnconfirmed && !user.email_confirmed_at) continue;
      emails.add(email);
    }

    if (data.users.length < 1000) break;
    page += 1;
  }

  return [...emails].sort();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { dryRun, includeUnconfirmed, testEmail } = parseArgs(process.argv.slice(2));

  if (!dryRun && !testEmail && !marketingMailConfigured()) {
    console.error(
      "Configure RESEND_API_KEY (e opcionalmente RESEND_MARKETING_FROM) antes de enviar.",
    );
    process.exit(1);
  }

  const html = freeDownloadAnnouncementHtml();
  const subject = FREE_DOWNLOAD_ANNOUNCEMENT_SUBJECT;

  if (testEmail) {
    console.log(`Modo teste → ${testEmail}`);
    if (dryRun) {
      console.log("Assunto:", subject);
      console.log(html.slice(0, 200) + "...");
      return;
    }
    const result = await sendMarketingEmail({ to: testEmail, subject, html });
    if (!result.ok) {
      console.error("Falha:", result.reason);
      process.exit(1);
    }
    console.log("Enviado.", result.id ? `id=${result.id}` : "");
    return;
  }

  const recipients = await listRecipientEmails(includeUnconfirmed);
  console.log(
    `Destinatários: ${recipients.length} (${includeUnconfirmed ? "todos" : "e-mail confirmado"})`,
  );

  if (dryRun) {
    console.log("Primeiros 10:", recipients.slice(0, 10).join(", ") || "(nenhum)");
    return;
  }

  if (recipients.length === 0) {
    console.log("Nenhum destinatário.");
    return;
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const result = await sendMarketingEmailBatch({
      recipients: batch,
      subject,
      html,
    });
    sent += result.sent;
    failed += result.failed;
    errors.push(...result.errors);
    console.log(
      `Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${result.sent} enviados`,
    );
    if (i + BATCH_SIZE < recipients.length) {
      await sleep(600);
    }
  }

  console.log(`Concluído. Enviados: ${sent}, falhas: ${failed}`);
  if (errors.length > 0) {
    console.error("Erros:", errors.slice(0, 5).join("\n"));
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
