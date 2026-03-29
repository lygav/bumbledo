# Rusty — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Frontend Dev
- **Joined:** 2026-03-29T08:36:00.627Z

## Learnings

<!-- Append learnings below -->

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
