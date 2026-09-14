import "./landing.css";
import { GLYPHS } from "./landing-glyphs.js";

// Where the editor lives relative to the site base (Phase 2 of issue #2: the
// landing page is the site root, the editor is "/app/"). Static hrefs in the
// HTML point to "./app/" as a no-JS fallback.
const EDITOR_URL = `${import.meta.env.BASE_URL}app/`;
document.querySelectorAll("a[data-editor]").forEach((a) => (a.href = EDITOR_URL));
document.querySelectorAll("a[data-order]").forEach((a) => (a.href = `${import.meta.env.BASE_URL}order/`));

// Compatibility notice for people who bookmarked "/TypeFab/" as the editor:
// their autosaved project (origin-scoped localStorage) is still there.
try {
  if (localStorage.getItem("typefab-v1")) document.getElementById("welcome-back").hidden = false;
} catch {}

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const svgNS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...children);
  return n;
};
const CUT = "#ff5343",
  INK = "#23384a",
  ORANGE = "#efa562",
  BOARD = "#d9b98a";

// Before / After: real outlines and bridges from src/geometry.js.
function stepArt(step, g) {
  const svg = el("svg", { viewBox: g.viewBox, "aria-hidden": "true" });
  const outline = () =>
    el("path", { d: g.outline, fill: "none", stroke: INK, "stroke-width": 0.7, "stroke-linejoin": "round" });
  if (step === "font") svg.append(el("path", { d: g.outline, fill: INK, "fill-rule": "evenodd" }));
  if (step === "outline") svg.append(outline());
  if (step === "bridge")
    svg.append(
      outline(),
      ...g.bridges.map((points) =>
        el("polygon", { points, fill: ORANGE, "fill-opacity": 0.85, stroke: "#c27a45", "stroke-width": 0.4 }),
      ),
    );
  if (step === "cut") {
    const p = el("path", { d: g.cut, fill: "none", stroke: CUT, "stroke-width": 0.7, "stroke-linejoin": "round" });
    if (!reduced) {
      svg.append(p);
      const len = p.getTotalLength?.() || 0;
      if (len) {
        p.classList.add("draw");
        p.style.setProperty("--len", len.toFixed(1));
      }
    } else svg.append(p);
  }
  return svg;
}
const steps = document.querySelectorAll("#steps .step-art");
function showGlyph(g) {
  steps.forEach((box) => box.replaceChildren(stepArt(box.dataset.step, g)));
  document.querySelectorAll("#glyph-picker button").forEach((b) => b.setAttribute("aria-selected", b.dataset.char === g.char));
}
const picker = document.getElementById("glyph-picker");
if (picker) {
  picker.append(
    ...GLYPHS.map((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.textContent = g.char;
      b.dataset.char = g.char;
      b.title = `${g.char}（${g.font === "zen" ? "Zen Kaku Gothic New" : "しっぽり明朝"}）`;
      b.onclick = () => showGlyph(g);
      return b;
    }),
  );
  showGlyph(GLYPHS[0]);
}

// Bridge diagram: normal outline → bridge added → physical result (schematic).
// The "result" panels draw the board with the cut paths removed (even-odd) so
// the remaining material comes from the real cut geometry.
function diagram() {
  const host = document.getElementById("bridge-diagram");
  if (!host) return;
  const g = GLYPHS.find((x) => x.char === "R") || GLYPHS[0];
  const [vx, vy, vw, vh] = g.viewBox.split(" ").map(Number);
  const view = `${vx - vw * 0.15} ${vy - vh * 0.05} ${vw * 1.3} ${vh * 1.1}`;
  const board = (d) =>
    el("path", {
      d: `M${vx - 1} ${vy - 1} h${vw + 2} v${vh + 2} h${-(vw + 2)} Z ${d}`,
      fill: BOARD,
      "fill-rule": "evenodd",
    });
  const panel = (title, text, nodes) => {
    const f = document.createElement("figure");
    const art = document.createElement("div");
    art.className = "art";
    art.append(el("svg", { viewBox: view, "aria-hidden": "true" }, nodes));
    const cap = document.createElement("figcaption");
    const b = document.createElement("b");
    b.textContent = title;
    cap.append(b, text);
    f.append(art, cap);
    return f;
  };
  const outline = () => el("path", { d: g.outline, fill: "none", stroke: INK, "stroke-width": 0.7 });
  // Split the outline into the outer contour and the hole (island) subpaths.
  const subpaths = g.outline.split(/(?=M)/);
  const island = subpaths.slice(1).join(" ");
  // Scale each result board around the glyph centre and shift it sideways.
  const s = 0.62,
    cx = vx + vw / 2,
    cy = vy + vh / 2;
  const place = (dx) => `translate(${cx - s * cx + dx} ${cy - s * cy}) scale(${s})`;
  host.append(
    panel("NORMAL OUTLINE", "輪郭だけをカットすると、内側の島は切り離されます。", [outline()]),
    panel(
      "BRIDGE ADDED",
      "ブリッジ（オレンジ）の部分はカットしません。帯の側面がカット線に加わります。",
      [
        outline(),
        ...g.bridges.map((points) => el("polygon", { points, fill: ORANGE, "fill-opacity": 0.85, stroke: "#c27a45", "stroke-width": 0.4 })),
        el("path", { d: g.cut, fill: "none", stroke: CUT, "stroke-width": 0.5 }),
      ],
    ),
    panel("PHYSICAL RESULT（図解）", "左：ブリッジなしでは島が脱落。右：ブリッジありなら板と一体のまま残ります。", [
      el("g", { transform: place(-vw * 0.36) }, [
        board(g.outline),
        el("path", { d: island, fill: BOARD, "fill-opacity": 0.35, stroke: "#8a6a3f", "stroke-dasharray": "1 1", "stroke-width": 0.5, transform: `translate(2 ${vh * 0.55}) rotate(12 ${vx + vw / 2} ${vy + vh / 2})` }),
        el("text", { x: vx + vw / 2, y: vy + vh + 10, "text-anchor": "middle", "font-size": 4, fill: "#6b5230", "font-family": "ui-monospace, Menlo, monospace" }, [document.createTextNode("NO BRIDGE")]),
      ]),
      el("g", { transform: place(vw * 0.36) }, [
        board(g.cut),
        el("text", { x: vx + vw / 2, y: vy + vh + 10, "text-anchor": "middle", "font-size": 4, fill: "#6b5230", "font-family": "ui-monospace, Menlo, monospace" }, [document.createTextNode("WITH BRIDGE")]),
      ]),
    ]),
  );
}
diagram();

// Showcase tabs.
const tabs = document.querySelectorAll('.tabs [role="tab"]');
tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.setAttribute("aria-selected", t === tab));
    document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
  }),
);

// Reveal on scroll (fade + slight translate), disabled with reduced motion.
if (!reduced && "IntersectionObserver" in window) {
  const targets = document.querySelectorAll(".section > .wrap > *, .hero .wrap > *");
  targets.forEach((t) => t.classList.add("reveal"));
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
    { rootMargin: "0px 0px -8% 0px" },
  );
  targets.forEach((t) => io.observe(t));
}

// Highlight the nav link of the section in view.
const links = [...document.querySelectorAll(".nav-links a[href^='#']")];
if (links.length && "IntersectionObserver" in window) {
  const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const a = map.get(e.target.id);
        if (a && e.isIntersecting) links.forEach((l) => l.setAttribute("aria-current", l === a));
      }),
    { rootMargin: "-40% 0px -50% 0px" },
  );
  map.forEach((_, id) => {
    const s = document.getElementById(id);
    if (s) io.observe(s);
  });
}
