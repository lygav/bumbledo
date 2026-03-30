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
### 2026-03-30: Full Frontend Refactor Execution (Tasks #59–#65)

**What I led:**
- Task #59 (Rusty): Shared constants module (`src/app/constants.js`)
- Task #60 (Rusty): CSS extraction (`src/styles.css`)
- Task #61 (myself): Split `main.js` into 5 feature controllers + 1 shared helper, reduced line count from 1821 → 836
- Task #62 (myself): Lightweight app store with named actions and pure selectors
- Task #63 (Rusty): Persistence via post-action effects
- Task #64 (Rusty): Event delegation in list-view.js
- Task #65 (Danny): ESLint + Prettier + GitHub Actions CI

**Key architectural decisions:**
- Keep `src/main.js` as composition root orchestrating state, controllers, and cross-feature effects
- Introduce `src/app/store.js` with named actions (20+) and `src/app/selectors.js` for derived data
- Extract feature controllers: `src/todo/list-view.js`, `src/todo/reorder.js`, `src/ui/modals.js`, `src/ui/keyboard.js`, `src/burndown/view.js`, `src/ui/status-metrics.js`
- All controllers dispatch store actions (no direct mutations)
- Persistence centralized in store post-action effects
- Event delegation at container level (no per-row listeners)

**Refactor outcome:**
- 6 PRs merged: #66 (constants), #67 (CSS), #68 (main.js split), #69 (store), #70 (delegation), #71 (persistence)
- Test coverage: 211 → 213 tests
- Code quality: ESLint + Prettier enforced in CI (Task #65, PR #72)
- All decisions logged to decisions.md (ADR-005 through ADR-010)

**Integration across agents:**
- Rusty's constants, CSS, persistence, and delegation feed into my store design
- Danny's tooling locks down code quality for all prior work
- Linus's contract tests validate Rusty's constants module
- Result: modular, testable, maintainable architecture ready for future scaling
- Line-count outcome: `src/main.js` went from 1821 lines before the split to 836 after extraction. The key architectural decision was to let modules own browser interaction lifecycles while keeping shared application state and inter-module communication in the composition root.
- Introduced a minimal `createAppStore()` in `src/app/store.js` with named actions for task CRUD, status changes, blocker toggles, reorder, filter/selection/edit state, burndown sampling, and DAG/burndown UI toggles. The store owns persistence effects for todos, burndown data, and the ready filter so controllers stop calling storage helpers directly.
- Added `src/app/selectors.js` for derived state: progress totals, visible todos, ready-empty state, blocked-completion checks, toggle-target lookup, burndown view props, and DAG section state. That lets `src/main.js` render from selector output instead of recomputing counts and filtered views inline.
- Integration approach: keep `src/main.js` as the composition root, but make controllers dispatch store actions and let a single store subscription fan state back into list, burndown, DAG, and keyboard flows. Side effects that are truly UI-only (modals, confetti, notifications, focus) now react to action metadata instead of piggybacking on direct mutations.
- Delegated `focusout` handling needs the same row-local timing semantics as the pre-delegation code. For blocked tasks, only finalize when the blur originated from a row that was already rendering `.blocker-picker`, and defer the final check to a microtask so a rerendered `todo → blocked` transition does not immediately normalize back to `todo`.
