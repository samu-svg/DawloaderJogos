import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPasswordRecoveryCallback,
  isPasswordRecoveryPath,
  isWellFormedEmail,
  isWellFormedRecoveryOtp,
  normalizeRecoveryOtp,
  parseAuthCallbackHash,
  safeEqual,
} from "./password-recovery.ts";

test("reconhece o fluxo de redefinição", () => {
  assert.equal(isPasswordRecoveryPath("/redefinir-senha"), true);
  assert.equal(isPasswordRecoveryPath("/api/auth/reset-password"), true);
  assert.equal(isPasswordRecoveryPath("/api/auth/verify-recovery"), true);
  assert.equal(isPasswordRecoveryPath("/baixar"), false);
});

test("callback de recuperação pelo tipo ou pelo nonce do pedido", () => {
  assert.equal(
    isPasswordRecoveryCallback({ type: "recovery", nonce: null }),
    true,
  );
  assert.equal(
    isPasswordRecoveryCallback({ type: null, nonce: "abc" }),
    true,
  );
  assert.equal(
    isPasswordRecoveryCallback({ type: "signup", nonce: null }),
    false,
  );
});

test("lê tokens do hash do e-mail de recuperação", () => {
  assert.deepEqual(
    parseAuthCallbackHash(
      "#access_token=aaa&refresh_token=bbb&type=recovery",
    ),
    { type: "recovery", accessToken: "aaa", refreshToken: "bbb" },
  );
  assert.deepEqual(parseAuthCallbackHash(""), {
    type: null,
    accessToken: null,
    refreshToken: null,
  });
});

test("código de recuperação", () => {
  assert.equal(normalizeRecoveryOtp("12 3456"), "123456");
  assert.equal(isWellFormedRecoveryOtp("123456"), true);
  assert.equal(isWellFormedRecoveryOtp("12"), false);
});

test("e-mail bem formado", () => {
  assert.equal(isWellFormedEmail("a@b.com"), true);
  assert.equal(isWellFormedEmail("nao-e-email"), false);
  assert.equal(isWellFormedEmail("a@b"), false);
  assert.equal(isWellFormedEmail("a @b.com"), false);
});

test("comparação em tempo constante", () => {
  assert.equal(safeEqual("abcd", "abcd"), true);
  assert.equal(safeEqual("abcd", "abce"), false);
  assert.equal(safeEqual("ab", "abcd"), false);
});
