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
- Pending commit/push, Pages enablement, Actions deployment and public URL verification.
