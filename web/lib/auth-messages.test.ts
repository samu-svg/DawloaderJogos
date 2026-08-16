import assert from "node:assert/strict";
import { test } from "node:test";
import { authErrorMessage, SIGNUP_CONFIRM_MESSAGE } from "./auth-messages.ts";

test("cadastro pede confirmação sem citar provedor", () => {
  assert.match(SIGNUP_CONFIRM_MESSAGE, /código/i);
  assert.doesNotMatch(SIGNUP_CONFIRM_MESSAGE, /supabase/i);
});

test("mapeia e-mail não confirmado", () => {
  assert.equal(
    authErrorMessage("Email not confirmed"),
    "Enviamos um código para seu e-mail. Confirme antes de entrar.",
  );
});

test("esconde mensagens técnicas", () => {
  const msg = authErrorMessage("Postgres connection failed via supabase");
  assert.doesNotMatch(msg.toLowerCase(), /supabase|postgres/);
});
