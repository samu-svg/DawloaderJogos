import test from "node:test";
import assert from "node:assert/strict";
import { parseMontaHDDeepLink } from "./catalog-launch.ts";

test("parseia varios ids no parametro entries", () => {
  const launch = parseMontaHDDeepLink(
    "montahd://open?url=https%3A%2F%2Fmontahd.vercel.app&slug=jogos360&entries=id-a,id-b,id-c&token=tok",
  );

  assert.ok(launch);
  assert.deepEqual(launch.entryIds, ["id-a", "id-b", "id-c"]);
  assert.equal(launch.manifestToken, "tok");
});

test("aceita launch so com token (ids ficam no manifesto filtrado)", () => {
  const launch = parseMontaHDDeepLink(
    "montahd://open?url=https%3A%2F%2Fmontahd.vercel.app&slug=jogos360&token=tok",
  );

  assert.ok(launch);
  assert.deepEqual(launch.entryIds, []);
  assert.equal(launch.manifestToken, "tok");
});
