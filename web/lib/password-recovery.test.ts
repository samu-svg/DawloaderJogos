import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPasswordRecoveryCallback,
  isPasswordRecoveryPath,
  isWellFormedEmail,
  safeEqual,
} from "./password-recovery.ts";

test("reconhece o fluxo de redefinição", () => {
  assert.equal(isPasswordRecoveryPath("/redefinir-senha"), true);
  assert.equal(isPasswordRecoveryPath("/api/auth/reset-password"), true);
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
