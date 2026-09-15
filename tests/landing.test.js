import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GLYPHS } from "../src/landing-glyphs.js";
import { cutGeometry, automaticBridges, flatten } from "../src/geometry.js";
import opentype from "opentype.js";

test("landing glyph data is real geometry: every sample has bridges and no untouched closed contour", () => {
  assert.ok(GLYPHS.length >= 5);
  for (const g of GLYPHS) {
    assert.match(g.viewBox, /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/);
    assert.ok(g.outline.startsWith("M") && g.outline.includes("Z"));
    assert.ok(g.bridges.length >= 2, `${g.char} has bridges`);
    assert.ok(g.cut.length > g.outline.length / 2);
    // The cut path must differ from the plain outline (bridge side walls added).
    assert.notEqual(g.cut, g.outline);
  }
  assert.deepEqual(
    GLYPHS.map((g) => g.char),
    ["A", "O", "R", "8", "日", "あ"],
  );
});

test("landing sample 日 matches a fresh run of the bridge pipeline on the bundled serif font", () => {
  const font = opentype.parse(
    fs.readFileSync("public/fonts/ShipporiMincho-Regular.ttf").buffer,
  );
  const item = {
    id: "t",
    type: "outline",
    x: 0,
    y: 0,
    rotation: 0,
    contours: flatten(font.getPath("日", 0, 40, 40).commands),
  };
  const bridges = automaticBridges([item]);
  const cut = cutGeometry([item, ...bridges]);
  assert.equal(bridges.length, GLYPHS.find((g) => g.char === "日").bridges.length);
  assert.equal(cut.untouched, 0);
});

test("landing page HTML has the required SEO metadata, CTA and Coming Soon labels", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /<title>TypeFab — Laser-Cut Typography &amp; SVG Editor<\/title>/);
  assert.match(html, /name="description" content="Create laser-cut-ready typography/);
  for (const p of ["og:title", "og:description", "og:image", "og:url", "twitter:card", "twitter:image"])
    assert.match(html, new RegExp(`(property|name)="${p}"`), p);
  assert.match(html, /href="\/favicon\.svg"/);
  // Editor links fall back to "./app/" without JS and are rewritten by landing.js.
  assert.ok((html.match(/href="\.\/app\/" data-editor/g) || []).length >= 3);
  assert.match(html, /rel="canonical" href="https:\/\/fooping-tech\.github\.io\/TypeFab\/"/);
  assert.match(html, /github\.com\/fooping-tech\/TypeFab/);
  // Unimplemented ordering is labelled, never shown as available.
  assert.ok(html.includes("ORDER <span class=\"badge\">Coming Soon</span>"));
  assert.ok(html.includes("Design it. We cut it. <span class=\"badge\">Coming Soon</span>"));
  // Only real screenshots are referenced and they exist.
  for (const src of html.matchAll(/src="\/landing\/([^"]+)"/g))
    assert.ok(fs.existsSync(`public/landing/${src[1]}`), src[1]);
  assert.ok(fs.existsSync("public/landing/og.png"));
});

test("landing page describes the current feature set: 8 fonts, Smart Connect, 2D CAD, bookmark mock-up", () => {
  const html = fs.readFileSync("index.html", "utf8");
  for (const tab of ["text", "fonts", "layout", "vector", "bridge", "connect", "cad", "shapes", "export"]) {
    assert.match(html, new RegExp(`data-tab="${tab}"`), tab);
    assert.match(html, new RegExp(`data-panel="${tab}"`), tab);
  }
  assert.match(html, /日本語フォント8書体/);
  for (const name of ["Zen Kaku Gothic New", "しっぽり明朝", "Zen Maru Gothic", "Dela Gothic One", "RocknRoll One", "Kaisei Decol", "Zen Kurenaido", "DotGothic16"])
    assert.ok(html.includes(name), name);
  assert.match(html, /スマート接続/);
  assert.match(html, /2D CAD/);
  assert.match(html, /完成イメージ/);
  for (const img of ["smart-connect.webp", "cad.webp", "fonts.webp", "bookmark.webp", "toolbar.webp"]) assert.ok(html.includes(`/landing/${img}`), img);
  // No stale references to removed screenshots.
  assert.doesNotMatch(html, /inspector\.webp/);
});

test("Vite config builds both pages under the /TypeFab/ base", async () => {
  const config = (await import("../vite.config.js")).default;
  assert.equal(config.base, "/TypeFab/");
  const input = config.build.rollupOptions.input;
  assert.ok(input.editor.endsWith("/app/index.html"));
  assert.ok(input.landing.endsWith("/TypeFab/index.html"));
  assert.ok(input.order.endsWith("/order/index.html") && input.admin.endsWith("/admin/index.html"));
});
