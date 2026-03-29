# Saul — History

## Project Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Tech stack:** Vanilla HTML/CSS/JS (ES modules), Vite dev server, Vitest test runner
- **User:** Vladi Lyga
- **Team:** Danny (Lead), Rusty (Frontend), Livingston (UX), Linus (Tester), Saul (Principal Frontend/Reviewer)

## Key Files

- `index.html` — HTML structure + CSS (no JS)
- `app.js` — ES module with exported pure logic functions + guarded DOM init IIFE
- `dag.js` — DAG dependency visualization (dagre layout + SVG rendering)
- `app.test.js` — 65 unit tests for app.js
- `dag.test.js` — 23 unit tests for dag.js graph derivation

## Architecture Decisions

- JS extracted from index.html for testability (ADR-002)
- DOM init guarded with `typeof document !== 'undefined'` for Node/Vitest compatibility
- DAG uses dagre for layout + native SVG rendering (no D3, no Cytoscape)
- DAG is read-only — navigation and visualization only, no graph editing
- Storage is injectable (mock-friendly for tests)

## Learnings
- Restructure review: the grouped `src/` layout is a good direction, but pure-unit coverage still let a browser-only runtime bug (`defaultStorage` in `main.js`) and an SVG accessibility regression through. Keep viewport logic out of domain modules, and never combine `aria-hidden` with keyboard-focusable descendants.
- Keyboard selection has to be reconciled against the current filtered view after shortcut-driven status changes, and modal focus return should be handled as explicit state instead of incidental browser behavior.
- Blocked-task completion has to be guarded in the UI layer, not just cleanup logic: users can reach terminal statuses from the select before upstream blockers are resolved, so surface the active blocker names in the notification and keep the select pinned to `blocked`.
