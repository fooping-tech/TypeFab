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
