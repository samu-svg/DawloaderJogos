import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FREE_DOWNLOAD_ANNOUNCEMENT_SUBJECT,
  freeDownloadAnnouncementHtml,
} from "./marketing-mail.ts";

test("anúncio de download grátis não cita limitações do plano", () => {
  const html = freeDownloadAnnouncementHtml();
  assert.match(html, /download grátis/i);
  assert.doesNotMatch(html, /um jogo por vez/i);
  assert.doesNotMatch(html, /velocidade/i);
  assert.doesNotMatch(html, /limitad/i);
  assert.doesNotMatch(html, /plano Completo/i);
  assert.equal(
    FREE_DOWNLOAD_ANNOUNCEMENT_SUBJECT,
    "MontaHD agora permite download grátis",
  );
});
