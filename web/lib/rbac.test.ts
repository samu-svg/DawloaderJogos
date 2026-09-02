import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAccessPainel,
  canCreatePortfolio,
  canDeletePortfolio,
  canEditPortfolio,
  canManageSupport,
  hasMinRole,
  hasSubscriptionBypass,
  isBootstrapAdminEmail,
  parseRole,
} from "./rbac.ts";

test("hierarquia admin > editor > user", () => {
  assert.equal(hasMinRole("admin", "editor"), true);
  assert.equal(hasMinRole("editor", "admin"), false);
  assert.equal(canAccessPainel("editor"), true);
  assert.equal(canAccessPainel("user"), false);
  assert.equal(canCreatePortfolio("admin"), true);
  assert.equal(canCreatePortfolio("editor"), false);
  assert.equal(canDeletePortfolio("editor"), false);
  assert.equal(canEditPortfolio("editor"), true);
  assert.equal(hasSubscriptionBypass("admin"), true);
  assert.equal(hasSubscriptionBypass("user"), false);
});

test("parseRole só aceita papéis conhecidos", () => {
  assert.equal(parseRole("admin"), "admin");
  assert.equal(parseRole("editor"), "editor");
  assert.equal(parseRole("user"), "user");
  assert.equal(parseRole("superuser"), "user");
  assert.equal(parseRole(undefined), "user");
});

test("suporte só admin", () => {
  assert.equal(canManageSupport("admin"), true);
  assert.equal(canManageSupport("editor"), false);
  assert.equal(canManageSupport("user"), false);
});

test("bootstrap admin depende só da env, sem e-mail default", () => {
  const previous = process.env.PORTFOLIO_ADMIN_EMAIL;
  delete process.env.PORTFOLIO_ADMIN_EMAIL;
  assert.equal(isBootstrapAdminEmail("douradosamuel50@gmail.com"), false);
  process.env.PORTFOLIO_ADMIN_EMAIL = "ops@example.com";
  assert.equal(isBootstrapAdminEmail("ops@example.com"), true);
  assert.equal(isBootstrapAdminEmail("other@example.com"), false);
  if (previous === undefined) delete process.env.PORTFOLIO_ADMIN_EMAIL;
  else process.env.PORTFOLIO_ADMIN_EMAIL = previous;
});
