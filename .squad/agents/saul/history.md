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

- For browser-only behaviors without JSDOM, extract the timing/state orchestration into a small controller module and keep main.js as DOM wiring. That gives reviewable tests for timer resets, message updates, and dismiss cleanup without overhauling the test environment.
- Blocked-task completion has to be guarded in the UI layer, not just cleanup logic: users can reach terminal statuses from the select before upstream blockers are resolved, so surface the active blocker names in the notification and keep the select pinned to `blocked`.
- Blocked completion feedback works better as a lightweight modal than a shared notification bar, but it still needs the same focus-return, Escape, and click-outside behaviors as the shortcuts dialog to feel consistent.
- Split `src/main.js` along controller seams, not helper seams: `src/todo/list-view.js` owns row rendering + per-row DOM events, `src/todo/reorder.js` owns drag/touch reorder state, `src/ui/modals.js` owns modal lifecycle/focus return, `src/ui/keyboard.js` owns global shortcut routing, and `src/burndown/view.js` owns chart rendering/toggle behavior. Shared status-pill rendering now lives in `src/ui/status-metrics.js` so burndown and task summary stay visually identical without duplicating DOM code.
- Keep composition authority in `src/main.js`: it remains the single place that owns canonical app state (`todos`, selection, filter, edit state, burndown samples, DAG expansion), wires controllers together through explicit callbacks, and coordinates cross-feature effects like notifications, confetti, persistence, and DAG sync. That keeps the extracted modules reusable without hidden coupling.
- Line-count outcome: `src/main.js` went from 1821 lines before the split to 836 after extraction. The key architectural decision was to let modules own browser interaction lifecycles while keeping shared application state and inter-module communication in the composition root.
