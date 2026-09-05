import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideExistingSignup,
  findUserInAdminList,
  isAuthEmailConfirmed,
  parseAdminUsersList,
} from "./auth-user-status.ts";
import { confirmEmailPath, EMAIL_CONFIRM_PATH } from "./email-confirmation.ts";

test("lista admin aceita { users } ou array", () => {
  assert.deepEqual(
    parseAdminUsersList({
      users: [{ email: "a@b.com", email_confirmed_at: null }],
    }),
    [{ email: "a@b.com", email_confirmed_at: null }],
  );
  assert.deepEqual(parseAdminUsersList([{ email: "a@b.com" }]), [
    { email: "a@b.com" },
  ]);
  assert.deepEqual(parseAdminUsersList(null), []);
  assert.deepEqual(parseAdminUsersList({ users: "nope" }), []);
});

test("encontra o e-mail exato na lista admin", () => {
  const users = [
    { email: "outro@b.com", email_confirmed_at: "2024-01-01T00:00:00Z" },
    { email: "A@B.com", email_confirmed_at: null },
  ];
  assert.equal(findUserInAdminList(users, "a@b.com")?.email, "A@B.com");
  assert.equal(findUserInAdminList(users, "nao@existe.com"), null);
});

test("e-mail confirmado usa email_confirmed_at ou confirmed_at", () => {
  assert.equal(isAuthEmailConfirmed(null), false);
  assert.equal(isAuthEmailConfirmed({ email_confirmed_at: null }), false);
  assert.equal(
    isAuthEmailConfirmed({ email_confirmed_at: "2024-01-01T00:00:00Z" }),
    true,
  );
  assert.equal(
    isAuthEmailConfirmed({ confirmed_at: "2024-01-01T00:00:00Z" }),
    true,
  );
});

test("cadastro existente não confirmado reenvia; confirmado recusa", () => {
  assert.equal(decideExistingSignup(null), "unknown");
  assert.equal(
    decideExistingSignup({ email: "a@b.com", email_confirmed_at: null }),
    "resend",
  );
  assert.equal(
    decideExistingSignup({
      email: "a@b.com",
      email_confirmed_at: "2024-01-01T00:00:00Z",
    }),
    "reject",
  );
});

test("CTA de reenvio no cadastro leva o e-mail para confirmar-email", () => {
  assert.equal(
    confirmEmailPath({ email: "pendente@exemplo.com" }),
    `${EMAIL_CONFIRM_PATH}?email=pendente%40exemplo.com`,
  );
  assert.equal(
    confirmEmailPath({ email: "pendente@exemplo.com", enviado: true }),
    `${EMAIL_CONFIRM_PATH}?email=pendente%40exemplo.com&enviado=1`,
  );
});
