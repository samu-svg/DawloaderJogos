import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authErrorMessage,
  CONFIRM_EMAIL_SENT_MESSAGE,
  FORGOT_PASSWORD_SENT_MESSAGE,
  SIGNUP_CONFIRM_MESSAGE,
  isEmailNotConfirmedMessage,
} from "./auth-messages.ts";

test("cadastro pede confirmação sem citar provedor", () => {
  assert.match(SIGNUP_CONFIRM_MESSAGE, /código/i);
  assert.doesNotMatch(SIGNUP_CONFIRM_MESSAGE, /supabase/i);
});

test("mensagem de recuperação não revela se o e-mail existe", () => {
  assert.match(FORGOT_PASSWORD_SENT_MESSAGE, /se este e-mail estiver cadastrado/i);
  assert.match(FORGOT_PASSWORD_SENT_MESSAGE, /código/i);
  assert.doesNotMatch(FORGOT_PASSWORD_SENT_MESSAGE, /supabase/i);
});

test("mapeia senha igual à anterior", () => {
  assert.equal(
    authErrorMessage("New password should be different from the old password."),
    "A nova senha precisa ser diferente da atual.",
  );
});

test("reenvio de confirmação não revela se o e-mail existe", () => {
  assert.match(CONFIRM_EMAIL_SENT_MESSAGE, /se este e-mail precisar/i);
  assert.doesNotMatch(CONFIRM_EMAIL_SENT_MESSAGE, /supabase/i);
});

test("mapeia e-mail não confirmado", () => {
  assert.equal(
    authErrorMessage("Email not confirmed"),
    "Digite o código que enviamos por e-mail para confirmar a conta.",
  );
  assert.equal(isEmailNotConfirmedMessage("Email not confirmed"), true);
  assert.equal(isEmailNotConfirmedMessage("Invalid login credentials"), false);
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

test("não reescreve erro de origem já em português", () => {
  assert.equal(
    authErrorMessage("Origem não permitida."),
    "Origem não permitida.",
  );
});

test("não reescreve e-mail já cadastrado", () => {
  assert.equal(
    authErrorMessage("Este e-mail já está cadastrado."),
    "Este e-mail já está cadastrado.",
  );
});
