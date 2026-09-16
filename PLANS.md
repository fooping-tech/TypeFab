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

## Browser range selection, context menu, groups and fillet (requested 2026-09-14)
- Browser: Shift+click selects every editable row between the anchor and the clicked row (display order, across layers); Ctrl/⌘+click toggles one row.
- Right-click on canvas objects, browser rows and blank canvas opens a Fusion-style edit menu: cut/copy/paste/duplicate/delete, group/ungroup, outline, fillet, auto bridge, boolean operations, arrange (front/forward/backward/back), find in browser, select all. Keyboard shortcuts and arrow-key navigation; Mac Ctrl+click opens the menu instead of toggling.
- Groups: flat items sharing `groupId`. Canvas click and marquee select whole groups; browser rows allow selecting a single member. Grouping puts members on one layer and makes them contiguous; ungroup releases groups first, then splits text/parts as before. Copies get new group ids.
- Rectangle fillet: uniform corner radius, flattened within 0.02 mm, clamped to half the shorter side, kept on resize, saved in JSON.
- Validate pure functions (range, groups, arrange, clone, rounded rectangle, JSON), real browser interactions, then push to `main` and verify Pages.

### Implemented and validated (2026-09-14)
- Browser Shift+click selects the editable rows from the anchor (last plain or ⌘/Ctrl click) to the target in display order, across layers, anchor first; repeated Shift+clicks re-range from the same anchor; ⌘/Ctrl+Shift adds the range. ⌘ (Mac) / Ctrl (others) toggles a row. Mac Control+click opens the menu instead of toggling.
- Context menu (`#context-menu`, role=menu) on canvas objects, browser rows/group rows and blank canvas; unselected targets are selected first (canvas picks whole groups). Items are enabled per selection; boolean items appear for 2+; arrow/Home/End/Enter/Escape; Shift+F10 and the menu key open it at the selection; outside click, scroll, resize and blur close it. Shortcuts: ⌘/Ctrl X C V D A G, ⇧G, ] [ with Shift for front/back.
- Groups (`groupId`, `src/grouping.js`): grouping moves members and their scoped bridges to the primary item's layer, stacks them contiguously at the topmost member, and flattens earlier groups. Canvas click and marquee expand to groups; browser group rows select all, member rows select one. Layer moves include the whole group. Singleton groups are removed on render. Ungroup releases groups before splitting text/parts. Copy/paste/duplicate remap group and bridge-owner ids (`src/edit.js`); the page-local clipboard pastes into the active layer offset by 5 mm per paste, and at the original position right after a cut.
- Arrange (`arrangeItems`) reorders within each layer only; unselected bridges keep their slots.
- Rectangle fillet: `radius` on rect items; four arcs with chord error ≤ 0.02 mm, clamped to half the short side on input, numeric resize and handle resize; validated in JSON (rect only, 0–1000). Per-corner radii not implemented.
- `npm test`: 59 passed (7 new: rounded-rectangle tolerance/area/bounds, fillet resize/cut/boolean/JSON, browser range, grouping/flatten/normalize, arrange, clone remapping, group id validation). Production build passed.
- Real Chromium (production preview, 39 new checks + the previous 31, console 0 errors/warnings): Shift range of 4 rows, re-range, ⌘ toggle; Control+click menu; canvas right-click menu with all commands and arrow-key focus; フィレット… focuses R, R6 rounds (45 points), R100 clamps to 15 with a message; group from the row menu, canvas click selects and drags the group, member/group rows; copy/paste creates a second group and undo removes it; ⇧⌘G releases; 最背面へ/最前面へ; blank canvas menu and すべて選択; outside click closes; Shift+F10; radius survives reload; SVG export; 390 px width. Screenshots of the menu, fillet and group rows inspected.
- Not verified: whether every browser lets pages override ⌘/Ctrl+[ ] (some use them for navigation/tabs); the menu remains the documented path. iOS Safari has no long-press contextmenu event.
- Commit `59d4296` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34792089479 — success. Public URL HTTP 200; both browser suites (39 + 31 checks) passed against https://fooping-tech.github.io/TypeFab/ with 0 console errors/warnings.

## Text resize, double-click editing and Text Warp (requested 2026-09-14)
- Text gets four corner resize handles like rectangles. Resizing rebuilds real outlines: vertical factor scales font size and spacing, the remaining horizontal factor becomes a stored horizontal scale (長体・平体); ratio lock/Shift keep proportions; text stays editable.
- Double-clicking a text object opens an in-canvas text editor with live updates.
- Text Warp / Envelope Warp (not text-on-path): Warp mode shows an envelope around the text whose top, bottom, left and right edges are independent cubic Béziers (4 corners + 8 handles). Dragging corners/handles deforms the actual glyph outlines in real time via a Coons patch with adaptive subdivision (0.02 mm). Presets: Arc Up, Arc Down, Arch, Bulge, Wave, Flag, Fish, Perspective with a bend amount.
- Keep original text and warp parameters on the item for re-editing (text edits, font changes, resize and re-entering Warp keep the warp). Stored contours are the final warped geometry, so SVG export, boolean operations and bridges use plain paths with no font/CSS dependency. Undo/redo covers drags, presets and slider sessions.
- Validate warp math (identity, edge fidelity, tolerance, presets), text layout/stretch/resize, JSON, and real browser interactions; push to `main` and verify Pages.

### Implemented and validated (2026-09-14)
- Text resize: text items get the four corner handles. `resizeFromHandle(..., layout)` scales font size and spacing by the vertical factor and stores the rest of the horizontal factor as `stretch` (長体・平体, 5–2000 %), rebuilding the outline; the layout is linear in these, so the opposite corner stays fixed (≤0.05 mm in tests). Ratio lock/Shift keep `stretch`. `stretch` is applied to glyph curve commands before flattening, so the 0.02 mm tolerance holds; split characters keep exact positions with stretch.
- Double-click editing: a floating editor opens under the text with live updates (same live session/undo as the inspector). Chromium resets the click count when the pressed element is re-rendered, so a double press (same object, <450 ms, <6 px) is detected in `pointerdown` instead of `dblclick`.
- Text Warp (`src/warp.js`): 12-point envelope (corners 0/3/6/9, two handles per side) in units of the unwarped text bounds; a Coons patch blends the four independent cubic sides (flat = identity). `warpContours` subdivides segments until the warped polyline is within 0.02 mm of the warped curve (checked at t = 0.25/0.5/0.75). Presets Arc Up, Arc Down, Arch (width-relative), Bulge, Wave, Flag, Fish, Perspective with bend −100…100 %.
- Warp mode: envelope outline, patch mesh, handle arms, corner squares and handle dots; dragging updates the real outline per pointer move (cached unwarped layout; ~2–7 ms per frame for 10–100 glyphs), corners carry their handles (Alt moves the corner alone), manual edits become `custom`. Inspector panel with preset icons, live bend slider, reset, remove and done; Esc/Enter exits; undo/redo stay in Warp mode. Toolbar, inspector and context menu entries.
- Data: text items keep `text`, font settings, `stretch` and `warp {preset, bend, envelope}`; `contours` hold the final warped outline. Text edits, font/size changes and resizing re-apply the warp. Export, booleans, auto bridges and part splitting use the plain contours; warped text split into characters becomes warped outline pieces. JSON validation covers `warp` (text only) and `stretch`.
- `npm test`: 70 passed (11 new: identity, side fidelity within tolerance, corner mapping, all presets and bend sign, stretch width and exact split, text resize with and without warp and locked ratio, warped text export/bridges/boolean/parts/JSON, warped character split, validation). Production build passed.
- Real Chromium (production preview): new suite 41 checks — text handles, free/Shift resize, double-click editor live typing and single undo, 12 envelope points and mesh, Arc Up raises top and keeps bottom, live bend slider, 8 distinct presets, live update during handle drag, カスタム, corner/Alt corner drags, undo/redo in Warp mode, Esc exit, WARP row, text edit keeps warp, stored envelope on re-entry, SVG paths only without text/font/CSS/transform and containing the warped shape, auto bridge and union on warped text, reload, menu entry, remove warp, 390 px; previous suites 31 + 39 checks still pass; console 0 errors/warnings. Screenshots inspected.
- Test harness note: one earlier run hit a stale server on port 4173 (not this build); all suites were rerun against the current build.
- Not implemented: warping non-text shapes, mesh envelopes with interior points, per-corner Alt-handle breaking beyond corners.
- Commit `49d9bd4` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34797224212 — success. Public URL HTTP 200; all three browser suites (31 + 39 + 41 checks) passed against https://fooping-tech.github.io/TypeFab/ with 0 console errors/warnings.

## Warp for rectangles, ellipses and fixed paths (requested 2026-09-14)
- Warp mode, presets, handle drags, bend slider, undo/redo and re-editing work for rect, circle and outline items as for text.
- Rect/ellipse keep w/h/radius and rebuild the unwarped shape from them, so dimension and fillet edits keep the warp. Outlines store the unwarped contours in `warp.source` for lossless re-editing and removal. Outlining warped text keeps an editable warp via `warp.source`.
- Corner resize of warped items scales linearly on the warped bounds (anchor fixed). Final contours stay plain paths for export, booleans and bridges. Lines are excluded (no 2D envelope box).
- Validate geometry, resize, JSON (`warp.source` only on outlines), real browser flows; push to `main` and verify Pages.

### Implemented and validated (2026-09-14)
- `WARPABLE = text, rect, circle, outline`. `shapeSource(item)` rebuilds rect/ellipse outlines from w/h/radius and returns `warp.source` for outlines; `applyWarp` places the envelope on that unwarped box. Text uses the same `applyWarp` after layout.
- Warp mode, presets, bend slider, handle/corner drags, reset/remove, undo/redo and re-entry work for all four types (toolbar, inspector section and context menu). Entering Warp on an outline stores its contours in `warp.source`; presets keep the source. Removing a warp or finishing with a flat envelope restores the unwarped contours exactly. Outlining warped text now keeps an editable warp with the unwarped glyphs as source.
- Rect/ellipse width, height and fillet edits rebuild the shape and re-apply the warp. `itemBounds` of warped items is the warped outline; corner resize of warped items uses the linear rebuild (rect/ellipse scale w/h, outline scales its source), keeping the opposite corner fixed.
- JSON: warp allowed only on warpable types; outlines require `warp.source` (validated like contours and counted in the point limit), other types must not have one. Lines are rejected and the Warp button is disabled for them.
- `npm test`: 77 passed (7 new: shape sources, dimension/fillet rebuild, warped rect/ellipse/path resize with fixed corner and locked ratio, export/booleans/bridges/parts/JSON for warped shapes, source validation, lines excluded). Production build passed.
- Real Chromium (production preview): new suite 30 checks — rectangle Warp/Bulge/drag/undo in Warp mode, width and fillet keep the warp, warped resize keeps the corner, ellipse via context menu, union path Arc Up/drag/Enter/re-entry, remove restores the exact original path and undo brings it back, warped text → アウトライン化 keeps WARP and can be re-warped/removed, line excluded, SVG plain paths, reload; previous suites 31 + 39 + 41 still pass; console 0 errors/warnings. Screenshots inspected.
- Commit `1f18e7f` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34801103475 — success. Public URL HTTP 200; all four browser suites (31 + 39 + 41 + 30 checks) passed against https://fooping-tech.github.io/TypeFab/ with 0 console errors/warnings.

## Path Node Editing (requested 2026-09-14)
- Double-clicking a path object (outline, also rect/ellipse) enters Path Edit Mode; normal selection keeps the bounding box. Anchors, Bézier handles (lines + handle points) and selected/unselected states are shown.
- Node operations: select, multi-select (Shift, marquee), drag, add (double-click on the path, inspector/menu), delete (Delete key), Corner/Smooth toggle, independent handles (corner) and linked handles (smooth), Alt-drag handle breaks smoothness, straighten, Esc exits. Real-time outline updates per drag frame; one undo per drag; undo/redo for all node operations.
- Internal structure maps 1:1 to SVG path data (M/L/C/Z); parser accepts M L H V C S Q T Z (abs/rel), quadratics normalised to cubics. Inspector shows and accepts the `d` attribute.
- Workflow Text → Outline (glyph Béziers, identical outline) → Path Edit → Bridge → Boolean → SVG Export. Outlines without Béziers (boolean results, parts, old data, warped shapes) are fitted to cubic curves; rect/ellipse become exact paths; conversion happens only on the first real edit.
- Export writes only plain cut paths (no edit UI). Independent `src/path.js` module usable for any SVG path.
- Validate parser, conversions, fitting accuracy, node operations, JSON, glyph workflow (A/R/O edits), real browser flows; push to `main` and verify Pages.

### Implemented and validated (2026-09-14)
- `src/path.js` (independent node-editor model): subpaths of nodes with optional absolute `in`/`out` handles and `smooth`; segments are cubic when a handle exists, else lines, i.e. 1:1 with M/L/C/Z. SVG parser for M L H V C S Q T Z (abs/rel, implicit lineto, packed numbers; quadratics → exact cubics; A rejected with a message) and serializer; glyph commands → path (zero-length lines from opentype.js TrueType contour starts are skipped so nodes never stack); exact rect/rounded-rect/ellipse paths; Schneider cubic fitting with 45° corner detection, Newton reparameterisation, between-point error checks and straight two-point fallbacks (fits within 0.034 mm of the flattened outline for O R A 日 あ in both fonts). Node ops: move (with handles), handle move (smooth mirror keeping length, Alt breaks), smooth/corner/line, exact de Casteljau insert, delete (never empties), nearest segment, visible handles.
- Outlining text now stores the glyph Bézier path (`item.path`) and the same outline (equal to the text contours apart from repeated points); warped text keeps its warp with the glyph path's contours as source. Path outlines resize by transforming nodes and re-flattening; `splitParts` drops `path`; JSON validates `path` (outline only, counted in the point limit).
- Path Edit Mode: double click (on release, so click-then-drag still moves) on outline/rect/ellipse, toolbar「パス編集」, inspector and context menu (also「アウトライン化してパス編集」for text). Overlay: path stroke, square anchors (selected filled), handles for selected nodes and adjacent segments as lines with round tips; bounding box hidden in the mode. Click/Shift/marquee/⌘A selection; anchor and handle drags rebuild the item from the drag start every frame with one undo step; double click on the outline adds a node on release; Delete deletes; arrows nudge 0.1/1 mm; Esc/Enter exit; node X/Y fields; editable SVG path d; context menu node commands. Rect/ellipse/warped/polyline outlines get a working path and are converted only on the first edit. Undo/redo stay in the mode.
- `npm test`: 90 passed (13 new path tests: parser, round trip, glyph equality in both fonts with no stacked nodes, fitting accuracy and node counts, straight boolean fit, shape paths, move/handle/smooth/corner/line, smooth creation, insert exactness, delete, visible handles, resize/bridges/boolean/export/JSON workflow with the A leg). Production build passed.
- Real Chromium (production preview): new suite 45 checks — outline keeps the drawing, bounding box only when not editing, double click enters the mode, anchors and d shown, marquee selects A's two right foot nodes and dragging stretches the leg 35.0→53.9 mm with live updates, one undo/redo, Shift selection, Delete, undo, double-click insert, Esc; O via menu, handles on a curve node, smooth link and collinearity, Alt break, corner independence, straighten, node context menu, ⌘A; d editing and A rejection; rectangle unchanged until the first drag, converted then, undo restores; auto bridge, SVG without edit UI, union; reload keeps nodes; 390 px. Earlier suites 31 + 39 + 41 + 30 still pass (a click-then-drag regression found by the group suite was fixed by release-based double clicks). Console 0 errors/warnings. Screenshots inspected.
- Not implemented: arc (A) commands, per-segment curve/line conversion by dragging a segment, open-path creation tools.
- Commit `2983954` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34804190263 — success. Public URL HTTP 200; all five browser suites (45 + 31 + 39 + 41 + 30 checks) passed against https://fooping-tech.github.io/TypeFab/ with 0 console errors/warnings.

## Zoom 2000 %, rotation handle, SVG export file name (requested 2026-09-14)
- Maximum zoom 2000 % (buttons, wheel/pinch, Safari gestures).
- Rotation handle above the selection: drag to rotate around the selection centre (single items, multi-selection and groups), Shift snaps to 15°, live angle display, one undo step; scoped bridges follow.
- 「SVGを書き出す」 must always produce a file with the .svg extension; investigate the cause and verify the downloaded file name.

### Implemented and validated (2026-09-14)
- Zoom limit raised to 2000 % (`MAX_ZOOM = 20` shared by buttons, wheel/pinch and Safari gestures).
- Rotation handle: knob 24 px above the selection (in the item's rotated frame for one item; above the combined box, drawn dashed, for several). Dragging turns about the selection centre (`selectionCenter`, `rotateAbout` in `src/edit.js`), Shift snaps a single item's angle (or a selection's turn) to 15°, the angle is shown live and cleared on release, one undo per drag, scoped bridges follow, hidden in Warp/Path Edit Mode. Context menu 右に/左に90°回転. Angles are kept in −180° < a ≤ 180°.
- SVG export file name: Chromium 151 and WebKit 26.5 (Safari engine, installed for this check) both already named downloads `typefab.svg`, so the reported missing extension was not reproduced. The likely cause is environments that ignore the download name of an anonymous Blob and use its random id. Saving now uses the browser save dialog where available (`showSaveFilePicker`, Chrome/Edge) with the file type fixed to `.svg` / `.json`; otherwise a named `File` is downloaded from a link attached to the page and kept alive for 60 s. Cancelling is reported. Project JSON uses the same path.
- Playwright maintenance: installing WebKit garbage-collected orphaned browser builds (chromium-1200/1228, not referenced by any installed Playwright package); chromium-1234 for the Playwright 1.62.1 used here was installed and the test scripts now use Playwright's default browser.
- `npm test`: 91 passed (rotation about a point, shared centre, angle wrap, bridges following; zoom limit). Production build passed.
- Real browsers (production preview): new suite 29 checks — 2000 % via buttons and Ctrl+wheel, rotation handle position, live angle and clearing, 90° turn about the centre, one undo, 15° snap, shared handle and shared-centre rotation for two rectangles, menu 90° turn, hidden in Path Edit Mode, Chromium download names, save dialog suggestion/type/content for SVG and JSON, cancel message, WebKit download names and handle; previous suites 31 + 39 + 41 + 30 + 45 still pass (download path); console 0 errors/warnings.
- Not verified: the user's own browser; if a name without .svg still appears, the browser/app used needs to be identified.
- Commit `5484039` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34808046884 — success. Public URL HTTP 200; all six browser suites (29 + 31 + 39 + 41 + 30 + 45 checks, incl. WebKit download names) passed against https://fooping-tech.github.io/TypeFab/ with 0 console errors/warnings.

## Fix: SVG export reports a cancel in Chrome (reported 2026-09-14)
- Chrome rejects `showSaveFilePicker` with AbortError ("The user aborted a request") without showing a dialog in some environments (reproduced in headless Chromium: 68 ms), and the page reported it as a user cancel. The earlier test used a stub of the API, so the real behaviour was not exercised.
- Remove the save-dialog path; always download a named `File` from a link attached to the page and keep the object URL for 5 minutes (covers Chrome's "ask where to save" dialog). Verify with the real APIs (no stubs) in Chromium, the installed Google Chrome and WebKit.
- Implemented: `saveFile` only downloads a named `File` (link attached to the page, object URL kept 5 minutes); export and project save report "… をダウンロードしました". README no longer describes a save dialog and mentions Finder's extension setting.
- All browser suites now run without API stubs. Export verified with real APIs in bundled Chromium, the installed Google Chrome (channel "chrome", headless, temporary profile) and WebKit: `typefab.svg` containing the cut-path SVG and `typefab-project.json`, no cancel message, console clean. `npm test` 91 passed; build passed; suites 31 + 39 + 41 + 30 + 45 + 34 checks pass.
- Commit `a64a0e1` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34812934015 — success. On https://fooping-tech.github.io/TypeFab/ the export checks passed in Chromium, the installed Google Chrome and WebKit (`typefab.svg`, no cancel), and the other suites passed.
- Correction: in that public run the first suite timed out once after 14 checks (waiting for the page); two immediate reruns passed 31/31. The other suites passed 39 + 41 + 30 + 45 on the first run. The timeout is treated as transient (network/page load right after deployment), not an app failure.

## Open SVG files (requested 2026-09-14)
- 「開く」 accepts .svg as well as .json (and files can be dropped on the canvas). SVG shapes are imported into the current design as editable paths on the active layer (grouped), undoable; TypeFab's own export re-imports at the same mm position/size.
- Support path (incl. arc A commands, now also in the path d editor), rect (rx/ry), circle, ellipse, line, polyline, polygon; nested g/svg/a with transform (matrix, translate, scale, rotate, skewX/Y); viewBox with preserveAspectRatio; units mm/cm/in/pt/pc/px (96 dpi); Inkscape layers → TypeFab layers (reusing same-named layers); display:none skipped; text/image/use reported as skipped.
- Validate parsing, transforms, units, arcs, round trip with exportSVG, JSON validity, real browser import via file chooser and drop; push to `main` and verify Pages.

### Implemented and validated (2026-09-14)
- `src/svgimport.js`: plain-node walk of SVG (DOMParser in browsers, a small XML reader for Node/tests) with composed transforms (matrix/translate/scale/rotate with centre/skewX/skewY), outer viewBox/width/height → mm (units mm/cm/q/in/pt/pc/px at 96 dpi, preserveAspectRatio meet/slice/none with alignment), nested svg viewports; path/rect (rx/ry)/circle/ellipse/line/polyline/polygon become editable paths; defs etc. ignored, hidden elements skipped, text/image/use/foreignObject counted as skipped, unreadable elements counted. Inkscape layers reported per shape.
- `path.js`: SVG arc (A) commands converted exactly (endpoint→centre, ≤90° cubics, radius scaling, packed flags, zero radius → line); rectangles accept separate rx/ry.
- Editor: 「開く」 accepts .json/.svg; files dropped on the canvas open the same way. SVG shapes become fixed-path items at their mm position (items at their top-left), in same-named/new layers for Inkscape layers or the active layer, grouped per layer, validated as a whole project before commit, selected, undoable; message lists skipped content. Path d editor accepts A.
- Autosave: a pending debounced save is written on pagehide / when the page is hidden, so an edit just before closing or reloading is kept.
- `npm test`: 98 passed (arc accuracy/flags/large arc/rotated/too-small/zero radius, rx/ry rectangles, units, transforms, viewBox cases, all element types and skips, layers → valid items, TypeFab export round trip within 0.001 mm, XML reader). Production build passed.
- Real browsers (production preview): new suite 34 checks in Chromium and WebKit — Illustrator-style file with DOCTYPE entities and px units (4 shapes, text/image reported, grouped, 22.50 mm rect), undo/redo, Path Edit Mode on an imported path, arc in d, Inkscape file dropped on the canvas creating 外形/穴 layers, export → re-import, .json still opens, malformed and shape-less SVG errors, edit-then-reload kept; earlier suites 31 + 39 + 41 + 30 + 45 + 31 pass. The test setup now waits for the start-up autosave before clearing storage (the new flush otherwise restores it on reload).
- Open question: the first suite twice timed out after 14 checks (once on the public site before the autosave change, once locally in a batch); six consecutive reruns and later runs passed 31/31. Cause not identified; watch for recurrence.
- Not supported: text/image/use, fill-rule evenodd semantics, CSS stylesheets (<style>) for visibility.
- Commit `545a120` pushed directly to `main` and deployed: https://github.com/fooping-tech/TypeFab/actions/runs/34815815112 — success. Public URL HTTP 200; all seven browser suites (34 + 31 + 39 + 41 + 30 + 45 + 31 checks; SVG import in Chromium and WebKit, export in Chromium/Google Chrome/WebKit) passed against https://fooping-tech.github.io/TypeFab/ on the first run with 0 console errors/warnings.

## Landing page at /landing/ — Issue #2 Phase 1 (requested 2026-09-14)
- Source: https://github.com/fooping-tech/TypeFab/issues/2. Add a landing page without touching the editor at `/`: `/TypeFab/` stays the editor, `/TypeFab/landing/` becomes the LP (Phase 1). Structure must allow Phase 2 (`/` → LP, `/app/` → editor) later.
- Investigate first: stack (Vite multi-page, static), Pages entry point (`index.html` → `dist/`), workflow, base path `/TypeFab/`, no SPA routing, asset references (Vite-rewritten `/favicon.svg`, `import.meta.env.BASE_URL` for fonts), brand (dark navy `#263b4d`, orange `#efa562`, favicon `public/favicon.svg`).
- Sections: sticky nav, hero with the real editor UI, Before/After (normal font → outline → bridge → laser-cut ready with A / O / R / 8 / Japanese), product showcase, 6-step workflow (ORDER = Coming Soon), bridge feature, vector editing, made for makers, browser-to-physical (Coming Soon), open source, final CTA. Dark base, minimal animation with `prefers-reduced-motion`, responsive (desktop / iPad / iPhone), SEO title/description, Open Graph, Twitter card, favicon.
- Use real product output only: editor screenshots taken in a real browser, glyph outlines and bridges generated by `src/geometry.js` from the bundled fonts. Unimplemented features are shown as Coming Soon.
- Completion: LP visible at `/landing/`, editor at `/` unchanged, CTA and GitHub links work, assets not 404 under the base path, reload does not 404, build and tests pass, console clean at the three viewport sizes, deployed to Pages and verified.

### Implemented and validated (2026-09-14)
- Investigation: Vite static build with `base: "/TypeFab/"`, single `index.html` entry deployed from `dist/` by `.github/workflows/pages.yml`; no SPA routing; assets via Vite-rewritten absolute paths and `import.meta.env.BASE_URL`; brand = navy `#263b4d` mark with orange `#efa562` (favicon.svg), Fusion-style light editor UI.
- Phase 1 structure: `vite.config.js` now builds two pages (`index.html` → editor at `/`, `landing/index.html` → `/landing/`). The editor entry, its assets and behaviour are unchanged. Phase 2 needs only a different `rollupOptions.input` mapping and the `EDITOR_URL` constant in `src/landing.js` (static hrefs use `../` as the no-JS fallback and are rewritten to `BASE_URL` at load).
- Landing page (`landing/index.html`, `src/landing.js`, `src/landing.css`, no new dependencies): sticky nav (Editor / Features / How it works / GitHub / TypeFabを開く), hero with the real editor screenshot in a browser frame, Before/After (NORMAL FONT → OUTLINE → BRIDGE ADDED → LASER-CUT READY) with a picker for A O R 8 日 あ, product showcase tabs (Text, Japanese Fonts, Layout, Vector Editing, Bridge, Shapes, SVG Export), six-step workflow with ORDER marked Coming Soon, bridge section with a schematic "physical result" (no bridge → island drops; with bridge → one piece) plus sketch/cut-preview screenshots and the material-strength disclaimer, vector editing list, makers job list, browser-to-physical pipeline marked Coming Soon, open source, final CTA, footer with the font licence note. Dark base, English headlines / Japanese copy, Inter/system fonts (no web-font requests).
- Real product output only: `public/landing/*.webp` are Playwright screenshots of the production build (hero 1440×900 @2x, bridge sketch/cut close-ups at 200 %, warp Arc Up, path edit at 305 %, toolbar, inspector); Before/After and the bridge diagram use `src/landing-glyphs.js`, generated by `scripts/landing-glyphs.mjs` from the bundled fonts with `layoutGlyphs` + `automaticBridges` + `cutGeometry` (every sample has ≥2 bridges, 0 untouched closed contours). `og.png` (1200×630) is a capture of the hero.
- Animation: fade/translate reveal via IntersectionObserver and SVG stroke drawing of the cut path; both disabled under `prefers-reduced-motion`. No WebGL/particles/video. Total image weight 544 KB (WebP q84 + OG PNG).
- SEO: title "TypeFab — Laser-Cut Typography & SVG Editor", the specified description, canonical, Open Graph (type/site_name/title/description/url/image 1200×630/locale), Twitter summary_large_image, favicon.
- `npm test`: 102 passed (4 new: glyph data is real geometry and matches a fresh pipeline run for 日, HTML metadata/CTA/Coming Soon/referenced images exist, two-page Vite config). `npm run build`: passed (`dist/index.html` + `dist/landing/index.html`, assets under `/TypeFab/`). No linter is configured in this repo; `node --check` passes on the new scripts.
- Real browsers (production preview): 52 checks — Chromium 1440×900 (desktop), 1024×1366 (iPad), 390×844 (iPhone) and WebKit 390×844: title, 4 Before/After SVGs rendered, 3 diagram panels, "TypeFabを開く" href resolves to `/TypeFab/`, GitHub links, no horizontal overflow, glyph picker and tabs work, all visible images load, reload returns 200, CTA navigates to the editor which boots normally, 0 console errors/warnings, 0 failed requests (no 404 under the base path). Full-page and per-section screenshots inspected; on phones the hero crops to the canvas instead of shrinking the UI.
- Not done: Phase 2 (`/` → LP, `/app/` → editor) is deliberately left for a separate change; Lighthouse was not run; no physical photos exist, so the "physical result" is labelled 図解 (schematic).
- Deployed: commit `ba2441c` ("Add landing page at /landing/") pushed to `main` → https://github.com/fooping-tech/TypeFab/actions/runs/34838482397 — success. Public URLs HTTP 200 (`/TypeFab/`, `/TypeFab/landing/`, `hero.webp`, `og.png`); the same 52-check browser suite passed against https://fooping-tech.github.io/TypeFab/landing/ (Chromium desktop/iPad/iPhone, WebKit iPhone, 0 console errors, 0 failed requests, CTA boots the public editor).

## Laser-cut ordering flow — Issue #1 (requested 2026-09-14)
- Source: https://github.com/fooping-tech/TypeFab/issues/1. Design → Order → Fabrication → Delivery: hand the current design's SVG (or an uploaded SVG) to an order page, analyse it (size in mm, viewBox, path count, cut length, open/closed paths, duplicate lines, text/unsupported elements, security), choose material / thickness / quantity / normal or express, show the price, collect the address, pay with Stripe Checkout, store the SVG in R2 and the order in D1, confirm payment through the Stripe webhook (idempotent), and manage orders (filters, SVG download, PROCESSING → READY → SHIPPED with tracking number) in an admin page inside TypeFab.
- Constraints from the issue: no secrets or payment logic on GitHub Pages; the backend recomputes the price and never trusts a client total; 1 SVG user unit = 1 mm, physical size required (px/unitless needs confirmation); reject script / foreignObject / external resources / event handlers / iframe; express = fabrication ×2, shipping not doubled; lead times and the bulk threshold (10) are settings; bulk orders go to an inquiry; SVG bodies live in R2 under generated keys; README documents architecture, Cloudflare / Stripe setup, env vars, local dev and production steps; `.env.example`; keep existing editor features intact.
- Verification plan: unit tests for pricing, SVG analysis (mm / viewBox / paths only / no width / no height / px / script / foreignObject / external URL / text only / open path / malformed) and the Worker (normal, express, quantities 1 / 9 / 10, Stripe success, Stripe cancel, duplicate webhook); a real-browser end-to-end run against a local Worker (wrangler dev with local D1 / R2) and a mock Stripe server; deploy the frontend to Pages. Cloudflare and Stripe accounts are the user's, so the production Worker cannot be deployed from here.

### Implemented and validated (2026-09-14)
- Shared pure modules: `src/pricing.js` (catalogue with provisional prices for MDF 2.5/3/5.5 mm and acrylic 2/3/5 mm, "その他" = inquiry only; `quote()` = baseFee + materialFee + processingFee + quantityFee, express ×2 on the fabrication price only, shipping rules compact ¥750 / parcel ¥1,100, size limits 300 × 200 mm, bulk threshold 10, lead times 7 / 3 days, processing-time estimate from cut length and path count, ship-by date, status list and allowed transitions) and `src/svganalyze.js` (size in mm from physical units / px / viewBox with confirmation, `withPhysicalSize()` rewriting width/height/viewBox, path count, sub-paths, open/closed, cut length via the existing import flattening, duplicate segments, text/unsupported counts, security findings for script / foreignObject / iframe / embed / event handlers / javascript: / external href / url(http) / @import / external entities / xml-stylesheet, browser `sanitizeSVG()` for the `<img>` preview).
- Worker (`worker/`, wrangler 4, no runtime dependencies beyond the repo's modules): `src/app.js` handlers with injected store / bucket / fetch / clock; D1 store and in-memory store behind one interface; Stripe REST Checkout Session creation and HMAC-SHA256 webhook verification with Web Crypto; CORS for configured origins (exposes Content-Disposition); order creation validates the SVG server-side (rejects unsafe or unsized files, accepts a confirmed width), recomputes the quote (client totals ignored), refuses bulk/inquiry orders, stores the SVG in R2 under `orders/<id>/<hash>.svg`, inserts PAYMENT_PENDING, creates the session (cancels the order on failure); webhook marks PAID once per event id (duplicates answered `duplicate: true`), sets paidAt / shipBy / payment intent, records amount mismatches, expiry/failed cancels pending orders; customer status by access token; admin endpoints behind a Bearer token with list filters, detail + event log, SVG download, transition-checked status changes with tracking number and carrier. `schema.sql`, `wrangler.toml`, `.dev.vars.example`, `.env.example`, Pages workflow passes `vars.ORDER_API_URL` to the build.
- Frontend: editor header button 「このデザインを加工注文する」 runs the export checks and hands the SVG over via localStorage to `/order/`; order page (`order/index.html`, `src/order.js`, `src/order.css`) with drop/select upload, sanitised preview, check list (✓/⚠/✕), cut length and path stats, real-width confirmation, material / thickness / quantity / delivery, live estimate with breakdown, bulk-inquiry banner with contact CTA, address form with draft persistence, confirmation screen, Stripe redirect, and a status view after return (polls until PAID; cancel leaves the order pending); admin page (`admin/index.html`, `src/admin.js`) with token login, filters (未処理 / PAID / PROCESSING / READY / SHIPPED / COMPLETED / 未決済・取消 / すべて), cards showing order/paid dates, normal/express (express highlighted, overdue ship-by in red), spec, price, address, SVG view/download and transition buttons. Without `VITE_ORDER_API_URL` the pages show a banner and disable checkout. Landing page: ORDER step and pipeline now say the order page exists but checkout is unavailable until the fabrication service is configured, with a link to the order page.
- `npm test`: 127 passed (25 new: pricing normal/express/quantity 1·9·10/limits/shipping/time/ship-by/catalogue; SVG analysis mm/viewBox/paths-only/TypeFab export/cm·in/no width·height/px/unitless/confirmed size/script/foreignObject/handlers/javascript:/external image·use·css/@import/iframe/XXE/text-only/open paths/duplicates/malformed/oversize; Worker config·quote·CORS, order creation, rejections, Stripe failure, webhook signature/PAID/duplicate/expiry/mismatch, admin auth/filters/download/transitions, Stripe helpers). Production build passed with four pages.
- Real browser end-to-end (Chromium, production build with `VITE_ORDER_API_URL=http://127.0.0.1:8787`, `wrangler dev` with local D1/R2 and the schema applied, a mock Stripe server on :4242 that creates sessions, hosts a Pay/Cancel page and posts the signed `checkout.session.completed` webhook twice): 44 checks — editor button → order page with the handed-over SVG (240 × 160 mm, viewBox, paths only, cut length), express quote, bulk banner and disabled checkout at 10, address validation, confirmation summary equal to the estimate, mock checkout charging the server total (¥5,600), return with `result=success` and PAID status with ship-by; px SVG upload asking for the real width (100 → 100 × 50 mm), text warning, compact shipping, draft restore, checkout cancel leaving PAYMENT_PENDING; script SVG blocked and not executed while the preview still renders; admin wrong token rejected, paid order under 未処理 with the express band, deadline, same total; SVG download from R2 named `TF-…-typefab.svg` containing the cut paths; PAID → PROCESSING → READY → SHIPPED with tracking number and carrier via the prompts; pending order listed under 未決済・取消; event log PAYMENT_PENDING>PAID>PROCESSING>READY>SHIPPED; access token hidden from admin; order page fits 390 px; console clean. Local D1 rows inspected with `wrangler d1 execute --local`. Landing suite re-run: 52/52.
- Found during the run: the Worker's `SITE_URL` must match the site the browser is on (local runs need `SITE_URL=http://127.0.0.1:4173/TypeFab/` in `.dev.vars`), and `Content-Disposition` had to be exposed through CORS for the download name — both fixed/documented.
- Not done / not verifiable here: the production Worker, D1, R2, Stripe account, webhook endpoint and the `ORDER_API_URL` repository variable belong to the user, so the public site is deployed without an API URL (order page shows the estimate-only banner); no real Stripe charge was made; e-mail notifications, carrier APIs, refunds (Stripe dashboard) and holidays in lead times are out of the MVP; prices are placeholders.
- Deployed: commit `e8d969d` ("Add laser-cut ordering flow") pushed to `main` → https://github.com/fooping-tech/TypeFab/actions/runs/34840772057 — success. Public URLs HTTP 200: `/TypeFab/`, `/TypeFab/landing/`, `/TypeFab/order/`, `/TypeFab/admin/`. Against the public site: the estimate-only checks passed 8/8 (editor button hands the SVG to the public order page, 240 × 160 mm analysed, estimate shown, checkout disabled with the "API URL not set" banner, admin alert, landing order link) and the landing suite passed 52/52, console clean. Checkout on the public site stays disabled until the user deploys the Worker and sets the `ORDER_API_URL` repository variable (README「加工注文（EC）」).

## Landing page Phase 2: `/` → landing, `/app/` → editor — Issue #2 (requested 2026-09-14)
- Swap the pages: the landing page becomes the site root, the editor moves to `/app/`. Do not move if asset paths, fonts or routing would break; keep a compatibility path for existing `/TypeFab/` users (autosaved projects live in origin-scoped localStorage, so they survive the path change).
- Update every editor link (landing CTAs, order/admin 「エディタに戻る」, README, CLAUDE.md), canonical/OG URLs, tests; verify both pages, fonts, export, the order hand-off and reload in a real browser; deploy and verify Pages.

### Implemented and validated (2026-09-14)
- `index.html` is now the landing page and `app/index.html` the editor (`vite.config.js` inputs: landing / editor / order / admin). Nothing in the editor code depended on its path: asset references are root-absolute and rewritten by Vite, fonts load via `import.meta.env.BASE_URL`, and the autosave key is origin-scoped localStorage, so projects edited at the old `/TypeFab/` URL restore unchanged at `/TypeFab/app/`.
- Links: landing CTAs and nav → `/app/` (`EDITOR_URL = BASE_URL + "app/"`, static fallback `./app/`), landing order link → `/order/`, order page 「エディタに戻る」 and status buttons → `../app/`, canonical / og:url → the site root. Compatibility: a notice bar on the landing page tells browsers that hold an autosaved design that the editor moved to `/app/`; the short-lived `/landing/` URL now meta-refreshes to `/` (`public/landing/index.html`). README and CLAUDE.md list the new URLs.
- `npm test`: 127 passed (landing tests updated for the new paths). Build: `dist/index.html`, `dist/app/index.html`, `dist/order/`, `dist/admin/`, `dist/landing/` (redirect).
- Real Chromium (production preview): 17 checks — root serves the landing page, CTA `/TypeFab/app/`, order link `/TypeFab/order/`, no notice on a fresh browser, `/landing/` redirects to `/`, editor boots at `/app/` with both bundled fonts requested, text edit survives reload at `/app/` (autosave), export downloads `typefab.svg`, returning user sees the `/app/` notice, editor → order page hand-off, order back link returns to `/app/`, admin 200, console clean, no failed requests; landing suite (desktop / iPad / iPhone Chromium + WebKit iPhone) 52/52 against the root.
- Deployed: commit `0185ae9` ("Move the landing page to / and the editor to /app/") pushed to `main` → https://github.com/fooping-tech/TypeFab/actions/runs/34849140883 — success. Public HTTP 200 for `/TypeFab/` (landing), `/TypeFab/app/` (editor), `/TypeFab/order/`, `/TypeFab/admin/`, `/TypeFab/landing/` (redirect page). Against the public site: Phase 2 checks 16/17 (the one miss is the test's own count of font resource entries: the public page lists 3 TTF entries because the inspector's CSS font preview also loads a bundled font; both fonts loaded, editor booted, 0 failed requests, 0 console errors) and the landing suite 52/52 at the root.

## Bundled Japanese fonts, lazy loading, licences and user-font policy — Issue #3 (requested 2026-09-15)
- Source: https://github.com/fooping-tech/TypeFab/issues/3. Add six OFL-1.1 fonts from the official Google Fonts repository (M PLUS Rounded 1c, Dela Gothic One, DotGothic16, RocknRoll One, Zen Kurenaido, Kaisei Decol) with their OFL texts, after checking each licence; keep `font: "zen"` / `"shippori"` compatible.
- Catalogue (`FONT_CATALOG`: id, label, file, category, licence, copyright, source), lazy loading (only the default font at start-up, fetch on selection, cache, no duplicate fetch, loading state, explicit error without silent fallback, HarfBuzz shaping font built at the same time), font picker with categories / TypeFab標準 badge / current font / per-font preview, a font-licence screen in the editor plus `THIRD_PARTY_FONTS.md`, and a user-font policy with a versioned consent checkbox before local fonts can be added.
- Tests: every bundled font outlines Japanese and alphanumerics, vertical text works (vert/vrt2 where present), SVG export stays path-only, bridges work, font switching keeps size/placement, lazy loader dedupes, initial load does not fetch all fonts, policy gate, licence screen lists all fonts; build and console clean; deploy and verify Pages.

### Implemented and validated (2026-09-15)
- Fonts: six OFL-1.1 fonts added from the official google/fonts repository with their `OFL.txt` (Zen Maru Gothic, Dela Gothic One, RocknRoll One, Kaisei Decol, Zen Kurenaido, DotGothic16), each checked for "SIL OPEN FONT LICENSE Version 1.1", copyright header, full coverage of Japanese / Latin / digits and vert/vrt2 substitutions (5/5 vertical alternates in all 8 fonts). M PLUS Rounded 1c was not adopted: its google/fonts directory has no OFL.txt and the upstream source is unconfirmed, so it fails the "bundle the licence text with the font" rule (recorded in `THIRD_PARTY_FONTS.md`); Zen Maru Gothic covers 丸ゴシック instead. `public/fonts/` is now 31 MB, but only the selected fonts are downloaded.
- `src/fonts.js`: `FONT_CATALOG` (id, label, file, licence file, category, copyright, source, upstream; ids `zen` / `shippori` unchanged), `FONT_CATEGORIES`, `createFontLoader` (fetch on demand, in-flight promise sharing, cache, per-id state idle / loading / loaded / error / missing, explicit error message, retry, session fonts via `add`), versioned `fontPolicyAccepted` (`FONT_POLICY_VERSION = 1`), the policy and bundled-font texts from the issue. `THIRD_PARTY_FONTS.md` lists every font with copyright, licence, source and files.
- Editor: start-up fetches only the default font (plus fonts used by a restored project, in the background); choosing a font fetches it once, shows 「…を読み込み中」 while the item keeps its current font, applies on success, and on failure shows the error and keeps the previous font (no fallback). Font select grouped by category with 「（標準）」, TypeFab標準 / 追加フォント badges, the current font's name drawn with its own glyphs (`src/font-previews.js`, generated by `scripts/font-previews.mjs`, lazy-loaded chunk), a 「フォント一覧・プレビュー」 dialog with all fonts previewed in their own glyphs, a 「フォントライセンス」 dialog (footer) with the bundled-font note, the table of copyright / licence / source / bundled licence file links and the user-font policy, and a consent dialog before the file picker (checkbox gates the button, "詳細を見る" opens the licence dialog, consent stored with the policy version and re-asked when the version differs). The old CSS `@font-face` previews (which downloaded the fonts a second time) were removed.
- `npm test`: 133 passed (6 new: catalogue / files / licences / previews / THIRD_PARTY_FONTS.md; all 8 fonts outline Japanese + alphanumerics with consistent placement and vertical shaping; bridges and path-only export per font; loader dedupe / error / retry / custom; policy versioning; legacy font ids). Build passed (font previews as a separate chunk).
- Real Chromium (production preview): 35 checks — initial load fetches only ZenKakuGothicNew; grouped select, badge, glyph preview; switching to Dela Gothic One shows the loading state (fetch slowed in the test), keeps the outline until ready, fetches once, rebuilds the outline; switching back does not refetch; vertical text with the new font; a blocked DotGothic16 fetch shows the explicit error and keeps the previous font, and a retry succeeds; gallery lists and previews all 8 and switches fonts; SVG export path-only; licence dialog lists all 8 with copyright / licence / policy and the served OFL text; add-font gated by the policy dialog (no file chooser before consent, accept disabled until checked, chooser opens after consent, RocknRoll One added as 追加フォント, consent stored as version 1, second add skips the dialog, an outdated version asks again); reload fetches only the default and used fonts; console clean. Earlier suites: Phase 2 layout 16/17 (the remaining check expected two fonts at start-up, which is now intentionally one), estimate-only order flow 8/8.
- Deployed: commit `31585c9` ("Add six OFL fonts with lazy loading…") pushed to `main` → https://github.com/fooping-tech/TypeFab/actions/runs/34948076215 — success. Public `/TypeFab/app/` and `/TypeFab/fonts/DelaGothicOne-Regular.ttf` HTTP 200. The font suite against the public site passed 34/35; the one miss ("current font name previewed as its own glyphs") is timing: the lazily loaded preview chunk had not arrived over the network when the check ran (it renders once loaded), everything else including lazy fetching, error handling, gallery, licences and the consent gate passed.

## Non-parametric 2D CAD tools — Issue #4 (requested 2026-09-15)
- Source: https://github.com/fooping-tech/TypeFab/issues/4. Add Polygon, Mirror, Rectangular Pattern, Circular Pattern, Offset, Trim, Extend, Fillet, Chamfer, Measure and reference Dimensions to the editor without a constraint solver; results are ordinary items / editable paths with no link to their source, every confirmation is one undo step, previews do not touch the project, dimensions are annotations kept apart from geometry and never exported.
- Verification plan: unit tests for each operation (polygon 3/6/100, mirror horizontal/vertical/arbitrary for text/path/group, patterns 1×1/1×N/N×M/negative spacing, circular 360°/180°/count 2/arbitrary centre, offset rect/circle/polygon/holes, trim crossing lines/line+circle/no intersection, extend target/no target, fillet 90°/acute/obtuse/too large, chamfer 90°/too large, measure), JSON compatibility, real-browser checks of the tools, build, console; deploy and verify Pages.

### Implemented and validated (2026-09-15)
- `src/cad.js` (pure, no solver): regular polygons (3–100 sides, centre placement, editable closed path); reflection maths and `mirrorItems` (rect / ellipse / line copies keep their type with the frame re-expressed so a 0° box mirrors to a 0° box; text, warped shapes and paths become exactly reflected outlines with handles reflected; scoped bridges reflected and re-owned; groups remapped); rectangular and circular patterns (copies only, original kept, per-set groups and bridge owners remapped, 360° even spacing or both ends for smaller angles, rotation updated, item cap 2000); offset (Clipper `ClipperOffset` with round / miter / square joins after nonzero simplification so holes shrink the right way, parallel polylines for open contours, vanished result reported); trim (nearest span between crossings on the clicked contour, lines → shorter lines or two lines, closed shapes → open outline paths, single-crossing and no-crossing errors); extend (open end to the first crossing along its direction); fillet / chamfer on straight corners of any path (tangent points at r/tan(θ/2), arc as a cubic, size limits with the maximum in the message, rect/ellipse converted to exact paths first, two lines sharing an end joined into one open path); measurement (points, lines, circles/ellipses, boxes, angles, vertex snapping); reference dimensions (`makeDimension` linear / horizontal / vertical / angle / radius / diameter, label, drawing geometry). `project.annotations` validated in `project.js` (older files simply have none) and never reach `cutGeometry` / `exportSVG`.
- Editor: second toolbar row grouped CREATE / MODIFY / PATTERN / INSPECT (11 tools) with a tool panel in the inspector (parameters, previews, errors, 確定 / キャンセル or 終了); ghost previews for mirror / patterns / offset drawn in the overlay without touching the project; canvas clicks place polygons, set mirror axes and pattern centres, trim / extend / fillet / chamfer the item under the pointer (or the nearest within 10 px), measure and place dimensions; Enter confirms, Escape cancels; every confirmed operation is one checkpoint. Dimensions are drawn as an overlay (ticks, extension lines, arcs, leaders, labels), listed in the browser panel under 寸法, selectable on the canvas or in the list, deleted with Delete / ×, saved with the project and restored on reload. Open-only outlines (trimmed paths, parallel lines, joined line corners) are drawn as strokes instead of filled areas.
- `npm test`: 145 passed (12 new CAD tests: polygon 3/6/100 + rotation + limits; reflection, rect/line/ellipse mirror corners, text/path/group/bridge mirror; rectangular 1×1 / 1×N / N×M / negative spacing / groups / bridges; circular 360° / 180° / count 2 / arbitrary centre; offset rect/circle/polygon/holes/vanish/open; trim crossing lines / line+circle / closed rect / no crossing / single crossing; extend target / backwards / no target / closed; fillet 90° / acute / obtuse / limit / curved; chamfer / limits / corner tools / two lines; measure and snapping; dimensions, JSON validation and export exclusion). Build passed.
- Real Chromium (production preview): 53 checks — toolbar groups; octagon placed at the click with 8 nodes, undo/redo; rectangle; mirror via centre axis then two clicked points, ghost preview, confirm gating, copy at the mirrored position with rotation 0, undo; 3×2 pattern preview (5 ghosts), Enter confirms 6 rectangles at the right spacing, one undo removes all; circular pattern of 4 about a clicked centre with 90°/180°/270° copies; offset +3 mm outline at 117 mm, inner offset too large reported in the panel, Escape leaves the tool; trim of a crossed horizontal line (left part removed, 15 mm remains), trim on empty space reported; extend to a wall; fillet r5 on the rectangle corner (5-node path with arc) and chamfer 6 (6 nodes), oversized chamfer refused; two lines meeting at a corner filleted into one open path; measure 10,10→50,40 (50.00 / ΔX 40 / ΔY 30) with a canvas label, line length/angle, circle radius/diameter; linear 30 mm, angle 90° and R15 dimensions stored, drawn and listed; SVG export without dimensions; reload keeps 3 dimensions; Delete / undo / × on dimensions; auto bridge on text still works; console clean. Earlier suites still pass (layout 16/17 with the known one-font-at-start-up check, estimate-only order 8/8, fonts 35/35).
- Not implemented (by design, per the issue): constraints and solver, driving dimensions, parametric history, persistent links between patterns / offsets and their sources, Bézier trim/extend beyond flattened contours (trim/extend work on the flattened outline and refit curves), per-segment fillet on curved corners.
- Deployed: commit `6bc625e` ("Add non-parametric 2D CAD tools") pushed to `main` → https://github.com/fooping-tech/TypeFab/actions/runs/34950225417 — success. Public `/TypeFab/app/` HTTP 200; the 53-check CAD browser suite passed against https://fooping-tech.github.io/TypeFab/app/ with a clean console.

## Follow-up: dimension deletion and polygon placement (requested 2026-09-15)
- 「寸法は消せるようにして」: make deleting reference dimensions obvious — selecting a dimension (canvas or list) shows an inspector panel with 「この寸法を削除」 and 「寸法をすべて消す」; the 寸法 list header and the dimension tool panel also offer 「すべて消す」; Delete key and the list × keep working; clearing is one undo step.
- 「多角形は楕円と同じ列に」: the polygon tool moves to the first toolbar row right after 楕円; the second row keeps MODIFY / PATTERN / INSPECT.
- Implemented: selecting a dimension on the canvas or in the list shows an inspector panel (type, value, points) with 「この寸法を削除」 and 「寸法をすべて消す」; the 寸法 list header has 「すべて消す」 and the dimension tool panel shows the same button with the count; clearing is one undo step. The polygon button now sits in the first toolbar row directly after 楕円 (same size and style); the CAD row shows MODIFY / PATTERN / INSPECT (10 tools). README updated.
- `npm test`: 145 passed; build passed. Real Chromium (production preview): the CAD suite grew to 59 checks (first-row order select/text/rect/circle/polygon/line/bridge, 10 tools in the second row, canvas click on a dimension opens the delete panel, inspector delete, すべて消す removes all and undo restores them) — all passed.
- Deployed: commit `13785ce` pushed to `main` → https://github.com/fooping-tech/TypeFab/actions/runs/34951574169 — success. Public `/TypeFab/app/` HTTP 200; the 59-check CAD suite passed against the public site.

## Smart Connect — Issue #5 実装計画（2026-09-15）

### 要求・今回の成果物
- 出典: https://github.com/fooping-tech/TypeFab/issues/5 （本文・コメントを取得して確認。コメントなし）。文字自体を切り出すため、文字内部・文字間の材料を接続し、一体の閉じた輪郭として出力する。
- 今回は実装計画の作成。以下は未実装・未検証の計画であり、過去のテスト件数や公開結果を本機能の検証結果として扱わない。
- 既存Stencil Bridgeは切断領域・カット線を削る機能として維持。Smart Connectは文字材料 T に接続形状 C を加える `Union(T, C)` とし、別のコマンド・編集状態で扱う。

### 現状と再利用する処理
| 現在のコード | 利用方法・注意点 |
| --- | --- |
| `src/grouping.js` の非公開 `filledRegions()` / `splitParts()` | 既にClipper PolyTreeで外周と穴をまとめ、穴内の独立した材料も分離している。連結成分抽出の第一候補として共通化する。 |
| `src/geometry.js` の `contourTree()` | 輪郭の包含関係の参考。輪郭数を材料の部品数として数えない。重なりをUnionした後の材料領域を用いる。 |
| 同 `nearestConnection()`（非公開） | 点→線分投影による最短候補。共有するなら既存Bridgeの出力を回帰検証し、Smart Connectでは複数候補へ拡張する。 |
| `src/operations.js` の `booleanContours()` | nonzero規則・整数倍率10000を使うUnion。単一入力の正規化は現在のAPIでは不可なので、共通の低水準処理を追加する。 |
| `src/typography.js` の `layoutGlyphs()` | 字形・クラスタ単位の所属情報を取得する。最終輪郭へ同じ長体・Warp・配置変換を適用し、所属を対応づける。 |
| `src/main.js` のCADプレビュー・`checkpoint()` / `commit()` | project外のプレビュー、確定1回のUndo、キャンセルの作法を踏襲する。 |
| `src/path.js` / `src/project.js` | 最終Unionを通常の編集可能なoutlineへ変換し、既存v1/v2 JSONとSVG経路を利用する。 |
- V1は既存の素のJavaScript + Clipperで実装する。Paper.js、別のBooleanライブラリ、Skeletonライブラリ、MLは追加しない。

### V1の仕様判断
- 対象: 選択された編集可能なtextまたは閉じたoutline（複数選択可）。非表示・ロック・線分・開いた輪郭・Bridgeを含む選択は理由を示して実行不可。複数レイヤーを跨ぐ入力はV1では実行不可とし、結果の所属を曖昧にしない。
- 文字所属のない固定outlineは幾何的な連結成分だけで接続する。「文字内／隣接文字」設定は無効化して説明し、文字所属を座標から推測して断定しない。日本語優先は手動指定可能にする。
- 幅1.5 mm、Max gap 10 mm、Style Autoを初期値とする。幅は接続部の最小設計幅（Taperedでは中央幅）。Max gapは材料表面間の距離で判定し、曲線の迂回長にも上限を設ける。NaN・非正数・過大な値は入力検証する。
- 「全体を1つ」は初期ONで文字内／文字間接続を必須にする。個別設定をOFFにする場合は「全体を1つ」もOFFにし、連結する対象範囲を明示する。隣接文字は組版順の直前・直後の可視字形（空白を飛ばす）。改行・縦書きの列を跨ぐ接続は「全体を1つ」の場合だけ候補に含め、Max gapは常に守る。
- 全体接続ONで候補グラフが分断される場合、未接続部品数・該当箇所・原因を表示してApplyを無効化する。距離・幅・穴の制約を黙って緩めない。全体接続OFFでは設定対象の接続結果と残存部品数を表示する。
- 手動調整はV1では「確定前」に全操作を提供する。確定後は通常のoutlineとPath Editで編集し、Connectorとしての再編集はV1.5以降。Apply時に文字編集・元Warp設定を焼き込むことを説明し、Undoで元データへ戻せるようにする。
- 既存の対象付きBridgeを持つ入力、または対象範囲に作用する全体Bridgeがある場合はV1の実行を止めて理由を示す。所有先を勝手に変更したり、切断済み形状を一体形状として扱ったりしない。
- IssueのV1/V1.5記述に従い、V1は方向・細端候補を優先したSmooth / Tapered / RoundedとStraightフォールバック。専用Stroke Extendスタイルと精密なlocal thickness推定はV1.5。ただし日本語で自然な画の延長候補を優先する評価と目視確認はV1から必須とし、矩形を並べるだけでは完了にしない。

### 実装順序と各段階の完了条件
1. **材料成分解析と入力の固定**
   - 新規 `src/polygon.js`（仮）に正規化・PolyTree成分抽出を集約し、既存 `filledRegions()` を利用側へ整理する。既存Bridgeの判定ロジックは不用意に置き換えない。
   - 最終ワールド座標の輪郭をUnionし、`componentId / outer / holes / sourceItemIds / glyphIds / bounds` を作る。重なった字形は同一成分、穴は空隙、穴内の独立材料は別成分とする。
   - 点だけの接触を有効な接続と数えない。辺共有・有限幅の重なり・極細接触を区別する試験を先に作り、必要な幅を確保できない接続は候補追加または明示的失敗にする。
   - 完了: 穴・入れ子・重なり・離れた点・ワープ後の実座標を持つfixtureで成分と所属が正しく得られる。
2. **複数候補の生成と評価**
   - 新規 `src/smart-connect.js` に純粋関数として実装。一定のmm間隔で輪郭をsampleし、近傍から接線・曲率・端部らしさを推定。細い先端の両側輪郭から延長軸を推定し、輪郭接線そのものと筆画の伸びる方向を混同しない。
   - 境界boxとMax gapで成分対を絞り、最短候補に加えて端部・直線端・方向の良い候補を複数保持する。尖った先端を好む評価と接合部の鋭角を避ける評価を分離し、実際の接合は先端より少し太い位置へ戻す。
   - 距離/Max gap、角度、曲率を無次元化し、距離・方向・接合角・細すぎる根元・負形状への侵入・交差・不自然な曲率を評価する。日本語は端部軸と接続先方向の整合を加点する。
   - 穴の不要な閉塞・無関係な輪郭の横断・自己交差は単なる低得点でなく棄却条件。穴内の材料をつなぐ場合の負形状変更は必要な接続帯に限定し、元の穴領域の完全消失を避ける。可読性は幾何的な代理指標と目視評価に分ける。
   - 完了: 最短候補より方向の良い候補を選べるfixture、同点時の安定順序、候補なしの診断がある。
3. **Connector形状と最小接続の選択**
   - Smooth: 3次Bezier中心線を帯にする。Tapered: 根元を太くし中央を指定幅にする。Rounded: カプセル。Straight: 最終フォールバック。Autoでは候補と形状を組にして評価する。
   - 両端を元材料内部へ有限量重ねる。曲線平坦化は既存0.02 mmを基準に、幅に対して粗すぎる場合は細分化または入力拒否する。Clipper整数丸めで根元や中央幅が消えないことを検証する。
   - 有効候補を辺としたKruskal/Union-Find相当で選択する。既に連結した成分へ余分な辺を足さず、採用済みConnectorとの交差も検査して別候補を試す。
   - 衝突制約で貪欲選択が詰まる場合は、上限付きの別候補探索を行う。探索上限到達は「自動生成できなかった」と区別し、幾何的に不可能と断言しない。
   - 2成分ずつを結ぶ制約下で初期N成分に対しN−1本を基準にする。最後にUnion後の成分数・穴・接合幅を再検査し、除去しても接続が保たれる余分なConnectorを取り除く。MSTだけで最終形状の連結を保証しない。
   - 完了: 全体ONの成功時に材料成分1、不要な辺なし、閉じた非自己交差輪郭、失敗時に原因が返る。
4. **Previewと手動調整**
   - `src/main.js` / `src/style.css` に独立したSmart Connect入口・設定パネル・オーバーレイを追加する。必要なら専用UIモジュールへ分離する。
   - 一時状態に入力snapshot、設定、成分、候補、選択辺、手動変更、Union結果、診断を保持する。Preview・設定変更・キャンセルでproject、Undo履歴、自動保存を変更しない。
   - ConnectorとUnion後輪郭を切替表示し、部品数の前後・接続本数・未接続箇所を示す。Connector選択後に移動、両接続点の変更、幅、Bezier制御点による曲率、削除、Next candidateを提供する。
   - 移動・端点変更は元材料との接合を再計算する。削除で分断した場合はApplyを止める。設定の再生成で手動修正が失われる場合は明示し、古いプレビューを確定させない。
   - 重い生成を描画のたびに実行せず、設定変更時に間引いて計算・キャッシュする。入力変更・他ツールへの移行・Escapeで失効し、遅れて返った計算結果を採用しない。
   - 完了: すべての手動操作とキャンセル、無効入力、失敗状態をブラウザで確認できる。
5. **Apply・既存編集との統合**
   - Apply前に最新設定・手動結果を再検証し、成功時だけ1回のcheckpointで入力をUnion済みoutlineへ置換する。所属レイヤーと重ね順を決め、消えた入力のgroupIdなど参照を整理する。
   - 保存する `contours` は最終形状。`path` は同じ形状の閉じた直線ノードから始め、曲線の再近似で接合・穴が変わることを避ける。元text/warp等の再生成情報は結果へ残さない。
   - V1はConnector専用の永続型を増やさずv2 outlineとして保存する。保存/再読込、Undo/Redo、Path Edit、結果への新たなWarp、移動・回転・拡縮、SVG出力を確認する。
   - 完了: Applyが1 Undoで元の文字・Warp・選択対象を復元し、Redoで同じ最終形状を再現。書体がなくても保存結果を再表示・出力できる。
6. **回帰・見た目・利用者向け説明**
   - 下記の自動/ブラウザ試験を実行し、READMEにStencil Bridgeとの使い分け、確定で固定outlineになること、調整と失敗時の操作を追記する。
   - 完了: テスト・build・実ブラウザ確認の結果をこの節へ追記する。実装後の公開作業ではリポジトリの公開手順に従いActionsと公開サイトを別途確認する。

### 検証計画
- 新規 `tests/smart-connect.test.js`: 成分0/1/N、`i`のdot、穴と穴内材料、重なり、点接触、有限幅接合、Max gap境界、幅の境界値、候補衝突、候補なし、決定性、N−1本、既接続で追加0、全体OFFの部分接続、手動削除・再接合。
- 形状検査: 元材料を欠損させないこと、Union後1成分、意図しない穴の消失なし、自己交差なし、設計幅を下回る接合の拒否、回転・拡縮・Warp後の座標整合。位相と幅は別のassertionにする。
- 実フォント: Zen Kaku Gothic New / Shippori Minchoを主対象に、Latin `TypeFab` / `i` / `A B C`、ひらがな `ここまで読んだ` / `ありがとう`、カタカナ `タイプファブ`、漢字 `文字` / `加工` / `設計`。残る同梱6書体も輪郭生成・異常なしをスモーク確認。字間・サイズはMax gap内の成功例と意図的な失敗例を分けて記録する。
- 日本語品質: ゴシック/明朝の同条件で最短距離のみの基準結果と並べ、払い・はね・横画・縦画の延長方向、穴、可読性、曲率をスクリーンショットで比較する。自動テストの成功だけで「自然」と判断しない。
- ブラウザ: 対象選択、全設定、Preview中の保存データ不変、手動編集全操作、Next candidate、Apply不可の理由、Escape、Undo/Redo、保存/再読込、SVGダウンロード、ツール切替、console errorなし。
- 回帰: 既存Stencil Bridgeの形状とtargetId、Warp、Path Edit、CAD、グループ、レイヤー、v1/v2読込、mm/viewBox/pathのみのSVG。`npm test` と `npm run build` を実行する。
- 性能: 長文100字・複雑な明朝体で成分数/候補数/処理時間を記録し、候補探索・sample数に上限を設ける。UIが継続的に固まるならWorker化を段階4へ追加する。未測定の速度目標を達成済みとしない。
- 実機加工、kerfによる接続消失、材料ごとの最小幅・強度、加工ソフトでの結果は別検証。V1で示すのは輪郭の連結と設計幅であり、物理的一体性の保証ではない。

### V1完了チェックリスト
- [x] Smart Connect独立UI、材料の成分解析、文字内・文字間・全体接続。（2026-09-15 実装・検証済み。下記「実装」節）
- [x] 最短距離だけに依存しない日本語方向・端部候補の優先と目視評価。（2026-09-15 実装・検証済み。下記「実装」節）
- [x] Smooth / Tapered / Rounded / Straight、Auto、必要最小限の接続、最終Union検証。（2026-09-15 実装・検証済み。下記「実装」節）
- [x] projectを変えないPreviewと、確定前の移動・接続点・幅・曲率・削除・候補切替。（2026-09-15 実装・検証済み。下記「実装」節）
- [x] 失敗理由と未接続箇所を表示し、全体接続未達や無効形状でApplyしない。（2026-09-15 実装・検証済み。下記「実装」節）
- [x] Apply 1回のUndo/Redo、保存互換、Path Edit/Warp統合、mm SVG出力。（2026-09-15 実装・検証済み。下記「実装」節）
- [x] 日本語/英数字の試験、既存機能の回帰、build、実ブラウザconsole確認、README更新。（2026-09-15 実装・検証済み。下記「実装」節）

### V1.5・将来と未解決事項
- V1.5: 精密なlocal thickness・曲率に基づく払い/はね推定、専用Stroke Extend。確定後Connector再編集を追加する場合は元輪郭・接続パラメータの永続モデルとWarp/Path Edit時の無効化規則を先に設計する。
- 将来: Skeleton/medial axis、筆画分類、書体別最適化、MLランキング。
- 着手前のユーザー回答を必須とする事項は現時点ではない。上記V1の仕様判断を前提に実装可能。日本語品質の採否は段階2〜3の実フォント結果で見直す。
- 今回の実施結果: Issueと関連コードを読み、計画を追記。実装・テスト実行・公開は未実施。

## Smart Connect — Issue #5 実装（2026-09-15）

### 要求
- 上記「Smart Connect — Issue #5 実装計画（2026-09-15）」に従って V1 を実装し、テスト・ビルド・実ブラウザ確認を行い、PRを作成する。
- 完了条件: 計画の「V1完了チェックリスト」を満たす。`npm test` / `npm run build` が通る。README に使い方を追記する。PR を作成し、URL をこの節に記録する（公開は PR マージ後の `main` push で行う）。

### 実装結果（2026-09-15）
- 新規 `src/polygon.js`: Clipper PolyTree による Union → 領域（外周＋穴、穴内の島は別領域）、交差面積、点内部判定、内部点、帯（ClipperOffset）、閉輪郭オフセット。`grouping.js` の `filledRegions()` はこれを使う形に置換（`splitParts` の挙動は既存テストで回帰なし）。点接触は `StrictlySimple` で別部品として扱う（結果側の Union は速度のため非strict。接続帯は材料に重ねるため点接触に依存しない）。
- 新規 `src/smart-connect.js`（純粋関数）: `analyze()` で最終ワールド座標の Union 成分と字形所属（`layoutGlyphs` の字形ごとの最終輪郭をワープ・回転込みで対応づけ、内部点で判定）。`generate()` は輪郭を 0.2〜0.6 mm 間隔でサンプルし、内向き法線の材料深さ（端部は深く、側面は薄い）と窓内の回転角から端部らしさを推定、成分対（bbox 距離 ≤ Max gap）ごとに最短だけでなく方向・端部・接合角・細い根元・行またぎを無次元化した評価で最大8候補（他輪郭と交差する候補は棄却）を保持し、Kruskal/Union-Find で必要最小限の辺を採用。Connector は Smooth（3次ベジェ中心線の帯）／Tapered（根元1.6倍→中央指定幅）／Rounded（カプセル）／Straight（矩形）、Auto はこの順で成立するものを採用。各接続は他成分との重なり・他接続との交差／重なり・穴の面積50%超の閉塞・Max gap 超過で無効化。最後に Union で成分数・穴数を再検査し、余分な接続は除去。`nextCandidate / setConnector / moveEnd / moveConnector / removeConnector / addConnector` は確定前の手動調整、`finalize()` は再検証して輪郭と直線ノードの閉パスを返す。`nearestOnly` は比較・テスト用の最短距離のみ評価（UI なし）。
- `src/main.js`: ツールバー「スマート接続」、プロパティ欄のボタン、右クリックメニューから開始。入力検証（文字／固定パスのみ、開いた輪郭・複数レイヤー・対象付きブリッジ・重なる全体ブリッジ・部品1個は理由を表示して不可）。パネルで幅・最大距離・スタイル・文字内／隣接／全体・日本語優先を設定（全体ONで両方ON、片方OFFで全体OFF、固定パスは文字内／隣接を無効化して説明）。接続表示／結果の輪郭の切替、部品数前後・接続本数・未接続グループ・理由・警告を表示、接続一覧と選択接続の幅・スタイル・曲率・次の候補・削除、両端○と中央◇のドラッグ、2点クリックの手動追加。設定変更は世代番号付きで遅延計算し、手動調整があるときは再生成の確認表示にして古いプレビューを確定不可。Enter で確定（1 checkpoint、入力を Union 済み固定パス `contours`＋直線ノード `path` に置換、60,000 点超は path 省略）、Esc でキャンセル、入力アイテムの変更・Undo・他ツール切替で失効。プレビュー中は project・履歴・自動保存を変更しない。
- `README.md` に「スマート接続」節を追加。`src/style.css` に一覧・ハンドルのスタイル追加。
- テスト: 新規 `tests/smart-connect.test.js` 17件（設定検証、成分0/1/N・重なり・穴・島、点接触／辺共有／極細接触の区別と警告、回転・ワープ後の所属、端部優先 vs 最短距離、交差回避と診断、決定性、4スタイルの帯と Tapered の幅、N−1本・既接続0本・Union 1成分・自己交差なし・材料欠損なし、穴の保持、部分モード、手動操作一式と削除時の Apply 不可、finalize の閉直線パス・project 検証・SVG 出力、実フォント18ケース（Zen Kaku Gothic New／Shippori Mincho × TypeFab・i・A B C・ここまで読んだ・ありがとう・タイプファブ・文字・加工・設計）、日本語の端部優先が最短距離と異なること、意図的な失敗（字間3 mm・Max gap 6 mm）、縦書き2列は全体ONのみで接続、残る6書体のスモーク、`splitParts` 回帰）。`npm test`: 162 passed（既存145＋17）。`npm run build` 成功。
- 実ブラウザ（Chromium、production preview、Playwright スクリプト46項目）: 未選択で無効、失敗表示（既定の Max gap 10 mm ではデモ文字「く→る」「、→を」が離れて未接続・原因表示・確定不可）、Max gap 20 で「部品 11 → 1」、プレビュー中の保存データ不変、結果の輪郭表示、接続選択・次の候補・幅・スタイル・無効値の拒否、◇／○ドラッグ、手動調整後の設定変更で再生成確認と確定不可、削除で全体未達→確定不可と赤枠表示、手動追加で復帰、全体／文字内／隣接の連動、Esc キャンセルで保存データ不変、前回設定の保持、Enter で確定（10本・1固定パス・直線ノード path）、Undo で文字復元、Redo で同一輪郭、パス編集開始、SVG 書き出し（mm・path のみ）、再読込後の保持、線分は無効、対象付きブリッジ付き文字の拒否、メニュー項目、console error なし — すべて通過。
- 日本語品質（目視）: Zen Kaku Gothic New／Shippori Mincho の「ここまで読んだ」「ありがとう」「TypeFab」「設計」を最短距離のみ（`nearestOnly`）と並べて SVG を描画し確認。「ま」の横画端→「で」、「T」の横画端、「で」の上端など端部から延ばす候補が採用され、最短距離のみとは接続位置が変わる（自動テストでも差を確認）。明朝の払い・はねの先端は端部として検出されない箇所が残り、Smooth が常に成立するため Tapered／Rounded は手動指定時のみ使われる。矩形を並べるだけの結果ではないが「自然さ」の評価は目視の範囲で、V1.5 の local thickness／Stroke Extend は未実装。
- 性能（Node、Shippori Mincho 12 mm、100文字、成分205・接続201）: analyze 約70〜90 ms、generate 約0.6 s（結果 Union の strict 簡略化を外す前は約2.1 s）。実機のブラウザでは同程度の待ちが1回の生成・手動操作ごとに発生する。Worker 化は未実施。
- 未検証・未実装: 実機加工、kerf による接続消失、材料ごとの最小幅・強度、加工ソフトでの結果。確定後の Connector 再編集（V1.5）、Stroke Extend スタイル、精密な local thickness。公開（GitHub Pages）は PR マージ後の `main` push で行い、その際に Actions と公開 URL を確認する。
- PR: https://github.com/fooping-tech/TypeFab/pull/6（ブランチ `smart-connect`、コミット `7d528e2`）。マージ後の `main` push で Pages デプロイが走る。Actions と公開 URL の確認はマージ後に別途行う。

## 注文ページのしおり出来栄えプレビュー — Issue #7（2026-09-15）

### 要求
- 出典: https://github.com/fooping-tech/TypeFab/issues/7 （本文を取得して確認。コメントなし）。加工注文ページに、黒いクラフトペーパーで作るしおりの完成イメージを「単体／本に挟む／サイズ比較」の3表示で確認できるプレビューを追加する。
- 文庫本は固定値 105 × 148 mm、上部から見える長さは固定値 20 mm。本としおりは実寸比率で描く。しおりの実寸・文庫本のサイズ・上部表示量を表示する。
- しおり用途として不自然なサイズ（幅 50 mm 超、長さ 90 mm 未満、160 mm 超）は注文を止めない注意として表示し、閾値は定数化する。
- 実寸が確定していないSVGではモックアップを出さず、既存の実寸確認フローを優先する。既存のSVG検査・サニタイズ・料金計算・Checkoutは変更しない。Three.js等は導入しない。
- 完了条件: Issueの「完了条件」一覧（表示切替、黒クラフト表現、文庫本モックアップ、実寸比率、挟んだ状態、実寸表示、上部表示長、サイズ警告、実寸未確定時の非表示、既存検査・料金・Checkoutの維持、Desktop/iPad/iPhone確認、build・既存テスト成功、console errorなし）。README更新、GitHub Pagesへの反映と確認。

### 実装結果（2026-09-15）
- 新規 `src/bookmark-preview.js`（純粋関数、Node でテスト可能）: 定数 `BOOK_WIDTH_MM=105` / `BOOK_HEIGHT_MM=148` / `VISIBLE_TOP_MM=20` / `BOOKMARK_THRESHOLDS`（幅50超・長さ90未満・160超）/ `COMPARISON_REFERENCES`。`bookmarkPiece(svg)` は既存の `parseSVG` / `documentSize` / `svgShapes` / `pathContours` で切断線を mm で取り出し、`closeCutLoops` で開いた線（ブリッジで途切れた線）を閉じる（隙間 6 mm 以内は輪郭に沿って閉じ、ブリッジの側面が短い場合はそちらをたどって接続部を材料として残す）。すべての切断線を囲む閉じた外形があればそれを紙片（外形の周りは余白）、なければ SVG 全体を1枚の紙として扱う。実寸未確定・図形なし・読めない SVG は null。`renderSingle` / `renderInBook` / `renderComparison` は mm 単位の viewBox を持つ SVG 文字列（偶奇規則の塗り、feTurbulence の紙繊維、feDropShadow、カット縁の細線、寸法線、本は表紙・背・上端のページ、隠れる部分は破線のゴースト）。横長は既定で 90° 回転（`bookmarkOrientation`）。
- `order/index.html` / `src/order.js` / `src/order.css`: SVG カードの下に「完成イメージ（黒クラフトペーパーのしおり）」を追加。`role="tablist"` / `role="tab"`（`aria-selected`、矢印・Home/End キー、44 px 以上のタップ領域）と `role="tabpanel"`。既定は「本に挟む」。情報欄に文庫本・しおり（外形／用紙）・SVG実寸（異なる場合）・上部表示・下部はみ出し・文庫本との比を表示。サイズ警告は ⚠ 付きの注意（注文は止めない）。実寸未確定の SVG は既存の実寸確認フローを案内しタブを無効化、スクリプト等を含む SVG・図形なしは非表示。既存の 2D プレビュー・検査・サニタイズ・料金計算・Checkout は変更なし。
- `README.md` に「完成イメージ（文庫本しおりのプレビュー）」節を追加。
- テスト: 新規 `tests/bookmark-preview.test.js` 13件（定数、Issue の4サイズの警告、レイアウト（上部20・挿入・はみ出し12・短い紙片）、向き、保持タブの隙間閉じ、リング＋ブリッジの接続、外形／用紙の判定、実寸未確定・図形なし・不正テキストで null、開いた線のみ、Shippori Mincho の実フォント＋自動ブリッジの TypeFab 出力、3描画の viewBox・evenodd・ラベル・NaN なし、180 mm のはみ出し・横長の回転、比較対象の追加）。`npm test`: 175 passed（既存162＋13）。`npm run build` 成功。
- 実ブラウザ（Chromium、production preview、Playwright 35項目）: エディタ受け渡し SVG で表示、既定タブ、105×148 の本、情報欄、SVG実寸の別表示、2D プレビューと料金の維持、タブ切替と `aria-labelledby`、単体の質感フィルタと evenodd、サイズ比較の画面上の幅比 = 38/105（0.3619）、矢印・Home キー、60×180（幅広＋はみ出し警告、下部はみ出し 12 mm、注文検査は不変）、20×80（短い警告のみ）、50×148（警告なし）、横長 118×36（回転トグル既定 ON、OFF で警告2件）、px SVG（案内表示・タブ無効・描画なし → 38 mm 適用で 38×120 を表示）、script 入り SVG（拒否・非表示）、文字のみ（非表示）、iPad 820px / iPhone 390px（横スクロールなし、タブ高さ 40/44 px、シーン幅）、console error なし。WebKit でも描画・console error なし。スクリーンショットで Desktop / iPad / iPhone の見た目を確認。
- 既知事項: TypeFab の自動ブリッジ（ステンシル）の「A」頂点付近に細い切れ端が出るのは既存の書き出し形状で、プレビューはそれを忠実に描く。太い画（ブリッジ幅の約4倍超）の隙間式ブリッジでは接続部を描かず穴を閉じた形になる場合がある。文庫本サイズ・上部表示量は固定で、本の厚さは考慮しない。実物の紙色・表面・加工結果は未検証。
- 公開: コミット `ab9c814` を `main` へ push。Actions https://github.com/fooping-tech/TypeFab/actions/runs/34973188598 は success。`https://fooping-tech.github.io/TypeFab/` と `/order/` が HTTP 200 を返し、公開ページに完成イメージのタブが含まれることを確認（2026-09-15）。

## 紹介ページを最新仕様に更新（2026-09-15）

### 要求
- 紹介ページ（`index.html`、`src/landing.js`、`src/landing.css`、`public/landing/`）を、Issue #3〜#7 で追加された機能（同梱フォント8書体・遅延読み込み・フォント一覧、2D CAD、スマート接続、注文ページのしおり完成イメージ）に合わせて更新する。画面写真は実際の製品出力のみを使う。加工注文は加工サービス未提供のため Coming Soon のまま。
- 完了条件: 既存テスト・新規テスト・ビルド成功、Desktop / iPad / iPhone の実ブラウザで画像の読み込み・タブ・横スクロールなし・console error なしを確認、GitHub Pages に反映して確認。

### 実装結果（2026-09-15）
- `index.html`: ヒーローの説明文に「日本語フォント8書体・スマート接続・2D CAD」を追加し、画面写真を現在のUI（2段目の2D CADツールバー、フォントプレビュー付きのプロパティ）で撮り直し。機能タブを Text / Japanese Fonts / Layout / Vector Editing / Bridge / **Smart Connect** / **2D CAD** / Shapes / SVG Export の9つに拡張（Japanese Fonts はフォント一覧ダイアログの写真と8書体の列挙・OFL 1.1、Smart Connect はプレビュー画面、2D CAD は円形パターンのプレビュー、Shapes は2段のツールバーとSVG読み込み対応要素）。ワークフロー 03 を「BRIDGE / CONNECT」、06 の説明を「完成イメージのプレビュー付きで実装済み、決済は提供開始まで不可」に変更（Coming Soon 表示は維持）。ブリッジ節に「ステンシルではなく、文字を切り出すなら」（スマート接続との使い分け・候補・スタイル・確定前調整・結果）を追加。ベクター編集一覧に 2D CAD、想定利用者の表に「本が好きな人 / 文庫本のしおり / 黒クラフトペーパー、革」を追加。「FROM BROWSER TO PHYSICAL OBJECT」節に注文ページの完成イメージ（本に挟む）の写真と説明を追加。フッターの書体表記を8書体に更新。`src/landing.css` に `.connect` を追加。
- 画面写真（`public/landing/`）: `hero.webp`（2880×1800）、`toolbar.webp`（2880×294、2段）、`fonts.webp`（フォント一覧ダイアログ）、`smart-connect.webp`（最大距離 20 mm、部品 11 → 1）、`cad.webp`（六角形の円形パターン 6 個のプレビュー）、`bookmark.webp`（注文ページの完成イメージ）、`og.png`（1440×756 のヒーローを 1200×630 に縮小）を本番ビルドの `vite preview` を Playwright で操作して撮影（cwebp q84）。`inspector.webp` は削除。`bridge-*.webp`・`warp.webp`・`path.webp`・`preview.webp` はキャンバスの拡大で現状と変わらないため据え置き。
- テスト: `tests/landing.test.js` に「8書体・Smart Connect・2D CAD・完成イメージ・新しい画像参照・削除した画像を参照しない」の1件を追加。`npm test`: 176 passed。`npm run build` 成功。
- 実ブラウザ（本番ビルドの preview、Chromium 1440×900 / 1024×1366 / 390×844、WebKit 390×844、68項目）: タイトル、横スクロールなし、9タブすべて表示と画像読み込み、全16画像の読み込み、しおり・スマート接続の図、Coming Soon 表示の維持、エディタCTA、console error / warning なし、失敗リクエストなし — すべて通過。Desktop / iPhone のスクリーンショットで新節の見た目を確認。
- 気づき: エディタを Playwright で操作中（スマート接続の最大距離入力→change 送出、または CAD ツールのクリック）に1回 `NotFoundError: Failed to set the 'innerHTML' property ... moved in a 'blur' event handler` の page error が出た。紹介ページとは無関係のエディタ側の事象で、手動操作での再現は未確認。今回は対応していない。
- 公開: コミット `f2179f0` を `main` へ push。Actions https://github.com/fooping-tech/TypeFab/actions/runs/34977662161 は success。`https://fooping-tech.github.io/TypeFab/`、`landing/smart-connect.webp`、`landing/bookmark.webp`、`landing/og.png` が HTTP 200。公開サイトに対して同じ68項目のブラウザ検査（Chromium Desktop / iPad / iPhone、WebKit iPhone）を実行し、すべて通過（2026-09-15）。

## 個人情報保護・注文通知メール・領収書 — Issue #8 / #9 / #10（2026-09-16）

### 要求
- 出典: https://github.com/fooping-tech/TypeFab/issues/8 、/issues/9 、/issues/10 （本文を取得して確認。コメントなし）。
- #8 個人情報保護: 公開フロントは GitHub Pages のまま。注文フォームの個人情報を `localStorage` に残さない。D1 の配送用個人情報と R2 の SVG に保持期限（初期案 COMPLETED から 90 日）を設け、Cron Trigger で自動削除する。`/api/admin/*` を Cloudflare Access で保護し、管理画面自体も Access 配下（Worker から配信）に置く。GitHub Pages → Worker の CORS を許可 origin 限定にし、公開 API と管理 API でポリシーを分ける。管理 API の一覧／詳細を分け、返却する個人情報を最小化し、COMPLETED 後は表示しない。Privacy Policy ページを公開し注文確認画面からリンクする。README にデータフローと運用方針を書く。カード情報を持たない Stripe Checkout 構成は維持。
- #9 注文通知メール: Stripe Webhook で初めて `PAID` になった時点で、購入者へ注文受付メール（注文番号・注文内容・金額・発送予定・注文状況 URL・問い合わせ先。住所は載せない）と管理者へ新規注文通知（注文番号・購入者名・金額・内容・特急表示・発送期限・管理画面リンク。住所・電話は載せない）を各 1 通送る。Webhook 再送で重複送信しない。送信失敗でも `PAID` は確定し、失敗を記録して再送できる。API キーは Secret。採用サービスと設定方法を README に書く。
- #10 領収書: Stripe の領収書メールを有効化する手順を README に書き、Checkout に `receipt_email` を渡す。決済後、PaymentIntent の最新 Charge から `receipt_url` を取得して D1 に保存し、購入者 API から領収書 URL だけを返す。注文状況ページに `PAID` 以降のみ「領収書を表示」を出す（未決済・CANCELLED は非表示）。適格請求書は別要件として README に明記する。
- 完了条件: 3 つの Issue の「完了条件」。`npm test` / `npm run build` / 管理画面ビルドの成功、実ブラウザ（ローカル Worker + モック Stripe/メール）での注文→決済→通知→領収書→管理画面の確認、README・CLAUDE.md の更新、GitHub Pages への反映と確認。Cloudflare Access・Resend・Stripe ダッシュボードの設定は利用者のアカウントが必要なため、手順を README に書き、本番での動作は未検証として記録する。

### 設計判断（実装前）
- 管理画面は GitHub Pages から外し、Worker の Static Assets（`worker/admin-dist`、`npm run build:admin` で生成）として同一オリジンで配信する。Access は Worker の「Protect this Worker behind Access」ではなく、`/admin*` と `/api/admin*` を対象にした Self-hosted application で掛ける（公開 API を塞がないため）。Worker は `Cf-Access-Jwt-Assertion` を JWKS で検証し、`ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` が設定されていれば Access 認証に一本化する（`ADMIN_TOKEN` はローカル開発などの未設定時のみ）。
- 個人情報の保持: COMPLETED または CANCELLED になってから `PERSONAL_DATA_RETENTION_DAYS`（既定 90）日後に、氏名・メール・住所・電話を NULL にし、R2 の SVG を削除して `personal_data_deleted_at` を記録する。注文 ID・金額・日付・Stripe の ID・加工内容・状態は残す。毎日 03:00 JST の Cron Trigger と管理 API の手動実行で行う。
- メール送信は Resend（HTTPS JSON API、Secret 化、独自ドメインで SPF/DKIM/DMARC、UTF-8、無料枠）。`order_notifications` テーブルで注文×種別ごとに送信済み／エラーを記録し、再送は管理 API から。
- 領収書 URL は Webhook 直後に取得して D1 にキャッシュし、取得できなかった場合は購入者 API 参照時に再取得する。

### 実装結果（2026-09-16）
- **#8 個人情報保護**
  - `src/order.js`: 配送先フォームの個人情報はブラウザに保存しない（`localStorage` の `typefab-order-draft` / `typefab-order-last` を廃止し、読み込み時に旧キーを削除）。材料・厚さ・数量・納期だけを `sessionStorage`（`typefab-order-options`）に保持し、注文作成成功時にエディタ受け渡しの SVG と一緒に削除。注文状況ページは表示後にアドレスバーからトークンを除去し、配送先・メールを表示しない旨と問い合わせ窓口・プライバシーポリシーのリンクを表示。
  - `worker/`: 公開 API と管理 API で CORS の origin リストを分離（`ALLOWED_ORIGINS` / `ADMIN_ALLOWED_ORIGINS`、本番の管理側は空、`*` なし、許可外 origin には CORS ヘッダーを一切付けない）。`GET /api/admin/orders` は一覧用ビュー（個人情報なし）、`GET /api/admin/orders/:id` は詳細ビュー（PAID・PROCESSING・READY・SHIPPED のときだけ配送先、COMPLETED / CANCELLED / 削除済みでは氏名も返さない）。状態変更の履歴に Access のメールアドレスを残す。Worker のログは注文番号と理由のみ。
  - Cloudflare Access: 新規 `worker/src/access.js` が `Cf-Access-Jwt-Assertion` を `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` の JWKS（1 時間キャッシュ、未知の kid で 1 回再取得）で RS256 検証し、`aud`・`iss`・`exp`・`nbf` を確認。`ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` を設定すると Access 認証に一本化（`ADMIN_TOKEN` は未設定時＝ローカルのみ）。管理画面は GitHub Pages から外し、`vite.admin.config.js` で `worker/admin-dist` に別ビルドして Worker の Static Assets（`[assets]`）として `/admin/` で配信（`/` は `/admin/` へリダイレクト）。`src/admin.js` は `/api/health` で認証方式を判定し、Access 時はログイン画面の案内、トークン時は入力欄を表示。
  - 保持期限: `orders` に `personal_data_deleted_at`、`store.listPurgeCandidates()`、`app.purgeExpiredData()`（COMPLETED / CANCELLED から `PERSONAL_DATA_RETENTION_DAYS`＝90 日後に氏名・メール・住所・電話を NULL、R2 の SVG を削除、履歴に記録。dry run 対応）。`wrangler.toml` の Cron Trigger（毎日 18:00 UTC＝03:00 JST）で `scheduled()` が実行、管理画面と `POST /api/admin/maintenance/purge` から手動実行。削除後は SVG 取得 410、再送 410、一覧に「個人情報削除済み」バッジ。
  - `privacy/index.html`（取得情報・利用目的・Stripe / Cloudflare / Resend / GitHub / 配送会社への提供・データフロー・保持期間と削除・安全管理・問い合わせ窓口と削除依頼・変更）を Vite の入口に追加。注文フォーム・確認画面・注文状況ページ・紹介ページのフッターからリンク。README にデータフロー、CORS、Access の設定手順（Self-hosted application で `/admin` と `/api/admin`、メール限定、MFA、AUD）、保持期間、本番とローカルの違いを記載。CLAUDE.md の構成と前提を更新。
  - `worker/schema.sql` を更新し、既存 DB 向けに `worker/migrations/0002_privacy_mail_receipt.sql`（`customer_email` の NOT NULL を外すためテーブル再作成、列追加、`order_notifications`）を追加。ローカルの旧スキーマ D1 に適用して動作を確認。
- **#9 通知メール**: 新規 `worker/src/mail.js`（Resend の `POST /emails`、15 秒タイムアウト、購入者／管理者の本文テンプレート。住所・電話番号を含めず、管理者メールにはメールアドレスも含めない。特急は件名先頭「【特急】」と本文の強調）。Webhook で初めて `PAID` になったときだけ、`PAID` を D1 に確定 → 領収書取得 → 通知送信の順に処理し、通知の失敗は `order_notifications`（注文 ID × 種別、`sent_at` / `provider_id` / `error` / `attempts`）に記録して Webhook は 200 を返す。`MAIL_API_KEY` / `MAIL_FROM` 未設定は「mail not configured」として記録。`POST /api/admin/orders/:id/notify` と管理画面の詳細から未送信分だけ再送。Checkout には `payment_intent_data[receipt_email]` も渡す。設定は `MAIL_API_KEY`（Secret）、`MAIL_FROM`、`MAIL_REPLY_TO`、`ADMIN_NOTIFICATION_EMAIL`、`ADMIN_URL`、`MAIL_API_BASE`（モック用）。
- **#10 領収書**: `worker/src/stripe.js` に `stripeGet()` / `fetchReceipt()`（PaymentIntent を `expand[]=latest_charge` で取得）。`PAID` 確定時に `stripe_charge_id` / `receipt_url` を D1 にキャッシュし、取得失敗時は購入者 API 参照時に再取得。`customerView` は PAID・PROCESSING・READY・SHIPPED・COMPLETED のときだけ `receiptUrl` を返し、Stripe の ID は返さない。注文状況ページに「領収書を表示（Stripe）」（決済直後は最大 3 回ポーリング）、管理画面の詳細にもリンク。注文確認画面に領収書メール・注文状況ページ・適格請求書非対応の案内。README に Stripe ダッシュボードの Successful payments 有効化、返金の扱い（CANCELLED で非表示、返金状態は未実装）、適格請求書は別要件であることを記載。
- テスト: `tests/worker.test.js` を更新・追加（CORS の分離、一覧／詳細の個人情報、COMPLETED 後の非表示、通知 2 通・重複なし・期限切れ／失敗／未決済で送らない・特急件名・失敗時も PAID・再送・未設定スキップ・ログに個人情報なし、テンプレートの住所除外、領収書の取得・キャッシュ・遅延取得・CANCELLED で非表示・Stripe 失敗時のログ、Access の JWT 検証（正常・Bearer 無視・未知鍵・aud・iss・期限切れ・改ざん・JWKS キャッシュ・鍵ローテーション）、保持期限の削除（89 日で対象なし、dry run、実行、会計情報の残存、未完了注文の保持、410、設定可能な日数）、env 設定）。`tests/landing.test.js` に Vite 設定（admin を Pages から除外、`vite.admin.config.js`）、プライバシーページ・注文ページの文言・リンクのテストを追加。`npm test`: 184 passed（既存 176 → 更新後 184）。`npm run build`（`dist/privacy/` を含む）と `npm run build:admin`（`worker/admin-dist`）成功。
- 実ブラウザ（Chromium、`vite preview` 4173 ＋ `wrangler dev` 8787 ＋ モック Stripe／Resend 4242、Playwright 42 項目）: プライバシーページの表示と横スクロールなし、旧 `localStorage` ドラフトの削除、フォーム・確認画面のプライバシーリンクと領収書・適格請求書の案内、決済前後の `localStorage` / `sessionStorage` に個人情報なし（選択肢のみ `sessionStorage`）、決済後にトークンが URL から消える、注文状況ページに PAID・受付メールの案内・領収書ボタン・個人情報なし、モックへ届いたメール 2 通の宛先・件名・本文（購入者に住所なし、管理者に住所・電話・メールなし、管理画面 URL あり、API キーは Bearer）、Checkout への `receipt_email`、購入者 API の内容と誤トークンの 404、Worker 配信の管理画面（トークン誤り→拒否、一覧に住所なし、詳細で配送先・通知送信済み・領収書リンク、PROCESSING→READY→SHIPPED→COMPLETED、COMPLETED 後の詳細で個人情報なし、削除の dry run 0 件）、管理 API に GitHub Pages origin の CORS 許可なし、開発 origin の preflight 許可、公開 API が未知 origin を拒否、キャンセル決済で領収書なし・メールなし、iPad / iPhone 幅で横スクロールなし、console error なし — すべて通過。実 D1（SQLite）で `updated_at` を 100 日前にした COMPLETED 注文を `purge` し、氏名・メール・住所が NULL、SVG が 410、`order_notifications` の UPSERT が 2 回目で `attempts=2` になることを確認。
- 未検証・利用者側の作業: Cloudflare Access の実アプリケーション（メール限定・MFA・AUD）、Resend のドメイン認証（SPF / DKIM / DMARC）と実メール到達、Stripe 本番の領収書メール、Cron Trigger の本番実行は利用者のアカウントが必要で未実施（手順は README）。実 Stripe / 実 Resend に対する送信は行っていない。状態変更の通知メール、返金状態の同期、適格請求書は未実装（Issue の将来拡張のとおり）。
- 公開: コミット `e8c9f5c` を `main` へ push。Actions https://github.com/fooping-tech/TypeFab/actions/runs/35040618090 は success。`https://fooping-tech.github.io/TypeFab/`、`/privacy/`、`/order/` が HTTP 200、`/admin/` は意図どおり 404（管理画面は Worker 配信へ移行）。公開ページのプライバシーポリシー（最終更新 2026-09-16）と注文ページ・紹介ページからのリンクを確認（2026-09-16）。

## 自動ブリッジの幅・高さを適用前に設定（2026-09-16）

### 要求
- 「選択にブリッジ」「選択アイテムに自動ブリッジ」（右クリック・コマンドも含む）を押したとき、適用前にブリッジの幅と高さを mm で設定できるようにする。既定値は従来と同じ 1.5 mm で、前回の値を記憶する。
- 幅＝カット線が途切れる長さ（切り残しの太さ）、高さ＝カット線に直交する方向の帯の広がり（切り抜きブリッジでは輪郭の外へのはみ出し量、保持ブリッジでは帯の奥行き）と定義し、切り抜き（stencil）と保持（holding）の両方式に同じ意味で適用する。
- 完了条件: `automaticBridges()` が幅・高さを受け取り既定では従来と同じ形状を返す、ダイアログの入力検証、テスト追加、README 更新、実ブラウザ確認、GitHub Pages への反映。

### 実装結果（2026-09-16）
- `src/geometry.js`: `automaticBridges(items, size, targetIds)` の `size` を数値（従来互換、幅＝高さ）または `{ width, height }` で受け取る `bridgeSize()`（0.2〜50 mm にクランプ、不正値は既定 1.5）と `AUTO_BRIDGE_DEFAULTS` / `AUTO_BRIDGE_LIMITS` を追加。切り抜きブリッジは帯の太さ `h = width`、長さ `w = 穴と外側の距離 + height`（既定では従来と同一形状）。保持ブリッジは最も長い辺に沿って回転し `w = width`（カット線の途切れ）、`h = height`（線に直交する奥行き）にした（従来は回転 0 の正方形）。
- `src/main.js`: 「選択にブリッジ」「選択アイテムに自動ブリッジ」「自動ブリッジ」コマンド／右クリックはすべて `<dialog id="auto-bridge-dialog">`（幅・高さの数値入力、説明、対象件数、既定値に戻す、ブリッジを追加）を開き、送信時に検証してから適用。値は `localStorage` の `typefab-auto-bridge` に記憶。ダイアログ表示中はエディタのキーボードショートカットを無効化。通知メッセージにサイズを表示。`src/style.css` にダイアログのスタイル。
- README「アイテムごとの自動ブリッジ」と手順 5 を更新。
- テスト: `tests/geometry.test.js` に `bridgeSize` の正規化と、リング形状での切り抜きブリッジ（`h = width`、`w = 距離 + height`、既定が従来と一致）・保持ブリッジ（幅 × 高さ、最長辺に沿う回転、カット線の途切れ長＝幅、回転した矩形への追従）の 2 件を追加。`npm test`: 186 passed。`npm run build` 成功。
- 実ブラウザ（Chromium、production preview、Playwright 17 項目）: ダイアログの既定値 1.5 × 1.5、対象件数、送信前はブリッジ未追加、範囲外の値は送信されない、Esc でキャンセル、2.5 × 4 で文字に 6 個の切り抜きブリッジ（`h = 2.5`、対象付き）、通知メッセージ、値の記憶と再表示、既定値に戻す、ダイアログ内で Delete を押しても選択は消えない、Undo で一括削除、新規長方形に 3 × 1 の保持ブリッジ、console error なし — すべて通過。
- 未検証: 実機加工での帯の強度（幅・高さは形状の指定であり強度の保証ではない）。
- 公開: コミット `4f0adb0` を `main` へ push。Actions https://github.com/fooping-tech/TypeFab/actions/runs/35044419605 は success。`https://fooping-tech.github.io/TypeFab/app/` が HTTP 200 で、配信中のエディタのバンドルに `auto-bridge-dialog` が含まれることを確認（2026-09-16）。

## ローカル開発環境の整備と dev/prod 設定分離 — Issue #11（2026-09-17）

### 要求
- `npm run dev` だけで Frontend + Worker（ローカル D1・R2）を起動できる。開発時に本番の D1・R2 に接続・書き込みしない。
- `worker/.dev.vars.example` を整備し、実際の `.dev.vars`・`.env` 系は git 管理外にする。本番 Secret をローカル設定に書かなくてよい。
- Stripe はローカルでは Test Mode のみ。`sk_live_` が設定されたら警告または起動拒否。Webhook は Stripe CLI で転送できる。
- 管理画面はローカルでは `ADMIN_TOKEN`、本番では Cloudflare Access のみ（本番で `ADMIN_TOKEN` を使わない）。
- 開発時に Resend の実メールを送らない `MAIL_MODE=console`。
- `/api/health` がローカルで正常応答する。dev / production のセットアップ手順を README に分けて記載する。

### 実装
- `worker/src/index.js`: `APP_ENV`（既定 `production`）と `MAIL_MODE`（既定 `resend`）を設定に追加。`validateConfig` が development で `sk_live_`/`rk_live_`、production で `MAIL_MODE=console`・`STRIPE_API_BASE`・`MAIL_API_BASE` を設定エラーとし、エラー時は全 API が 500（`details` 付き）、Cron の削除も実行しない。`configWarnings` が本番の `ADMIN_TOKEN` 残存・Access 未設定・テストキーらしくない鍵・ローカルでない `SITE_URL` を警告ログに出す。
- `worker/src/app.js`: `adminAuth` を `access` / `token` / `none` に分け、`token` は development のみ。production で Access 未設定なら `/api/admin/*` は 503（`authMode: "none"`）。`MAIL_MODE=console` は決済完了メールを Resend に送らず `[mail:console] <種別> for order <番号>` として本文ごとログ出力し、`providerId = console:<時刻>` で送信済みとして記録（冪等性は本番と同じ）。`/api/health` に `env`・`mailMode`・`adminAuth` を追加。`src/admin.js` は `adminAuth: "none"` のとき Access 未設定の案内を表示。
- `worker/wrangler.toml`: `[vars]` に `APP_ENV = "production"`、`MAIL_MODE = "resend"` を追加し、本番値と `.dev.vars` の関係をコメント化。`worker/.dev.vars.example` を development 用に書き直し（`APP_ENV=development`、`ADMIN_TOKEN=local-development`、`SITE_URL=http://127.0.0.1:5173/TypeFab/`、`ALLOWED_ORIGINS`/`ADMIN_ALLOWED_ORIGINS` にローカルの origin、`MAIL_MODE=console`）。
- `worker/package.json`: `dev` を `wrangler dev --port 8787 --var APP_ENV:development` にし、`.dev.vars` に `APP_ENV` が無くても development で動く（`--var` は `.dev.vars` より優先することを確認）。`db:migrate:local` / `db:migrate:remote` を追加。
- ルート `package.json`: `dev` = `node scripts/dev.mjs`（Vite + Worker を `[web]`/`[worker]` プレフィックス付きで並行起動、どちらかが終了すれば両方停止）、`dev:web`、`dev:worker`、`db:local`、`db:remote`。`scripts/dev.mjs` は `worker/node_modules` か `.dev.vars` が無ければ Worker を起動せず案内を出して Vite だけ起動、`.dev.vars` の `STRIPE_SECRET_KEY` が `sk_live_` なら起動を拒否する。追加依存なし。
- `.env.development`（コミット対象、秘密なし）: `VITE_ORDER_API_URL=http://127.0.0.1:8787`。`vite` 開発サーバーだけが読み、`vite build` には影響しない。`.gitignore` を `.env`・`.env.*`（`.env.example`・`.env.development` を除く）・`worker/.dev.vars`・`worker/.dev.vars.*`（`.example` を除く）に整理。
- `vite.config.js`: `worker/admin-dist`・`worker/.wrangler`・`worker/node_modules` を監視対象から除外（Worker のビルドや D1 書き込みでページが再読み込みされないように）。
- README: 「開発」節と、「開発環境と本番環境（Issue #11）」「ローカル開発（development）」「本番環境（production）: Cloudflare Workers のセットアップ」に分割。CLAUDE.md の開発コマンドと前提を更新。
- テスト追加（`tests/worker.test.js`）: `validateConfig`/`configWarnings`、Worker エントリの 500 応答と Cron スキップ、development/production での `ADMIN_TOKEN` の扱いと 503、`MAIL_MODE=console` の出力・記録・冪等性・production での無効化。

### 検証結果
- `npm test`: 189 件すべて成功（追加 3 件を含む）。`npm run build`: 成功。
- ルートで `npm run dev` を実行し、Vite（127.0.0.1:5173）と Worker（127.0.0.1:8787）が同時に起動。`wrangler dev` のバインディング表示は `env.DB` D1 local、`env.SVG_BUCKET` R2 local、`env.ASSETS` local。`/api/health` は `{"ok":true,"env":"development","stripeConfigured":true,"mailConfigured":true,"mailMode":"resend","accessConfigured":false,"adminAuth":"token"}`。
- ローカル Worker とモック Stripe/Resend（scratchpad の簡易サーバー、`STRIPE_API_BASE`/`MAIL_API_BASE`）で注文作成（201・CORS は Vite の origin）→ Checkout → 署名付き Webhook → `PAID`・領収書 URL → モックに購入者・管理者メール 2 通。`ADMIN_TOKEN` で管理 API（一覧・セッション・詳細の配送先・通知状況）と SVG ダウンロードがローカル R2 から返り、データは `worker/.wrangler/state/v3/{d1,r2}` に保存。Cloudflare 上の D1/R2 は使っていない。
- `wrangler dev --var MAIL_MODE:console` で注文を決済し、Resend モックには送信されず、Worker ログに `[mail:console] customer_paid for order TF-…` / `admin_paid` の本文（件名・宛先・注文番号・金額）が出力され、通知は送信済みとして記録された。
- `wrangler dev --var STRIPE_SECRET_KEY:sk_live_dummy` では `/api/health`・`/api/orders` が 500 `{"error":"Worker の設定に誤りがあります。","details":["STRIPE_SECRET_KEY is a live key …"]}` を返し、ログに `typefab config error` が出た（`--var` が `.dev.vars` より優先されることも同時に確認）。
- 未検証: 実際の Stripe Test Mode の鍵での Checkout と Stripe CLI（`stripe listen`）による Webhook 受信（CLI 未インストール・利用者の鍵は使っていない）。本番 Worker への `APP_ENV=production` デプロイと、Access 未設定時の 503 の実機表示（デプロイは利用者が行う）。`scripts/dev.mjs` の `.dev.vars` 欠如・`sk_live_` 拒否の分岐は利用者の `.dev.vars` を変更せずに済ませたため、コードの確認のみ。
- 注意: 本番の `wrangler.toml` に `APP_ENV = "production"` を入れたため、次回デプロイ以降は Cloudflare Access（`ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`）が未設定だと管理画面が使えない（`ADMIN_TOKEN` は無視）。Access を設定してからデプロイする。
- 公開: コミット `bb74ac6` を `main` へ push。GitHub Pages ワークフロー https://github.com/fooping-tech/TypeFab/actions/runs/35135353857 は success（`npm test` 189 件・build・デプロイ）。https://fooping-tech.github.io/TypeFab/ と `/app/` は HTTP 200。Worker 側（`wrangler.toml` の `APP_ENV`、`MAIL_MODE`）は利用者の `cd worker && npm run deploy` で反映される。

## 注文の最大サイズを A4−マージン10 mm に、材料を黒クラフトペーパーのみに（2026-09-17）

### 要求
- 発注できる SVG の最大サイズを A4（210 × 297 mm）から周囲 10 mm のマージンを除いた範囲（277 × 190 mm、縦横どちらでも可）にする。
- 材料は黒クラフトペーパーのみにする。

### 実装
- `src/pricing.js`: `CATALOG.sheet = { name: "A4", widthMm: 210, heightMm: 297, marginMm: 10 }` を追加し、`limits.maxWidthMm = 277`、`maxHeightMm = 190`、`limits.sizeNote`（エラー文に付ける説明）を設定。`materials` を `kraft-black`（黒クラフトペーパー、厚さ 0.3 mm、料金係数は仮）1 件だけにし、MDF・アクリル・「その他（要相談）」を削除。複数材料・厚さ・`inquiryOnly` の仕組みはコードに残した。`publicCatalog` に `sheet` を追加。サイズ超過のエラー文は「最大 277 × 190 mm、A4 用紙（210 × 297 mm）から周囲 10 mm のマージンを除いた範囲」。
- `src/svganalyze.js`: 既定の limits も 277 × 190 に合わせ、同じ説明文を付ける（Worker 側の検査は `CATALOG.limits` を渡すので同じ値）。
- `src/order.js`: 初期値を `kraft-black` / 0.3 mm に。以前の下書き（`sessionStorage`）にカタログにない材料が残っていればカタログ先頭に置き換える。`order/index.html` のドロップ領域に材料と最大サイズの案内を追加。`index.html`（紹介ページ）の ORDER 節の説明を更新。
- README「使い方（注文する側）」を更新（最大サイズ、材料）。
- テスト: `tests/pricing.test.js` に A4−マージンの境界テスト（277 × 190・190 × 277 は可、277.1 × 190・200 × 200・210 × 297・300 × 100 は不可）と材料 1 件の検証を追加。`tests/worker.test.js` の材料指定と通知メール本文の期待値を更新。

### 検証結果
- `npm test`: 190 件すべて成功。`npm run build`: 成功。
- `vite preview` + Chromium（Playwright）で注文ページを確認: 材料セレクトは「黒クラフトペーパー」のみ、厚さは 0.3 mm のみ、案内文が表示される。277 × 190 mm と 190 × 277 mm の SVG は検査を通り概算が出る（宅配便）。280 × 190 mm と 210 × 297 mm は「サイズが大きすぎます（… 最大 277 × 190 mm、A4 用紙（210 × 297 mm）から周囲 10 mm のマージンを除いた範囲）」で注文不可。console error なし。
- 未変更・未検証: 送料区分（コンパクト便 200 × 150 mm・3 個まで）は変えていないため、A4 近くの紙は宅配便扱いになる。料金係数（材料費 0.3 円/cm²、加工費 0.1 円/mm、下限 100 円）は仮の値。既存注文の `material` 列に残る `mdf` などは表示上 ID のまま出る。
- 公開: コミット `60c5dc1` を `main` へ push。GitHub Pages ワークフロー https://github.com/fooping-tech/TypeFab/actions/runs/35141804008 は success。https://fooping-tech.github.io/TypeFab/order/ は HTTP 200 で新しい案内文（最大サイズ 277 × 190 mm）を含む。Worker 側の料金再計算は同じ `src/pricing.js` を使うため、利用者が `cd worker && npm run deploy` した時点で本番 API にも反映される。

## 上限サイズを A4 から封筒サイズ（長形3号）へ変更（2026-09-17）

### 要求
- 発注できる SVG の上限サイズを A4 ではなく封筒サイズにする。

### 判断
- 「封筒サイズ」の規格は指定がなかったため、日本で最も一般的で定形郵便の最大サイズでもある**長形3号（120 × 235 mm）**を採用した。周囲 10 mm のマージンは前回の要求どおり差し引き、上限は **215 × 100 mm**（縦横どちらの向きでも可）。別の封筒（角形2号 240 × 332 mm、洋形2号 114 × 162 mm など）にする場合は `src/pricing.js` の `CATALOG.sheet` と `limits`（`maxWidthMm`/`maxHeightMm`/`sizeNote`）、`src/svganalyze.js` の既定値、`order/index.html`・`index.html`・README の文言を変える。

### 実装
- `src/pricing.js`: `CATALOG.sheet = { name: "長形3号封筒", widthMm: 120, heightMm: 235, marginMm: 10 }`、`limits.maxWidthMm = 215`、`maxHeightMm = 100`、`sizeNote` を「長形3号封筒（120 × 235 mm）から周囲 10 mm のマージンを除いた範囲」に。`src/svganalyze.js` の既定値も同じ。
- 注文ページの案内文（`order/index.html`）、紹介ページ（`index.html`）、README を更新。テスト（`tests/pricing.test.js`、`tests/svganalyze.test.js`）の境界値を 215 × 100 に更新（215 × 100・100 × 215・82.3 × 142 は可、215.1 × 100・101 × 101・120 × 235・190 × 277 は不可）。
### 検証結果
- `npm test`: 190 件すべて成功。`npm run build`: 成功。
- `vite preview` + Chromium（Playwright）で注文ページを確認: 案内文が「最大サイズは 215 × 100 mm（長形3号封筒 120 × 235 mm から周囲 10 mm のマージンを除いた範囲）」になり、215 × 100・100 × 215・50 × 148 mm の SVG は検査を通り概算が出る。220 × 100 mm と 120 × 235 mm（封筒そのもの）は「サイズが大きすぎます（… 最大 215 × 100 mm、長形3号封筒（120 × 235 mm）から周囲 10 mm のマージンを除いた範囲）」で注文不可。console error なし。
- 未変更: 送料区分（コンパクト便 200 × 150 mm・3 個まで）は据え置きのため、長さ 200 mm 超のデザインは宅配便扱いになる。封筒で発送するなら送料表の見直しが必要。- 公開: コミット `92a8ac8` を `main` へ push。GitHub Pages ワークフロー https://github.com/fooping-tech/TypeFab/actions/runs/35142451731 は success。https://fooping-tech.github.io/TypeFab/order/ は HTTP 200 で新しい案内文（最大サイズ 215 × 100 mm）を含む。Worker 側は利用者の `cd worker && npm run deploy` で反映。

## README のセットアップコマンドをコピペ可能に（2026-09-17）

### 要求
- 利用者が README「ローカル開発」の初回セットアップをコピペしたところ、`cd worker && npm ci && cd .. # wrangler` が `cd: too many arguments`、`cp … # …` が `Not a directory`、`npm run db:local # …` が wrangler の `Unknown arguments` で失敗した。対話型 zsh は行中の `#` をコメントにしないため、行末コメントがコマンド引数として渡っていた。

### 実装
- README のシェル用コードブロックから行末コメントをすべて除去し、説明はブロックの外（番号付きリスト・段落）に移した。対象: 「開発」節の `npm run dev`、「ローカル開発（development）」の初回手順（`npm ci` / `npm --prefix worker ci` / `cp worker/.dev.vars.example worker/.dev.vars` / `npm run db:local`）、「本番環境（production）」の `npm ci` / `npm --prefix worker ci` / `cd worker` / `npx wrangler login`。
- CLAUDE.md に「README のコードブロックに行末コメントを書かない」を追記。

### 検証結果
- コードブロック内に ` # ` を含む行が README に残っていないことを確認（0 行）。`npm run db:local` はルートから `npm --prefix worker run db:local` を呼ぶ配線のままで、利用者のログでも wrangler 自体は起動している（余分な引数だけが原因）。

- 公開: コミット `4058200` を `main` へ push。GitHub Pages ワークフロー https://github.com/fooping-tech/TypeFab/actions/runs/35150423613 は success、https://fooping-tech.github.io/TypeFab/ は HTTP 200。
