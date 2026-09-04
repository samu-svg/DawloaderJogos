import assert from "node:assert/strict";
import { test } from "node:test";
import { authErrorMessage, FORGOT_PASSWORD_SENT_MESSAGE, SIGNUP_CONFIRM_MESSAGE } from "./auth-messages.ts";

test("cadastro pede confirmação sem citar provedor", () => {
  assert.match(SIGNUP_CONFIRM_MESSAGE, /código/i);
  assert.doesNotMatch(SIGNUP_CONFIRM_MESSAGE, /supabase/i);
});

test("mensagem de recuperação não revela se o e-mail existe", () => {
  assert.match(FORGOT_PASSWORD_SENT_MESSAGE, /se este e-mail estiver cadastrado/i);
  assert.doesNotMatch(FORGOT_PASSWORD_SENT_MESSAGE, /supabase/i);
});

test("mapeia senha igual à anterior", () => {
  assert.equal(
    authErrorMessage("New password should be different from the old password."),
    "A nova senha precisa ser diferente da atual.",
  );
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

test("mapeia excesso de tentativas", () => {
  assert.equal(
    authErrorMessage("Too many requests"),
    "Muitas tentativas. Aguarde um instante.",
  );
});

test("preserva e-mail inválido já em português", () => {
  assert.equal(
    authErrorMessage("Informe um e-mail válido."),
    "Informe um e-mail válido.",
  );
});
