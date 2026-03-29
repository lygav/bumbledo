# Decisions Log

> Shared context for all squad agents. Read before starting work.

---

## ADR-001: Task Dependency (Blocked-By) Feature

**Status:** Accepted  
**Author:** Danny  
**Date:** 2025-07-17

### Summary

- `blockedBy: string[]` field on todo objects (only meaningful when `status === "blocked"`)
- Inline checkbox picker below blocked items for selecting blockers
- "Blocked by: ..." subtitle text on blocked todos
- Auto-cleanup: deleting/completing a blocker removes it from all `blockedBy` arrays; empty `blockedBy` → auto-revert to active
- No circular dependency detection (acceptable for a todo app)
- Backward-compatible localStorage: omit `blockedBy` when saving non-blocked todos

### Data Model

Add an optional `blockedBy: string[]` field to the todo object, containing IDs of blocking tasks.

```json
{ "id": "abc", "text": "Deploy app", "status": "blocked", "blockedBy": ["def", "ghi"] }
```

**Rationale:**
- Keeps the flat array of todos as the single source of truth.
- `blockedBy` is only meaningful when `status === "blocked"` — it's ignored otherwise.
- No new storage keys. Same `localStorage` key, same JSON array.
- Deletion/cleanup is a simple filter during existing mutation operations.

### UI for Setting Blockers

When a todo's status is changed to "blocked", render an inline panel *below that list item* containing a checkbox for each other non-done/non-cancelled task. Checking a box adds that task's ID to `blockedBy`; unchecking removes it.

**Design details:**
- The blocker-picker panel appears *only* on items with `status === "blocked"`.
- It lists all other todos that are `active` or `blocked` (not done/cancelled).
- Each entry is a `<label>` wrapping a `<input type="checkbox">` + task text (truncated to ~40 chars).
- Selecting/deselecting a checkbox immediately updates `blockedBy` and persists.

### Displaying Dependencies

When a blocked todo has `blockedBy.length > 0`, render a small text line below the todo text:

> _Blocked by: Buy milk, Walk dog_

- Use the blocker tasks' text, truncated to ~30 chars each.
- Comma-separated. If more than 3 blockers, show first 2 + "+ N more".
- Styled with smaller font, muted color (like a subtitle).

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Blocking task is deleted | Remove its ID from all `blockedBy` arrays. If a todo's `blockedBy` becomes empty, auto-set status to `active`. |
| Blocking task is completed/cancelled | Remove its ID from all `blockedBy` arrays. If `blockedBy` becomes empty, auto-set status to `active`. |
| Task blocked by a blocked task | Allowed. No circular-dependency detection. |
| User unchecks all blockers | `blockedBy` becomes `[]`. Auto-set status to `active`. |
| Status changed away from "blocked" | Clear `blockedBy` to `[]`. |
| Status set to "blocked" with no blockers | Status is "blocked" with `blockedBy: []`. The picker is shown so user can select. |

### localStorage Migration

**Decision:** No schema version field. Backward-compatible detection on load.

- **New format:** `{ id, text, status, blockedBy? }` — `blockedBy` is optional.
- **Migration (load-time):** If a todo has `status === "blocked"` and no `blockedBy` field, set `blockedBy: []`.
- **Cleanup (save-time):** When serializing, omit `blockedBy` if it's empty or status isn't "blocked".
- **No new storage key.** Same `"todos"` key, same array structure.

### Consequences

- **Simple and self-contained.** No new data structures, no new storage keys.
- **Auto-cleanup on delete/complete keeps data healthy.**
- **No circular dependency protection.** Acceptable for a todo app.

---

## ADR-002: Multi-state Todos (active / done / cancelled / blocked)

**Status:** Accepted  
**Author:** Danny  
**Date:** 2025-07-17

### Summary

Replace the boolean `done` field with a `status` string enum supporting four states: `active`, `done`, `cancelled`, `blocked`.

### Data Model

```js
// Before
{ id: "abc123", text: "Buy milk", done: false }

// After
{ id: "abc123", text: "Buy milk", status: "active" }
```

Valid values: `"active"` (default), `"done"`, `"cancelled"`, `"blocked"`.

**Why a string, not an integer or separate booleans?**
- Self-documenting in localStorage — you can read the JSON and understand it.
- Extensible — adding a fifth state later doesn't require a schema migration.
- A single field means states are mutually exclusive by construction.

### UI Interaction

Replace the checkbox with a small `<select>` element showing the current status. This is the standard HTML control for "pick one of N" with zero learning curve.

**Implementation notes:**
- The `<select>` replaces the `<input type="checkbox">` in each `<li>`.
- Options: `Active`, `Done`, `Cancelled`, `Blocked`.
- Use a `change` event listener that calls a new `setStatus(id, newStatus)` function.
- Style the select to be compact with fixed width (~100px).

### Visual Treatment

Each state gets a CSS class on the `<li>`:

| Status | CSS class | Visual |
|--------|-----------|--------|
| `active` | *(none)* | White background, full opacity |
| `done` | `.status-done` | Strikethrough + `opacity: 0.6` + color `#999` |
| `cancelled` | `.status-cancelled` | Strikethrough + `opacity: 0.5` + color `#c0392b` (muted red) |
| `blocked` | `.status-blocked` | Left border `3px solid #e67e22` (orange) + background `#fffbf0` |

### "Clear done" Button → "Clear finished"

Rename the button to **"Clear finished"**. It removes all todos with status `"done"` OR `"cancelled"`.

**Rationale:**
- Done and cancelled are both terminal states — neither requires further action.
- A single button is simpler than two buttons.
- "Finished" communicates "no longer active" better than "done".

### localStorage Migration

On load, run a one-pass migration before rendering:

```js
function migrateTodos(todos) {
  return todos.map(t => {
    if ('done' in t && !('status' in t)) {
      const { done, ...rest } = t;
      return { ...rest, status: done ? 'done' : 'active' };
    }
    return t;
  });
}
```

**Rules:**
- If a todo has `done: true` and no `status` → set `status: "done"`, delete `done`.
- If a todo has `done: false` and no `status` → set `status: "active"`, delete `done`.
- If a todo already has `status` → leave it alone (idempotent).
- No version field needed — the presence of `done` vs `status` is the version signal.

### Code Changes

| Area | Change |
|------|--------|
| `addTodo()` | Set `status: "active"` instead of `done: false` |
| `toggleTodo()` | Replace with `setStatus(id, status)` |
| `render()` | Replace checkbox with `<select>`. Apply status-based CSS classes. |
| `clearDone()` | Filter on `status === "done" \|\| status === "cancelled"` |
| `loadTodos()` | Call `migrateTodos()` after parsing |
| CSS | Remove `.done` class styles. Add `.status-done`, `.status-cancelled`, `.status-blocked` |
| HTML | Rename button text from "Clear done" to "Clear finished" |

### Risks

- **Native `<select>` styling:** Hard to style consistently cross-browser. Accept the platform look.
- **Accidental state changes:** A `<select>` can be changed with a single click (intentional, like the checkbox).
- **Migration edge cases:** Corrupted localStorage could have todos missing both `done` and `status`. Should default to `"active"`.

---

## ADR-003: JavaScript Extraction and Testing Strategy

**Status:** Accepted  
**Author:** Danny  
**Date:** 2025-03-29

### Summary

Extract JavaScript to separate `app.js` file. Use ES modules. Test with Vitest in happy-path mode.

### Decision

**Extract JavaScript to separate file. Use ES modules. Test with Vitest in happy-path mode.**

### Recommended File Structure

```
index.html              # HTML structure + <style> tag (CSS stays embedded)
app.js                  # All application logic as ES module
app.test.js             # Unit tests
package.json            # Dev dependency: vitest
.gitignore              # Add node_modules
```

### Rationale: Keep CSS Embedded

- **Current size:** 356 lines CSS, 330 lines JS = ~715 total
- **CSS doesn't need testing:** No logic to verify
- **No build step exists:** Extracting CSS adds no value, only ceremony
- **Single HTTP request:** Embedding CSS keeps the app fast
- **Trade-off accepted:** If CSS grows to 500+ lines or becomes complex, reconsider extraction.

### Rationale: Extract JavaScript

**Why extract now:**
- **Testing:** Can't unit test code inside `<script>` tags without browser harness
- **Clarity:** 330 lines of logic is past the "glance and understand" threshold
- **Debugging:** Separate file = better stack traces, easier debugging
- **Version control:** Diffs become cleaner when JS changes don't show up in HTML file

### Module Strategy: ES Modules

**Use:** `<script type="module" src="app.js"></script>` in HTML, `export` functions in `app.js`

**Why ES modules:**
- **Native browser support:** No build tools required
- **Testability:** Vitest understands ES modules out-of-box
- **Future-proof:** If app grows, you can split into multiple modules without rewriting
- **Clean API:** Explicit exports make public interface clear

### Testing Strategy: Vitest (Happy-Path Mode)

**Recommended:** Vitest with JSDOM, test pure functions only

| Option | Trade-off |
|--------|-----------|
| **Vitest** ✅ | Modern, fast, ES modules native, zero config. **Choose this.** |
| Jest | Requires transform config for ES modules, slower |
| Browser tests | Slow, requires test runner HTML harness, overkill for logic tests |

### What to Test

**Test these pure functions:**
- `generateId()` — returns unique ID format
- `migrateTodos()` — converts old schema to new
- Data operations: `addTodo`, `deleteTodo`, `setStatus`, `toggleBlocker`, `cleanupBlockedBy`

**Skip these (DOM-heavy, low ROI):**
- `render()` — requires full DOM mocking
- Event handlers — integration tests would be better

### Trade-offs Summary

| Choice | Benefit | Cost |
|--------|---------|------|
| Extract JS | Testable, cleaner diffs, better debugging | +1 HTTP request (negligible) |
| Keep CSS embedded | Simple, fast, no build step | Harder to share styles |
| ES modules | Native, testable, future-proof | Requires `type="module"` |
| Vitest | Fast, modern, zero config | Adds node_modules |
| Test pure functions only | High value, low maintenance | DOM logic remains untested |

### Implementation Checklist

1. Create `package.json`: `npm init -y`
2. Install Vitest: `npm install -D vitest`
3. Add test script to `package.json`
4. Create `app.js`, move JS from `index.html`
5. Export functions that need testing
6. Add `init()` wrapper, call it when `document` exists
7. Update `index.html`: `<script type="module" src="app.js"></script>`
8. Create `app.test.js` with happy-path tests
9. Run tests: `npm test`
10. Verify app still works in browser

### Future Considerations

**When to reconsider this architecture:**
- **CSS grows >500 lines:** Extract to `styles.css`
- **JS grows >1000 lines:** Split into multiple modules
- **Need complex testing:** Add Playwright for E2E tests
- **Performance issues:** Add bundler (Vite) for minification

**Not needed now:** Build tools, TypeScript, linting.

---

## ADR-004: Node.js Project Setup with Vite & Vitest

**Status:** Accepted  
**Author:** Rusty  
**Date:** 2026-03-29

### Summary

Converted project to Node.js with Vite as dev server and Vitest as test runner.

### Implementation Details

1. **Package Configuration:**
   - `"name": "todo-app"`
   - `"type": "module"` (ES modules)
   - `"private": true`

2. **Dependencies:**
   - `vite` (dev server with HMR)
   - `vitest` (test runner, Vite-native)

3. **NPM Scripts:**
   - `dev` — starts Vite dev server (auto-opens browser)
   - `build` — production build to dist/
   - `preview` — preview production build
   - `test` — run tests once
   - `test:watch` — run tests in watch mode

4. **Vite Configuration (`vite.config.js`):**
   - Root directory: `.` (serves from project root)
   - Server opens browser automatically

5. **Gitignore:**
   - `node_modules/`
   - `dist/`

### Rationale

- **Vite:** Fast dev server with instant HMR, optimized for ES modules
- **Vitest:** Native Vite integration, same config, fast test execution
- **ES Modules:** Already using ES modules in app.js, no migration needed
- **Zero Changes to Source:** index.html and app.js work as-is with Vite

### Verification

- ✅ Dev server tested at http://127.0.0.1:5173/
- ✅ Confirmed index.html loads with Vite HMR client injected
- ✅ No modifications to app.js or index.html required
- ✅ app.js imports correctly in test environment

### Key Files

- `package.json` — Node project config with scripts and dependencies
- `vite.config.js` — Vite configuration
- `node_modules/` — dependencies (gitignored)
- `dist/` — production build output (gitignored)

---

## ADR-005: Drag-and-drop Reordering Implementation

**Status:** Accepted  
**Author:** Livingston  
**Date:** 2025-01-20

### Summary

Added HTML5 Drag and Drop API-based reordering to the todo list using event delegation with visual feedback.

### Key Choices

- **Whole-item draggable**: Each `<li>` is draggable (not just the handle). The handle provides the visual affordance (`cursor: grab`) but the entire row can be dragged. This feels more natural and forgiving.
  
- **Event delegation**: All drag events are attached to `#todo-list` via delegation, so they survive `render()` calls that rebuild the DOM.
  
- **Drop indicator**: Uses `box-shadow` (not border) for the insertion line so it doesn't shift layout. Blue line (#4a90d9) matches the app's accent color.
  
- **Top/bottom half detection**: `dragover` checks cursor position relative to the target item's midpoint to determine whether to insert above or below.
  
- **CSS classes**: 
  - `.dragging` (opacity 0.4)
  - `.drag-over-above` / `.drag-over-below` (blue line indicator)
  - `body.is-dragging` (grabbing cursor globally)
  
- **No external libraries**: Pure HTML5 DnD API as required.

---

## ADR-006: Unit Test Strategy for app.js

**Status:** Accepted  
**Author:** Linus  
**Date:** 2026-03-29

### Summary

Created comprehensive unit test suite with 65+ tests covering all 10 exported functions in app.js using Vitest.

### Test Coverage

Tests written for all exported functions:

1. **generateId()** — Format validation, uniqueness, no dependencies
2. **migrateTodos()** — Legacy field conversion, backward compatibility, invalid input
3. **addTodo()** — New todo structure, immutability, invalid input rejection
4. **setStatus()** — Valid transitions, invalid status rejection, immutability
5. **toggleBlocker()** — Adding/removing blockers, duplicate prevention, immutability
6. **cleanupBlockedBy()** — Deletion cleanup, completion cleanup, auto-revert logic
7. **deleteTodo()** — Correct removal, length verification, cascade cleanup
8. **clearFinished()** — Remove done and cancelled, preserve active/blocked
9. **loadTodos()** — JSON parsing, invalid JSON handling, migration on load
10. **saveTodos()** — Serialization, persistence, round-trip consistency

### Testing Principles

- **Unit-focused:** Each test validates a single behavior
- **Edge cases prioritized:** Empty inputs, invalid data, boundary conditions
- **Mock storage:** Storage interface mocked to isolate logic from localStorage
- **No DOM dependencies:** All tests run in Node.js environment
- **Immutability verification:** Functions return new arrays, not mutations
- **Happy-path focus:** Tests verify normal usage patterns

### Key Edge Cases Identified and Tested

- Empty/whitespace input to addTodo (rejected)
- Migration of legacy `done` field format
- Cascade cleanup when blockers are deleted
- Auto-revert to active when last blocker is removed
- Invalid JSON in localStorage
- Circular dependency handling (allowed, no special case)
- Duplicate blockers in toggleBlocker (prevented)
- Status transition rules

### Test Execution

- **Framework:** Vitest (native Vite integration)
- **Commands:** 
  - `npm test` — run once
  - `npm run test:watch` — watch mode
- **Result:** All 65 tests passing on first run
- **Coverage:** All exported functions, all major code paths

### Consequences

- App logic fully tested and validated
- Ready for deployment with confidence
- Team can extend tests as new features are added
- Foundation for future CI/CD integration
