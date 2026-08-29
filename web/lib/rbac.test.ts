import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAccessPainel,
  canCreatePortfolio,
  canDeletePortfolio,
  canEditPortfolio,
  hasMinRole,
  hasSubscriptionBypass,
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
