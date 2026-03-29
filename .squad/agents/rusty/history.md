# Rusty — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Frontend Dev
- **Joined:** 2026-03-29T08:36:00.627Z

## Learnings

<!-- Append learnings below -->

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
