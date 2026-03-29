# Danny — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Lead
- **Joined:** 2026-03-29T08:36:00.626Z

## Learnings

<!-- Append learnings below -->

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
