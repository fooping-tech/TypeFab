# TypeFab MVP

## Context
- Repository was empty. AGENTS.md and Skills/fooping-second-brain/SKILL.md absent.
- User authorizes implementation, GitHub writes and GitHub Pages publication.

## Completion criteria
- Japanese bundled fonts and local TTF/OTF, text outlining, drag layout, shapes.
- Arbitrary rotated bridge rectangles remove real cut segments from outlined geometry.
- Automatic holding tabs and closed-contour warnings; no claim of material-strength certification.
- Fusion-style sketch workspace, mm SVG export, project save/open, undo/redo.
- Geometry tests, production build and real browser checks pass.
- GitHub Pages deployment succeeds and public URL is verified.

## Plan
1. Implement static Vite application and font assets.
2. Test clipping/outlines and browser workflows.
3. Commit/push, configure Pages, verify deployment and public app.

## Verification / remaining boundaries
- Pending implementation and validation.
- Physical laser cutting and material strength are outside browser verification.

## Implementation complete (2026-09-13)
- Static Vite editor with bundled Zen Kaku Gothic New / Shippori Mincho and OFL notices.
- TTF/OTF/WOFF local fonts, Japanese text, rotation, spacing, simple vertical arrangement, fixed outlines.
- Text/rectangle/ellipse/line creation, drag, numeric placement, duplicate/delete, undo/redo.
- Arbitrary rotated bridge rectangles, automatic holding tabs, cut preview, mm SVG.
- JSON save/open and local autosave; input validation; export blocks out-of-area geometry and fully erased contours.
- Responsive Fusion-style workspace, help, Japanese README and Pages Actions workflow.

## Validation complete
- `npm test`: 11 tests passed (geometry, real Japanese font outlines, export, import validation).
- `npm run build`: passed. `npm audit` after Vite 6.4.3 update: 0 vulnerabilities.
- Real Chromium via Playwright CLI: Japanese edit, serif selection, rotation, custom TTF upload, vertical arrangement, outline conversion and undo verified.
- Real Chromium: rectangle/ellipse/line creation, drag X=38 -> 52 mm, manual rotated bridge, duplicate/delete/undo/redo, JSON save/open verified.
- Auto bridge preview: 41 closed contours, 0 without holding gaps; downloaded SVG parsed as XML, width 240mm, no text/mask/clipPath/rect, no closed-path commands after automatic bridging.
- Desktop (1200px) and mobile (390px) screenshots inspected. Mobile document width equals viewport; toolbar scrolls horizontally by design.
- Preview server required sandbox network-listen escalation. Skill wrapper lacked CLI binary; used official `@playwright/cli` package directly.

## Publication
- Completed. See publication evidence below.

## Publication verified (2026-09-13)
- Implementation commit: `1c8f90a05c18478df56e83d41f648dc865bbbd8a`, pushed to `main`.
- GitHub Pages enabled with workflow deployment and HTTPS.
- Initial Actions run: https://github.com/fooping-tech/TypeFab/actions/runs/34749954638 — success.
- Public URL: https://fooping-tech.github.io/TypeFab/ — HTTP 200.
- Real Chromium on public URL: both bundled font assets loaded; Japanese sample rendered; automatic holding tabs and actual SVG download passed.
- Public SVG parsed and verified: 240 x 160 mm, paths only, closed contours opened by holding tabs.
- Public browser console: 0 errors, 0 warnings. Desktop screenshot inspected at 1440 x 960.
- Physical laser cutting, material connectivity/strength, kerf and downstream laser-software compatibility remain unverified, as documented in README.

## Editor expansion requested (2026-09-13)
- Preserve v1 saved projects and all current outlines while adding layers with visibility, locking, reordering, names, and object reassignment.
- Add four corner drag handles for rectangle/ellipse/outline/bridge scaling, rotation-aware opposite-corner anchoring, and persisted aspect-ratio locking (also numeric dimensions).
- Replace simple vertical arrangement with Japanese OpenType vertical shaping (vert/vrt2, punctuation, long vowel marks, vertical metrics, right-to-left columns).
- Multi-select with Shift; Union / Difference / Intersection / XOR over closed outlines. Difference uses the first selected item as the base. Preserve undo and output actual contours.
- Apply automatic bridges only to selected items; scope each generated bridge to its owner and carry it with owner transforms.
- Validate geometry, old/new JSON, vertical glyph substitution, layer behavior, and real browser interactions; deploy and verify Pages.

## Expansion implemented and validated (2026-09-13)
- Four drag handles on rectangles, ellipses, fixed outlines and bridges; opposite-corner anchoring works with rotation. Ratio lock persists and also applies to numeric dimensions; Shift temporarily locks during drag.
- Shift/Ctrl/Command multi-selection; union, difference, intersection and XOR use actual closed contours with hole preservation. Difference uses first selection as base. Empty results leave originals intact; undo restores original items.
- Named layers: creation, visibility, editing lock, front/back ordering, reassignment, safe deletion and v2 JSON persistence. v1 JSON migrates to one layer without rebuilding existing outlines. Hidden layers are excluded from cut checks/export; visible locked layers still export.
- SVG includes visible named layer groups and Inkscape layer metadata, retaining mm cut paths.
- HarfBuzz vertical shaping uses vert/vrt2, vertical advances and offsets, right-to-left columns; tests verify brackets, punctuation and long-vowel substitutions in both bundled fonts. WOFF unpacking preserves original OpenType tables. Ruby, tate-chu-yoko, kinsoku and rotated Latin typesetting are not implemented.
- Automatic bridges apply only to selected owner IDs. They follow owner translation/rotation/resizing without changing physical tab width, move between layers with owners, duplicate with owners and delete with owners. Legacy/manual bridges remain global.

### Expansion verification
- `npm test`: 28 tests passed, including 17 added operation/layer/vertical/WOFF/export tests.
- Production build passed; HarfBuzz WASM loaded correctly from the built `/TypeFab/` asset path in real Chromium. Build emits an expected externalization notice for the HarfBuzz Node-only module branch; browser console has 0 errors and 0 warnings.
- Real browser: drag rectangle 40x20 -> 70x35 with ratio lock; numeric width 80 updates height to 40.
- Real browser: Shift-select rectangle/ellipse -> difference with preserved hole; two scoped tabs survive owner movement and saved JSON validation.
- Real browser: layer rename, reassignment, lock preventing selection, hide yielding 0 rendered objects, reorder and undo verified.
- Real browser: true vertical serif text `「日本語ー。」\n縦書き` visually inspected; JSON v1 import, v2 import and autosave reload passed.
- Downloaded SVG parsed as XML: two named layer groups, 240mm width, paths only; no text/masks/clipping rectangles.
- Desktop and 390px mobile screenshots inspected; mobile document width equals viewport width.
- README now documents the features, selection ordering, saved-project migration and remaining typography/manufacturing boundaries.
- Expansion commit `5dec5fe` deployed successfully: https://github.com/fooping-tech/TypeFab/actions/runs/34757423304. Public URL remains https://fooping-tech.github.io/TypeFab/.

### Startup guard follow-up
- Initial public validation confirmed v0.2 handles, layers, scoped bridge and SVG download. It also exposed a fast-interaction race while the full Japanese fonts were still loading.
- Saved project restoration now occurs before asynchronous font loading; edit controls, canvas gestures and shortcuts wait until initialization completes. A font-load failure preserves restored data instead of rebuilding/overwriting it.
- All 28 tests and the production build pass after the guard. A fresh Chromium session with font requests delayed 1800 ms confirmed controls disabled while loading, enabled afterward, and exact successful vertical text entry.

## Direct manipulation and island bridges (requested 2026-09-13)
- Drag object rows onto another layer; support multi-selection, owner/tab co-movement, locked/hidden layer rejection and undo.
- Wheel/trackpad pinch and two-touch zoom anchored around the gesture position, with reachable scroll extents.
- Blank-canvas rectangle drag selects intersecting editable objects; Shift adds to selection, selection gestures do not create undo entries.
- Replace independent contour holding tabs with nested contour connectors: for glyphs such as よ, bridge the inner loop to its enclosing outer contour across the stroke. Keep scoped ownership, handle multiple holes and rotations, and verify actual exported gaps in both boundaries.
- Validate interaction geometry, real-font よ cases, legacy-tab upgrades, real browser gestures, SVG, and GitHub Pages publication.

### Implemented and validated (2026-09-14)
- Layer row drag supports selected groups and owner-associated bridges; hidden/locked destinations and orphan tab moves are rejected. Blank-canvas marquee uses actual contour intersection, supports additive selection, and excludes locked/hidden objects.
- Wheel and Ctrl-wheel zoom, two-touch pinch, and Safari gesture handling added with pointer-centered zoom and scrollable canvas extents.
- Automatic island bands span both inner and enclosing contours, upgrading old independent tabs. Bands follow owner rotation and resize while retaining physical holding width. Diagnostics separately report unconnected nested islands.
- All 36 tests pass, including both bundled fonts' よ, rotation, resizing, multiple holes, scoped effects, SVG gaps, layer move validation, marquee intersections, and zoom limits. Production build passes.
- Real Chromium: marquee selected two rectangles; native drag moved both to the new layer; wheel changed 100% to 165%; CDP two-touch pinch changed 165% to 330%.
- Real Chromium: Shippori Mincho よ at 50 mm generated one band, with zero unconnected islands and zero untouched contours. Screenshot inspected: same band crosses the inner and outer left-loop boundaries.
- Physical cutting and material strength remain unverified.

## Stencil topology correction and pan (2026-09-14)
- User clarified automatic bridges must subtract rectangular bands from filled glyphs, producing closed cut contours including band sidewalls (reference right-hand よ). Independent gaps are insufficient.
- Generate two opposite connections per nested counter where possible, for arbitrary glyph outlines; preserve editable source and scoped bands. Validate closed output contours, no remaining counter holes, both Japanese fonts and multiple counters.
- Wheel/two-finger swipes pan in both axes; Ctrl-wheel/pinch zoom. Verify in browser and publish.

### Stencil correction validated
- Generated scoped stencil rectangles use Clipper area difference; sidewalls close the cutouts. Source outlines remain editable; old generated holding/island bands are replaced on reapplication. Manual tabs retain their prior behavior.
- Both bundled fonts tested with よ, 日, 目, 田, 回, 品, 国, あ, ぬ, の and ABOPQR0689: resulting paths closed with no remaining nested counters. Rotation, resize and idempotence also pass. Total 38 tests pass; production build passes.
- Real Chromium screenshot matches reference topology: two opposite bands through よ counter and closed sidewalls. Downloaded SVG contains two closed subpaths.
- Real Chromium Ctrl-wheel zoom reached 374%; subsequent horizontal/vertical wheel movement changed scroll by 85/95 px while retaining 374% zoom.

## CLAUDE.md added (2026-09-14)
- Added `CLAUDE.md`: read `PLANS.md` before work, record each request and its verification here, and publish to GitHub Pages after every update (push to `main`, watch the Actions run, confirm HTTP 200).
- No application code changed. `npm test` 38 passed; production build passed.
- Commit `f3d77c8` deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34789120674 — success. Public URL returned HTTP 200.
- Actions annotation: checkout/setup-node/configure-pages/upload-artifact target deprecated Node.js 20 and are forced onto Node.js 24; deployment unaffected.

## Live text and ungrouping (requested 2026-09-14)
- Text box edits apply to the canvas in real time (including IME composition) without losing focus; one undo step per editing session; missing glyphs keep the last valid shape.
- Ungroup a text item into one editable text item per character, each at its exact original glyph position (horizontal and vertical), movable and processable individually.
- Ungroup again into parts: each connected filled region (outer contour plus its holes) becomes a fixed outline. Islands inside counters (e.g. 回) are separate parts.
- Scoped bridges move to the piece they cross. Undo restores the original item.
- Validate geometry identity before/after splitting in both fonts, bridge reassignment, JSON round-trip, real browser typing/ungrouping; push directly to `main` and verify Pages.

### Implemented and validated (2026-09-14)
- Text box `input` events re-layout the text immediately; the inspector is not rebuilt while typing, so focus and IME composition survive. The first successful edit takes one undo checkpoint for the session; scoped bridges are re-derived from the session start to avoid per-keystroke drift. Leaving the box restores the drawn text if the last input was undrawable.
- `layoutGlyphs` returns per-glyph-cluster contours, text and pen offset; `layoutText` is now its flattening (identical output). Vertical clusters use HarfBuzz UTF-16 cluster indices.
- 「グループ化解除」 (toolbar, inspector, Ctrl/⌘ Shift G): multi-character text → one text item per character at the exact glyph position, still editable; single character or outline → Clipper nonzero union PolyTree parts (outer + holes; islands in holes are separate parts) as fixed outlines. Pieces replace the original in z-order and stay selected.
- Scoped bridges are retargeted to every piece they cross (copied where a band crosses several, e.g. thin Mincho 回 strokes), else the nearest piece, so cut geometry is unchanged.
- Fixed a pre-existing bug: opentype.js `hasChar()` returns true for every character, so missing glyphs were silently dropped instead of reported. Now checked by glyph index > 0.
- `npm test`: 52 passed (14 new): per-glyph layout equals previous output; split characters match original world contours to 1e-7 horizontally and vertically, and re-layout in place; part counts/holes/islands and area for い 日 回 よ は; stencil bridges after char and part splits keep 0 unconnected islands and the same cut length; nearest-piece fallback; empty text; missing glyph errors; JSON round-trip. Production build passed.
- Real Chromium (production preview, 31 checks, console 0 errors/warnings): each keystroke redraws with focus kept; CDP IME composition draws かたち and commits 形; emoji reports a missing glyph and keeps the shape; one undo reverts the session; いろは回 → 4 characters with identical bounding box; dragging ろ moves only ろ; a character is re-editable; 回 → 2 parts with 4 resize handles; Ctrl/⌘ Shift G splits い; undo; SVG paths only; autosave reload keeps pieces; 390 px width has no horizontal overflow. Screenshots inspected.
- Live update cost measured at 4 / 12 / 26 ms per keystroke for 20 / 100 / 199 characters.
- Not implemented: regrouping split pieces (undo restores the original).
- Commit `b7cd38a` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34790369234 — success. Public URL HTTP 200; the same 31 real-Chromium checks passed against https://fooping-tech.github.io/TypeFab/ with 0 console errors/warnings.
