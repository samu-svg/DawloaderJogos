import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FREE_PLAN_NAME,
  PAID_PLAN_NAME,
  freePlanSpeedLabel,
  freePlanSummary,
  paidPlanSummary,
  siteMetaDescription,
} from "./plan-copy.ts";

test("nomes oficiais dos planos", () => {
  assert.equal(FREE_PLAN_NAME, "Grátis");
  assert.equal(PAID_PLAN_NAME, "Completo");
});

test("resumo grátis cita 5 Mbps e um jogo", () => {
  assert.equal(freePlanSpeedLabel(), "até 5 Mbps");
  assert.match(freePlanSummary(), /Um jogo por vez/);
  assert.match(freePlanSummary(), /5 Mbps/);
});

test("resumo completo fala em lote e velocidade", () => {
  assert.match(paidPlanSummary(), /lote/i);
  assert.match(paidPlanSummary(), /velocidade máxima/i);
});

test("meta do site cita os dois planos", () => {
  const meta = siteMetaDescription();
  assert.match(meta, /Grátis/);
  assert.match(meta, /Completo/);
  assert.match(meta, /software MontaHD/);
});
