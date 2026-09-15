import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SEO_KEYWORDS,
  buildHomeJsonLd,
  gamePageMetaDescription,
  gamePageMetaTitle,
  homeMetaDescription,
  homeMetaTitle,
} from "./seo-copy.ts";

test("titulo e descricao da home focam em baixar jogos xbox 360", () => {
  assert.match(homeMetaTitle(), /Baixar Jogos Xbox 360/i);
  assert.match(homeMetaDescription(), /Baixe jogos Xbox 360/i);
  assert.match(homeMetaDescription(), /RGH/i);
  assert.match(homeMetaDescription(), /semanais/i);
});

test("keywords incluem variantes xbox360 e baixar", () => {
  const joined = SEO_KEYWORDS.join(" ").toLowerCase();
  assert.match(joined, /jogos xbox 360/);
  assert.match(joined, /baixar jogos xbox 360/);
  assert.match(joined, /xbox360/);
});

test("meta de pagina de jogo cita baixar e xbox 360", () => {
  assert.match(
    gamePageMetaTitle("GTA V", "RGH"),
    /Baixar GTA V.*Xbox 360.*RGH/i,
  );
  assert.match(
    gamePageMetaDescription("GTA V", "RGH"),
    /Baixe GTA V.*Xbox 360/i,
  );
});

test("json-ld da home inclui FAQ e lista de jogos", () => {
  const data = buildHomeJsonLd({
    siteUrl: "https://www.montahds.app/",
    logoUrl: "https://www.montahds.app/montahd-icon.png",
    games: [{ slug: "gta-v", label: "GTA V" }],
  });
  const graph = (data["@graph"] ?? []) as { "@type"?: string }[];
  const types = graph.map((node) => node["@type"]);
  assert.ok(types.includes("Organization"));
  assert.ok(types.includes("WebSite"));
  assert.ok(types.includes("ItemList"));
  assert.ok(types.includes("FAQPage"));
});
