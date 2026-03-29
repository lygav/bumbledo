# Danny — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Lead
- **Joined:** 2026-03-29T08:36:00.626Z

## Learnings

<!-- Append learnings below -->

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
