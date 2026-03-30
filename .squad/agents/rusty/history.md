# Rusty — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Frontend Dev
- **Joined:** 2026-03-29T08:36:00.627Z

## Learnings

<!-- Append learnings below -->

### 2026-03-30: Privacy Messaging + First-Run Ownership Hint

**What I changed:**
- Added a warm inline welcome hint near the empty state, using the existing discoverability-tip pattern and a one-shot `localStorage` key so it only appears for true first-run/zero-task users.
- Made the welcome hint dismissible and also auto-retired it once a user already has tasks, so returning users do not see onboarding copy after they have established local data.
- Added a subtle footer privacy note at the bottom of the app using muted typography to reinforce the product promise without turning it into a legal disclaimer.

**UI rules to preserve:**
- Privacy/ownership messaging should feel calm and confidence-building: inline, brief, token-driven, and visually quieter than task controls.
- First-run guidance belongs in the existing discoverability-tip system with centralized storage keys and persistent dismissal, not in a modal or ad-hoc banner.

### 2026-03-30: Burndown Removal + Header Metrics

**What I changed:**
- Removed the burndown panel, chart wiring, persistence, and helper code so the top-level UI no longer carries a second progress system that users were ignoring.
- Promoted the status pills into the main toolbar row and rebuilt the **Hide Blocked** control as a real switch with `role="switch"` and `aria-checked`, so the filter state reads clearly without icon-placeholder hacks.

**UI rules to preserve:**
- If summary pills are important for scanning, keep them in the same horizontal band as the primary list controls instead of burying them in a secondary panel.
- Toggle state should be communicated by the control shape itself (track + thumb or segmented state), not by an empty icon slot that only fills after interaction.

### 2026-03-30: Toolbar Controls vs Metric Pills

**What I changed:**
- Moved the burndown disclosure toggle into the main list toolbar so the two interactive controls sit together before the status pills.
- Restyled the actionable controls as squared toggle buttons with hover/focus affordance, while keeping the metric pills quiet, fully rounded, and non-interactive.
- Renamed the ready filter copy to **Hide Blocked**, added an active checkmark state, and updated the burndown toggle copy/chevron to **Show progress** / **Hide progress** based on expansion.

**UI rule to preserve:**
- If an element triggers a state change, it should never share the same pill treatment as passive metrics; controls need a visible pointer/hover state and a tighter radius so click targets are obvious at a glance.
- Disclosure controls should communicate state in both text and iconography, so expansion is readable even before users interact with the panel.

### 2026-03-30: Burndown Duplicate Badge Regression

**What I fixed:**
- Restored correct hide/show behavior for burndown metric rows by adding `.status-metric-line[hidden] { display: none; }` in `src/styles.css`.
- Added `src/styles.test.js` so the shared metric-line styling stays compatible with the HTML `hidden` attribute.

**Root cause to remember:**
- The burndown toggle renders both the collapsed summary and the expanded headline on each update, then relies on `hidden` to show only one.
- After the shared status-pill refactor, `.status-metric-line` forced `display: flex` without a matching `[hidden]` override, so the collapsed summary stayed visible when the burndown panel opened and duplicated the badges.

### 2026-03-30: Delegated Todo List Interactions
### 2026-03-30: Delegated Todo List Interactions (Task #64)

**What I changed:**
- Moved todo row interaction wiring in `src/todo/list-view.js` from per-row listeners to stable container listeners for click, change, dblclick, focus, and edit-key handling.
- Kept blocker picker toggles and blocked-status finalization working by delegating through row `data-id` and checkbox `data-blocker-id`, while leaving drag/reorder delegation in `src/todo/reorder.js` unchanged.
- Preserved mutation boundaries by continuing to route list interactions through the store action layer (`setTaskStatus`, `deleteTask`, `toggleBlocker`, `enterEditMode`, `saveEditedTask`, `cancelEdit`, `finalizeBlockedStatus`).

**Interaction rules to preserve:**
- List controls that survive full re-renders should be identified from the stable list container with `event.target.closest(...)`, not rebound per `<li>`.
- Blocker picker clicks must not fall through to generic row-click selection logic, but focus-driven selection and keyboard edit behavior should still keep working after re-render or reorder.

**Cross-refs:**
- Depends on Saul's store API (Task #62): dispatch `setTaskStatus`, `deleteTask`, `toggleBlocker`, etc.
- Works alongside Rusty's persistence effects (Task #63): store handles all localStorage writes
- PR #70 merged

### 2026-03-30: Active Label Copy + Inline Progress Summary

**What I changed:**
- Renamed the status dropdown’s active option from “— None —” to “Active” and removed the muted placeholder-style text color so the control reads like a real state selector.
- Added a persistent lightweight progress summary directly under the actionable filter, using the existing burndown sample counts to show completed-or-cancelled work as “X of Y done (Z%)” plus a thin inline bar.

**UI rules to preserve:**
- If a status value is a real selectable state, style it with the same readable text color as the other options instead of placeholder grey.
- Keep the inline progress summary always visible near the list controls so users can glance at current completion without opening the sidebar burndown view.


### 2026-03-30: Full-Viewport Confetti Tuning

**What I changed:**
- Reworked the done-state confetti so particles spawn across the full viewport instead of from the completed task, using a fixed full-screen burst layer with pointer-events disabled.
- Tuned the motion to feel gentler with 2-3 second durations, smoother cubic-bezier easing, multi-step sway, varied spin rates, and opacity that only fades during the final stretch of the fall.
- Increased density and variety by mixing 52 pieces with randomized sizes, colors, entry offsets, and end drifts while keeping DOM cleanup tied to each particle's `animationend`.

**Animation rules to preserve:**
- Celebration effects should read as a full-screen ambient shower, not a tight local pop, when the action is app-wide like marking a todo done.
- Prefer longer motion arcs with staged sway + fade variables over abrupt start/end transforms so randomized particles still feel cohesive instead of jerky.

### 2026-03-29: Blocker Picker Label Activation + DAG Status Parity

**What I changed:**
- Fixed the blocked-task picker so clicking blocker text toggles the checkbox again by giving each checkbox a stable `id`, wiring the label with `htmlFor`, and stopping picker clicks from bubbling into the row selection handler.
- Updated DAG node palettes so `done` tasks use the same green highlight language as the list, and `cancelled` tasks now get their own tinted red treatment instead of looking like faded default nodes.

**Interaction rules to preserve:**
- Nested interactive controls inside a clickable task row should stop event bubbling when the row click would otherwise steal or neutralize the control’s default behavior.
- Status styling should stay consistent between the task list and the dependency graph so users can recognize done/cancelled states in either view without relearning the color system.

### 2026-03-29: Done State Highlight Refresh

**What I changed:**
- Reworked `.status-done` styling in `index.html` to use a light green tint and a green left border instead of lowering row opacity.
- Kept the strike-through treatment, but shifted the done text to a softer green-gray and added a small leading checkmark for faster scanning.

**Styling rule to preserve:**
- For positive-completion states, prefer explicit accents (tint, border, icon) over reduced opacity so finished rows still feel visible and intentional next to blocked/cancelled states.

### 2026-03-29: Unblocked Notification Reset + Hidden Attribute Pitfall

**What I fixed:**
- Restored real hide/show behavior for the unblock alert by adding an explicit `#unblocked-notification[hidden] { display: none; }` rule; the component class was otherwise overriding the browser's default hidden styling.
- Reset the alert between unblock events in `src/main.js` with a cancelled/restarted animation-frame reveal so follow-up unblock events replace the old message and restart the 5-second auto-dismiss timer cleanly.
- Added a consecutive-snapshots regression test in `src/todo/model.test.js` to lock in the A→B then C→D unblock detection flow from issue #12.

**Interaction rules to preserve:**
- Any component styled with `display: flex` still needs an explicit `[hidden]` rule if we rely on the `hidden` attribute to hide it.
- Re-showing the unblock alert should always cancel any pending timeout/frame from the previous alert so the close button and auto-dismiss stay reliable across rapid successive unblock events.

### 2026-03-29: JavaScript Extraction for Testability

**What I did:**
- Extracted all JavaScript from index.html into separate app.js file
- Implemented ES module pattern with exports for testability

**File structure decisions:**
- Created `app.js` at project root (same level as index.html)
- Used ES module syntax (`export function ...`) for pure logic functions
- Kept DOM initialization in an IIFE that runs on page load
- Updated index.html to reference `<script src="app.js" type="module"></script>`

**Patterns used:**
- **Immutable data flow**: Rewrote all data manipulation functions to accept todos array and return new array (no mutations)
- **Injectable dependencies**: Storage interface can be passed as optional parameter for test mocking
- **Separation of concerns**: Pure logic functions are exported; DOM/event handling stays in IIFE
- **Module boundary**: Exported functions (generateId, migrateTodos, loadTodos, saveTodos, addTodo, setStatus, toggleBlocker, cleanupBlockedBy, deleteTodo, clearFinished) can be imported by test files

**Key changes from original:**
- Original used mutation (`todos.push()`, `todo.status = ...`); new version returns new arrays/objects
- Storage interface extracted to defaultStorage object with injectable getItem/setItem
- All data functions now testable without DOM or localStorage

### 2026-03-29: Node.js Project Setup with Vite and Vitest

**What I set up:**
- Converted project to Node.js with `npm init -y`
- Installed Vite as dev server and Vitest as test runner
- Configured package.json with ES modules (`"type": "module"`)

**Dev commands:**
- `npm run dev` — starts Vite dev server (default port 5173)
- `npm run build` — production build to dist/
- `npm run preview` — preview production build
- `npm test` — run tests once
- `npm run test:watch` — run tests in watch mode

**File structure:**
- `package.json` — Node project config with scripts and dependencies
- `vite.config.js` — Vite configuration (root: '.', server opens browser)
- `node_modules/` — dependencies (gitignored)
- `dist/` — production build output (gitignored)

**Verification:**
- Tested dev server with `npx vite --host 127.0.0.1`
- Confirmed index.html loads correctly at http://127.0.0.1:5173/
- Vite injects HMR client automatically for hot module replacement

### 2026-03-29: Full Team Delivery

**Context:** Session completed architecture review, implementation, and test suite.

**Danny's Architecture Decisions:**
- ADR-003: JavaScript Extraction and Testing Strategy (Vitest, happy-path focus)
- ADR-002: Multi-state Todos (active/done/cancelled/blocked)
- ADR-001: Task Dependencies (blockedBy feature)
- All decisions merged into decisions.md

**Linus's Testing:**
- Created 65+ unit tests covering all 10 exported functions
- All tests passing on first run
- Foundation ready for CI/CD

**Orchestration:**
- Orchestration logs written for each agent (danny, rusty, linus)
- Session log documenting team contribution
- Cross-agent history updated with full context

**Status:** ✅ Complete. Project has testable architecture, working dev server, and comprehensive test suite.

### 2026-03-29: Embedded DAG Dependency View

**What I implemented:**
- Added a dedicated `dag.js` ES module with pure dependency-graph derivation and DFS-based cycle detection.
- Rendered the dependency graph with native SVG + dagre layout, including selection, keyboard focus, tooltip, panning, reset view, and cycle warnings.
- Wired the graph into `app.js` so list selection and graph selection stay in sync, with row scroll + highlight on node activation.

**Implementation details:**
- Cycle edges are removed from dagre layout input but still rendered as dashed red arrows so invalid dependency data stays visible.
- The graph section lives below the footer and uses a viewport breakout width while preserving the original narrow task list layout.
- On mobile, the graph defaults to collapsed; when there are no dependency edges, the section stays present with a compact empty state instead of an empty canvas.

### 2026-03-29: DAG Ownership Boundary Cleanup

**What I changed:**
- Removed the obsolete `emptyStateElement` parameter from `createDagView()` so dag.js no longer advertises control over section-level empty state.
- Extracted `buildDependencyGraph()` and its cycle-detection helper into a neutral `graph.js` module shared by both app.js and dag.js.
- Added explicit ownership comments to app.js, dag.js, and graph.js to document section-vs-renderer responsibilities.

**Boundary rules to preserve:**
- `app.js` owns todos state, persistence, selection orchestration, and DAG section visibility/copy.
- `dag.js` owns only SVG rendering and graph-local interaction state inside the DAG container.
- Shared graph derivation belongs in `graph.js`, not in either orchestration or rendering code.

### 2026-03-29T16:49: PR #3 Post-Implementation Review (Saul)

**Reviewer:** Saul (Principal Frontend Dev)

**Review Results:**
- ✅ Code quality: Clean, no architectural concerns
- ✅ Test coverage: All 101 tests pass, no regressions
- ✅ State management: Immutable, testable pattern maintained
- ✅ Approval: PR #3 ready for merge

**Two-gate review process completed:**
1. ✅ Pre-implementation review (2026-03-29T16:35)
2. ✅ Post-implementation review (2026-03-29T16:49)

**Outcome:** PR #3 approved and merged to main.

### 2026-03-29: Keyboard Shortcuts + Help Modal

**What I implemented:**
- Added global keyboard handling in `src/main.js` for focus-input, row navigation, toggle, delete, help, and escape behaviors.
- Added a lightweight help modal and shortcut trigger in `index.html`, including platform-aware Cmd/Ctrl copy.
- Restored missing pure helpers in `src/todo/model.js` (`cycleStatus`, `getNextTodoId`, `getPrevTodoId`) so keyboard-oriented behavior stays testable.

**Interaction rules to preserve:**
- Todo shortcuts only fire when the user is not typing in an editable field; `Escape` and the input-focus shortcut still work globally.
- Todo rows are keyboard-focusable and selection follows both click and focus so ArrowUp/ArrowDown navigation has a stable anchor.
- Keyboard navigation operates on the visible list, so the actionable filter and selection state stay aligned.

### 2026-03-29: Smart Blocked Alerts

**What I implemented:**
- Added `detectUnblockedTodos()` in `src/todo/model.js` so unblock detection stays pure and testable against before/after todo snapshots.
- Added a dismissible status notification below the add form plus transient yellow highlight treatment for newly unblocked rows.
- Wired unblock surfacing into both mouse and keyboard flows for completion/cancellation and deletion paths.

**Interaction rules to preserve:**
- Unblock highlights live only in memory, expire after 3 seconds, and are cleared immediately by clicking the row or dismissing the alert.
- The alert auto-hides after 5 seconds, announces task names for screen readers, and does not change persisted todo data.

### 2026-03-29: Burndown View

**What I implemented:**
- Added burndown sampling helpers in `src/todo/model.js` for daily snapshots stored in `todos_burndown` with retention pruning and same-day duplicate protection.
- Added a collapsible Progress section inside `index.html` with responsive summary, legend, empty state, SVG chart shell, and hover tooltip styling.
- Wired `src/main.js` to sample once on load, render cumulative completed-vs-total lines, and keep the chart hidden until the user expands it.

**Interaction rules to preserve:**
- Burndown samples are taken only on first load of a local calendar day; chart data is historical and does not live-update with in-session edits.
- The chart summary uses monotonic rendered series so completed/total lines never visually move backward, even if users later clear finished tasks from the live list.

### 2026-03-30: Shared Constants Module Extraction

**What I extracted:**
- Centralized todo status vocabulary, status labels, status cycles, DAG status palette, shared app palette tokens, and localStorage keys into `src/app/constants.js`.
- Rewired `src/main.js`, `src/todo/model.js`, and `src/dag/view.js` to import status/storage/palette constants instead of repeating strings and color maps inline.

**Key exports:**
- `TODO_STATUS`, `TODO_STATUS_VALUES`, `TODO_STATUS_META`, `TODO_STATUS_OPTIONS`
- `ACTIONABLE_TODO_STATUSES`, `EDITABLE_TODO_STATUSES`, `TERMINAL_TODO_STATUSES`, `TOGGLEABLE_TODO_STATUSES`, `BLOCKER_SOURCE_TODO_STATUSES`, `TODO_STATUS_CYCLE`
- `TODO_STATUS_PALETTE`, `APP_PALETTE`, `APP_STORAGE_KEYS`

**Files changed:**
- `src/app/constants.js`
- `src/main.js`
- `src/todo/model.js`
- `src/dag/view.js`

### 2026-03-30: Inline CSS Extraction to src/styles.css

**What I changed:**
- Moved the full app stylesheet out of `index.html` into `src/styles.css` without renaming selectors or changing style behavior.
- Imported the stylesheet from `src/main.js` so Vite owns CSS bundling and the existing UI keeps the same look across the todo list, burndown, DAG, notifications, and modals.

**Styles kept in `index.html`:**
- None. The entire large inline app stylesheet was extracted because Vite now loads it through the JS entrypoint and no critical-path-only exception was needed.

### 2026-03-30: Persistence Routed Through Store Effects

**What I changed:**
- Moved discoverability-tip persistence into `src/app/store.js` so shortcut and reorder dismissals now load from store state and persist through named actions instead of `main.js` writing `localStorage` directly.
- Expanded the store's post-action effect pass to cover todos, burndown samples, ready-filter preference, and both tip-dismissal flags in one centralized place while keeping the existing storage keys untouched.
- Added store tests that pin tip preference hydration/persistence and burndown writes through the effect layer.

**State flow rule to preserve:**
- Browser event handlers should dispatch store actions and let post-action effects own persistence; `main.js` can react to state changes, but it should not write durable UI or todo state directly.

### 2026-03-30: Unified Button Control Language

**What I changed:**
- Introduced a shared `.control-button` foundation in `src/styles.css` and applied it across add, footer, DAG, modal, toolbar, dismiss, and row delete buttons so action/toggle controls now share the same 6px radius, padding language, hover lift, and focus outline.
- Kept passive `.status-pill` metrics fully rounded and non-interactive, while letting toggle controls keep their active state through the shared accent treatment instead of pill styling.
- Wired the new control classes into `index.html`, `src/todo/list-view.js`, and `src/dag/view.js` without changing button behavior.

**UI rule to preserve:**
- Interactive controls should read as controls first: tighter corners, hover/focus affordance, and consistent button chrome across toolbars, forms, modals, and side panels.
- Passive metrics should stay pill-shaped with `cursor: default` and no hover affordance so they never compete visually with actionable controls.

### 2026-03-30: Design Tokens + Visual Unification

**What I changed:**
- Introduced a flat `:root` token set in `src/styles.css` for radii, text, borders, surfaces, spacing, shadows, and focus, then rewired buttons, form controls, panels, tooltips, pills, and list rows to consume those tokens.
- Synced status-driven CSS variables from `src/app/constants.js` at app startup so list rows, pills, burndown touches, and DAG visuals all pull from the same shared status palette instead of drifting per surface.
- Removed the last hard-coded form-control text color in `src/todo/list-view.js`, aligned burndown SVG neutrals with shared constants, and standardized DAG node corner radii to the shared surface radius.

**UI rules to preserve:**
- Control chrome should stay on the 6px / 8px / pill radius system: interactive controls use the control radius, elevated surfaces use the surface radius, and passive badges stay fully rounded.

### 2026-03-30: In-Progress Tasks as Valid Blockers

**What I changed:**
- Expanded `BLOCKER_SOURCE_TODO_STATUSES` so the blocked-task picker now lists `todo`, `inprogress`, and `blocked` tasks as valid blockers while still excluding finished work.
- Verified the model/store flow already treats in-progress blockers as active dependencies, then added regression coverage to lock in unblock notifications when an in-progress blocker moves to `done`.
- Added a DAG regression test to confirm dependency edges and node statuses render normally when the upstream blocker is already in progress.

**Interaction rule to preserve:**
- Blocker eligibility should be driven from the shared status constant, not reimplemented in the picker, so list UI, unblock logic, and DAG rendering stay aligned when dependency rules change.
- If a status color changes, update it in `src/app/constants.js` and let the runtime CSS-variable sync fan it out across CSS and SVG renderers instead of hand-tuning individual surfaces.
