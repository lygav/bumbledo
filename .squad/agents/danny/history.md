# Danny — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Lead
- **Joined:** 2026-03-29T08:36:00.626Z

## Learnings

<!-- Append learnings below -->

### 2026-03-29: PR #11 Smart Blocked Alerts Review

**Verdict:** Reject pending integration coverage fix.

**What I learned:**
- `detectUnblockedTodos(before, after)` is the right shape for this feature: a small pure helper that only reports blocked → active transitions and stays decoupled from DOM concerns.
- The Smart Blocked Alerts wiring is mostly sound in direct status-change and delete flows, but `clearFinished()` is an important third unblock path and `main.js` does not surface alerts after that bulk cleanup. Users can therefore unblock tasks without seeing the notification or gold highlight.
- The notification bar markup is directionally correct (`role="status"`, dismiss button, hidden descriptive detail), and the highlight state is transient in memory rather than persisted, which matches the PRD well.
- The 10 new tests validate the helper itself, but they are not sufficient for the feature as a whole because they miss the bulk-clear integration path where the real regression currently lives.

### 2026-03-29: PR #6 Keyboard Shortcuts Review

**Verdict:** Reject pending integration cleanup.

**What I learned:**
- The keyboard layer currently breaks its own visibility contract: with the Actionable filter on, `render()` clears hidden selection, but `toggleSelectedTodoStatus()` immediately restores `selectedTaskId` to a now-invisible todo. That leaves keyboard actions targeting a task the user cannot see.
- The global `Escape` handler runs before the editable-target guard, so form fields and inline edit inputs are not fully insulated from list-level shortcuts. The app mostly protects `?`, arrows, Enter, and delete while typing, but not the full shortcut surface.
- The new model helpers (`cycleStatus`, `getNextTodoId`, `getPrevTodoId`) are pure and reasonable in isolation, but they are not wired into `main.js`. That means the 14 new tests mostly validate detached helpers rather than the behavior the user actually exercises.
- The help modal markup is directionally good (`role="dialog"`, `aria-modal`, table semantics), but it still behaves like a lightweight overlay, not a fully managed dialog. Focus return is only handled on the close button path.

### 2026-03-29: PRD Audit — Architectural Drift Detected

**Verdict:** Core PRD is honored; implementation has evolved beyond stated constraints.

**Key Findings:**
- ✅ All 10 user stories fully implemented and working as specified
- ✅ All task states, blocking logic, persistence, and accessibility requirements met
- ❌ **Build tools:** PRD forbids npm/Vite; implementation uses both
- ❌ **Single file:** PRD requires one HTML file with inline JS; code split across `src/` tree
- ❌ **No dependencies:** PRD forbids external packages; `dagre` added for graph layout
- 🆕 **Dependency graph visualization:** Full interactive SVG system built but not documented in PRD (graph panel, cycle detection, pan/zoom, node selection, tooltips)

**Trade-off Analysis:**
- The original PRD prioritized **simplicity and no setup** ("open in browser, it works")
- The implementation prioritizes **maintainability, testability, and scalability** (modular architecture, separation of concerns, proper dev/build workflow)
- For a todo app staying as "one HTML file," the current approach is over-engineered
- For a todo app with a full dependency graph visualization, the current approach is proportional

**Architectural Decision:**
The project has implicitly chosen **scalable single-page app** over **zero-setup HTML file**. This is a valid choice, but the trade-off should be explicit: gaining graph visualization, easier testing, and modularity at the cost of setup friction. PRD must be updated to reflect this.

**Next Steps:**
1. Update PRD Section 6 to document actual build/module constraints
2. Add new PRD section documenting the dependency graph visualization (now in-scope)
3. Remove or relocate "No build step" and "Single file" constraints
4. Consider: does the graph visualization justify the complexity? Or should it be optional?

**Files affected:**
- PRD.md (needs updates)
- .squad/decisions/inbox/danny-prd-drift.md (created)

### 2026-03-29: Project Structure Recommendation

**Recommendation:** Move app code under a light `src/` tree, keep `index.html` at the project root for Vite, and prefer co-located tests next to the modules they verify.

**What I learned:**
- The current flat root was acceptable for the first cut, but it is already mixing runtime code, tests, build config, and product docs in one place.
- This app now has at least three real concerns: app/bootstrap orchestration, todo/domain logic, and DAG/graph rendering/derivation.
- For Vite, the least-friction structure is to keep `index.html` in the root and point it at `/src/main.js`; no custom `root` change is required.
- Co-located tests are the best fit here because each module stays physically close to its verification without introducing a large separate test tree.
- CSS should stay embedded for now per earlier architecture guidance; if extracted later, start with one shared stylesheet, not a multi-file CSS architecture.

### 2026-03-29: Dual-control Review of DAG UI State

**Verdict:** Continue with the current architecture, but tighten the boundary instead of broadening it.

**What I learned:**
- The repeated bug was caused by a broken ownership rule, not by an unsalvageable overall design.
- `app.js` is the right owner for application state, selection, and section-level visibility.
- `dag.js` is the right owner for rendering inside the graph container plus graph-local interaction state (hover, focus, pan, reset).
- The main remaining smell is not empty-state ownership anymore; it is that `app.js` still imports `buildDependencyGraph()` from `dag.js`, so graph derivation and graph rendering are coupled at the module boundary.
- For this app size, the architecture is still proportional. The next step is boundary cleanup, not a framework or state-management rewrite.

### 2026-03-29: Embedded DAG Architecture

**Decision:** Keep `todos` as the single source of truth and derive a graph view in a separate `dag.js` module.

**Recommended implementation:**
- Use `dagre` for left-to-right layered layout
- Render with native SVG, not a heavy graph framework
- Place the graph below the task list and let it break out wider than the 600px list column
- Keep interactions modest: node selection, tooltip, neighborhood highlight, pan/reset

**Key trade-offs:**
- Prefer a small layout dependency over maintaining custom graph layout logic
- Do not build graph editing in v1; keep dependency editing in the existing blocker picker
- Detect cycles and render them as warning-state edges instead of letting the graph fail

**Files:** `app.js`, `index.html`, `.squad/decisions/inbox/danny-dag-architecture.md`

### 2025-03-29: JavaScript Extraction Architecture

**Decision:** Extract JS to `app.js` as ES module, keep CSS embedded in `index.html`
**Testing:** Use Vitest with happy-path tests for pure functions (data operations, migrations)
**Key patterns:**
- ES modules (`export`/`import`) for testability without build tools
- `init()` wrapper pattern to make module testable (checks for `document`)
- Test pure functions, skip DOM-heavy render logic (low ROI)
- CSS stays embedded: only 356 lines, no logic, no build step

**User preference:** Pragmatic architecture — avoid over-engineering for small apps
**Files:** `index.html`, `app.js`, `app.test.js`, `package.json`
**Related ADR:** ADR-003 in decisions.md

### 2026-03-29: Full Team Delivery

**Context:** Session completed architecture review, implementation, and test suite.

**Rusty's Implementation:**
- Extracted all JS from index.html to app.js with ES module exports
- Rewrote functions to immutable pattern (return new arrays)
- Added injectable storage interface for test mocking
- Set up Node.js project with Vite + Vitest
- Fixed DOM guard (`if (typeof document !== 'undefined')`) for test compatibility

**Linus's Testing:**
- Created 65+ unit tests covering all 10 exported functions
- Tested edge cases: migrations, cascade cleanup, invalid inputs
- All tests passing on first run
- Foundation ready for CI/CD integration

**Orchestration:**
- Decision logs merged into decisions.md
- Session log written documenting team contribution
- Cross-agent history updated

**Status:** ✅ Complete. Ready for feature development and deployment.

### 2026-03-30: Architecture Review of Current Codebase

**Verdict:** Refactor warranted, but as an evolutionary boundary cleanup — not a framework rewrite.

**What I learned:**
- This is a vanilla JS + Vite SPA, not a React app; the architecture already leans on controller/factory patterns rather than component trees.
- The healthiest modules are `src/todo/model.js`, `src/todo/notification.js`, and `src/dag/graph.js`, which keep logic pure or tightly scoped.
- The main scaling risks are concentrated in `src/main.js` (1820 lines of orchestration, rendering, keyboard, drag/drop, charting, and modal logic) and `index.html` (1770 lines with all styling inline).
- The right next move is to keep the current stack, extract feature controllers/renderers, introduce a lightweight action/store layer, and move CSS into imported stylesheets.
- Key files for future work: `src/main.js`, `index.html`, `src/todo/model.js`, `src/todo/notification.js`, `src/dag/graph.js`, `src/dag/view.js`, `package.json`, `vite.config.js`.

### 2026-03-30: Refactor Issue Decomposition

**What I learned:**
- I decomposed the architecture review into seven delivery issues: #59 shared constants, #60 CSS extraction, #61 `main.js` controller breakup, #62 app store/action layer, #63 persistence consolidation, #64 delegated list events, and #65 ESLint/formatter/CI guardrails.
- The cleanest breakdown was to separate boundary-establishing work from behavior-preserving cleanup: constants and CSS first, then controller/store seams, then persistence and DOM optimization, then tooling guardrails.
- Assignment rationale matters as much as sequencing: Rusty got focused frontend cleanup and DOM optimization, Saul got the two highest-leverage architectural refactors (`main.js` decomposition and store/actions), and I kept tooling/CI because it sets repo-wide standards and trade-offs.
