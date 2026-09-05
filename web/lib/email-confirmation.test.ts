import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMAIL_CONFIRM_PATH,
  authCallbackFailurePath,
  authCallbackUrl,
  confirmEmailPath,
  isEmailConfirmationType,
  resolveAuthCallbackKind,
} from "./email-confirmation.ts";

test("callback de cadastro não cai em esqueci a senha", () => {
  assert.equal(resolveAuthCallbackKind({ type: "signup", intent: null }), "confirm");
  assert.equal(
    resolveAuthCallbackKind({ type: null, intent: "confirm", nonce: "abc" }),
    "confirm",
  );
  assert.equal(
    authCallbackFailurePath("confirm", "expirado"),
    `${EMAIL_CONFIRM_PATH}?expirado=1`,
  );
  assert.equal(
    authCallbackFailurePath("recovery", "erro"),
    "/esqueci-senha?erro=1",
  );
});

test("recovery continua recovery mesmo com nonce", () => {
  assert.equal(
    resolveAuthCallbackKind({ type: "recovery", nonce: null }),
    "recovery",
  );
  assert.equal(
    resolveAuthCallbackKind({ type: null, nonce: "abc" }),
    "recovery",
  );
});

test("monta URL de confirmação com e-mail válido", () => {
  assert.equal(confirmEmailPath(), EMAIL_CONFIRM_PATH);
  assert.equal(
    confirmEmailPath({ email: "a@b.com", enviado: true }),
    `${EMAIL_CONFIRM_PATH}?email=a%40b.com&enviado=1`,
  );
  assert.equal(confirmEmailPath({ email: "nao-e-email" }), EMAIL_CONFIRM_PATH);
  assert.equal(
    confirmEmailPath({ email: "a@b.com", pendente: true }),
    `${EMAIL_CONFIRM_PATH}?email=a%40b.com&pendente=1`,
  );
  assert.equal(
    authCallbackUrl("https://www.montahds.app", "confirm"),
    "https://www.montahds.app/auth/callback?intent=confirm",
  );
  assert.equal(isEmailConfirmationType("signup"), true);
  assert.equal(isEmailConfirmationType("recovery"), false);
});
