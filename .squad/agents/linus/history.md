# Linus — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** Tester
- **Joined:** 2026-03-29T08:36:00.628Z

## Learnings

### 2026-03-29: Keyboard shortcuts model-layer contract tests

**What I delivered:**
- Added 14 new model-level tests in `src/todo/model.test.js` for shortcut support helpers
- Covered the intended `cycleStatus()` contract plus `getNextTodoId()` / `getPrevTodoId()` navigation helpers
- Kept the suite at the pure-function level; no DOM or event wiring assertions

**Decisions captured in tests:**
- Enter cycling is specified as `active -> done -> active`
- `cancelled` should recover to `active` when cycled from the keyboard
- `blocked` with active dependencies should **not** cycle, to avoid silently discarding blocker state
- Navigation helpers should wrap, tolerate missing current IDs, return self for one item, and return `null` for empty lists

**Execution outcome:**
- Baseline before changes: existing suite was green
- After adding tests: 14 expected red tests now fail because `cycleStatus`, `getNextTodoId`, and `getPrevTodoId` are not implemented/exported in `model.js`
- This gives Rusty a clear TDD target without mixing in UI/integration concerns

### 2025-07-17: Unit test strategy for app.js

**Test Coverage Approach:**
- Created 10 test suites with 80+ test cases covering all exported functions
- Followed the test pyramid: focused on unit tests for pure functions
- Injectable storage pattern enabled clean mocking without DOM dependencies

**Key Edge Cases Identified:**
- Empty/whitespace-only input handling in `addTodo`
- Migration path validation for legacy `done` field format
- Cascade cleanup logic when blockers are removed (auto-revert to active)
- Invalid JSON handling in storage load
- Immutability verification (functions return new arrays, not mutate)

**Testing Principles Applied:**
- Test the contract, not implementation: focused on inputs/outputs
- Mock external dependencies (storage) to isolate logic
- Each test validates a single behavior
- Edge cases prioritized: empty arrays, missing fields, invalid data

**Blockers Feature Testing:**
- Validated auto-cleanup of `blockedBy` arrays on delete/complete
- Tested status transitions (blocked → active when last blocker removed)
- Confirmed circular dependency handling is absent (acceptable per ADR-001)

### 2026-03-29: Full Test Suite Delivery

**What I delivered:**
- Created `app.test.js` with 65+ unit tests for all 10 exported functions
- All tests passing on first run
- Comprehensive edge case coverage

**Test suites by function:**
1. generateId() — 6 tests (format, uniqueness, no dependencies)
2. migrateTodos() — 8 tests (legacy field conversion, backward compatibility)
3. addTodo() — 7 tests (structure, immutability, invalid input)
4. setStatus() — 9 tests (valid transitions, invalid rejection, immutability)
5. toggleBlocker() — 8 tests (add/remove, duplicate prevention, immutability)
6. cleanupBlockedBy() — 8 tests (deletion, completion, auto-revert)
7. deleteTodo() — 5 tests (removal, cascade cleanup, immutability)
8. clearFinished() — 6 tests (done/cancelled removal, preserve active/blocked)
9. loadTodos() — 5 tests (JSON parsing, invalid JSON, migration)
10. saveTodos() — 7 tests (serialization, persistence, round-trip)

**Testing architecture:**
- Framework: Vitest (native Vite integration, fast execution)
- Storage mocked to isolate logic from localStorage
- No DOM dependencies — all tests run in Node.js environment
- Immutability verification across all functions

**Team context:**
- Danny: Architecture and decision documentation (3 ADRs finalized)
- Rusty: JavaScript extraction to app.js with ES modules + Node.js setup (Vite + Vitest)
- Linus (me): 65+ test suite covering all logic

**Status:** ✅ Complete. Project has testable architecture, working infrastructure, and comprehensive test coverage. Ready for feature development.

### 2026-03-29: DAG graph derivation contract tests

**What I delivered:**
- Added `dag.test.js` covering the pure `buildDependencyGraph()` contract from Danny's DAG ADR
- Focused on graph derivation outputs only: nodes, edges, dependency presence, cycle detection, and summary stats
- Deliberately did not run the tests because `dag.js` is still being implemented in parallel

**Coverage focus:**
- Node mapping from todo shape to graph node shape, including `orderIndex`
- Edge derivation from `blockedBy`, including multiple blockers and isolated tasks
- `hasDependencies` behavior for populated, empty, and missing `blockedBy`
- Cycle detection for self-cycles, two-node cycles, three-node cycles, and partial cycles
- Stats validation for node, edge, and cycle counts on small and larger graphs

**Testing posture:**
- Contract-first assertions based on the ADR, not internal algorithm choices
- Included one compatibility test for missing blocker IDs so Rusty can either omit or retain dangling edges without breaking the suite
- Avoided DOM and layout concerns; this suite targets derivation logic only
