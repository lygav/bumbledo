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
- Circular dependencies are **prevented**. The blocker picker validates and rejects selections that would create a cycle.
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
| Circular dependency attempted | Checkbox is not toggled; user sees "Can't add — would create a circular dependency" message. |
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
- **Circular dependency prevention.** The blocker picker validates selections to ensure no cycles are created.

### Revision Note

**Revised (issue #55):** Originally circular dependencies were allowed. Changed to prevent them based on user feedback — cycles confused users and created deadlocked tasks.

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
### 2026-03-29T12:02:00Z: DAG view is read-only
**By:** Vladi Lyga (via Copilot)
**What:** The DAG dependency view is read-only. No drag-to-create dependencies, no graph editing. It is purely a navigation and visualization surface.
**Why:** User directive — confirmed during design review.
### 2026-03-29T12:18:00Z: Break work into tasks with progress updates
**By:** Vladi Lyga (via Copilot)
**What:** For larger features, break work into discrete sub-tasks and provide constant progress updates during the build. Don't let agents run for 10+ minutes with no visibility. Show what step they're on, what's done, what's next.
**Why:** User directive — the DAG implementation ran ~13 minutes with no intermediate status. That's too opaque.
# ADR: Embedded Task Dependency DAG Architecture

**Status:** Proposed  
**Author:** Danny  
**Date:** 2026-03-29

## Context

The todo app already stores dependency truth in each todo's optional `blockedBy: string[]` field. We need an embedded dependency visualization below the task list that stays proportional to a small vanilla JS app, does not introduce framework complexity, and remains maintainable by a small team.

Existing decisions we must preserve:

- The flat `todos` array remains the single source of truth.
- `blockedBy` defines blocker relationships and is already persisted.
- Circular dependencies are currently allowed in the data model, even if they are undesirable.
- The app uses plain HTML/CSS/JS ES modules with Vite and no framework runtime.

## Decision

Build the dependency graph as a **small vanilla JS module (`dag.js`) that derives graph data from the existing `todos` array, uses `dagre` for layout, and renders with native SVG**.

This is closest in spirit to the **dagre + d3** option, but we should **avoid bringing in D3 for rendering** unless a later requirement truly needs D3's data-join model. The hard problem here is layout, not DOM manipulation.

## Why this option

### Recommended choice: dagre layout + native SVG rendering

**Why it fits this app**

- **Right amount of abstraction:** dagre solves layered DAG layout, which is the only genuinely tricky part.
- **Vanilla-friendly:** no React integration layer, no component model required.
- **Small surface area:** SVG nodes and paths are straightforward to create/update with DOM APIs already used in `app.js`.
- **Maintainable for a small team:** layout is delegated to a proven library; rendering stays readable and app-specific.
- **Good enough interactivity:** click, hover, highlight, pan, and reset-view are easy with SVG.

**Trade-off**

- Adds a layout dependency that the team must learn.
- We accept a little more integration code than a fully self-contained graph widget.

### Rejected alternatives

| Option | Strength | Why not choose it here |
|---|---|---|
| **D3.js** | Maximum rendering control | Too much API surface for a small app. We would still need to own layout strategy and event architecture. |
| **dagre + d3** | Proven pairing | Good option, but D3 is more machinery than we need. Keep dagre, skip D3 unless complexity grows. |
| **Cytoscape.js** | Full graph toolkit, built-in interactions | Heavy for an embedded secondary view. Brings a graph-app mental model to a todo app. |
| **ELK.js** | Powerful layout engine | Best for complex diagrams, not this scope. Higher configuration and bundle cost than justified. |
| **Mermaid.js** | Fast declarative diagrams | Great for static documentation, weak fit for app-state-driven interaction and bidirectional selection. |
| **Canvas/custom** | High performance at scale | Harder accessibility, text rendering, and per-node DOM semantics. Overkill below ~100 tasks. |
| **Pure SVG, no library** | Smallest bundle, simplest dependency story | Layout becomes bespoke and fragile. The long-term maintenance cost is higher than the saved kilobytes. |

## Architecture

### Module split

Add a new module:

```text
index.html   # add graph host section below the task list
app.js       # owns todo state, list render, graph updates, selection state
dag.js       # graph derivation, cycle detection, dagre layout, SVG rendering
app.test.js  # unit tests for graph derivation helpers
```

### DOM placement

Insert a new section **immediately below `#todo-list`** and before the footer button to satisfy the requirement that the DAG appear below the task list.

Recommended structure:

```html
<section id="dependency-graph-section" aria-labelledby="dependency-graph-title">
  <div class="dependency-graph-header">
    <h2 id="dependency-graph-title">Dependencies</h2>
    <div class="dependency-graph-actions"></div>
  </div>
  <div id="dependency-graph" aria-label="Task dependency graph"></div>
</section>
```

### Width strategy

The list can stay constrained, but the graph should visually span the page width.

Recommendation:

- Keep the existing `.container` for the list and form.
- Style the graph section with a **viewport breakout** so it can exceed the 600px list width while still being positioned below it.
- Example intent: `width: min(1200px, calc(100vw - 2rem))`.

**Trade-off:** breakout CSS is slightly more complex than staying inside the narrow container, but it satisfies the "full width" requirement without redesigning the whole app shell.

## Data flow

### Source of truth

The graph should **not** own any data. The `todos` array remains the only source of truth.

### Derived graph model

`dag.js` should expose a pure helper:

```js
buildDependencyGraph(todos) => {
  nodes: [{ id, label, status, orderIndex }],
  edges: [{ id, from, to, kind }],
  hasDependencies,
  cycleEdges,
  stats
}
```

Mapping rules:

- **Node** = each todo `{ id, text, status }`
- **Edge** = each blocker reference in `blockedBy`
  - if todo B has `blockedBy: ['A']`, create edge `A -> B`
- `orderIndex` = current list order, used as a stable tie-breaker in layout

This keeps rendering code decoupled from the raw todo shape while preserving one-way data flow:

```text
todos -> buildDependencyGraph(todos) -> layoutGraph(graph) -> renderSvg(layout)
```

### Why derived structure is better than direct rendering from `todos`

- Separates app state from visualization concerns.
- Makes cycle detection and layout testable without the DOM.
- Keeps future graph-specific metadata out of persisted todo objects.

## Interaction model

Keep v1 intentionally modest. The DAG is a **navigation and comprehension surface**, not a second editor.

### Support in v1

- **Status color on nodes** using the same semantics as the list:
  - active = neutral
  - blocked = orange/warm background
  - done = muted gray/strikethrough
  - cancelled = muted red
- **Click node -> focus matching task row**
  - scroll into view
  - apply temporary highlight to the `<li>`
  - keep the clicked node selected
- **Hover/focus node -> lightweight tooltip**
  - full task text
  - status
  - blocker / blocked counts if useful
- **Highlight immediate neighborhood**
  - incoming/outgoing edges and connected nodes brighten
- **Pan + reset view**
  - enable only when content exceeds the viewport
  - include a visible "Reset view" control

### Explicitly not in v1

- **No drag-to-create dependencies**
  - duplicates the existing blocker picker
  - much higher complexity in plain JS
  - poor touch ergonomics
- **No free-form graph editing**
- **No force-directed animation**
- **No advanced zoom controls unless real usage proves necessary**

**Trade-off:** we give up graph-editing novelty in exchange for a smaller, more reliable feature that matches the app's simplicity.

## Integration approach

### Public API

`dag.js` should expose a small imperative interface:

```js
export function createDagView({ container, onSelectTask }) {
  return {
    update({ todos, selectedTaskId }),
    destroy()
  };
}
```

### Ownership

`app.js` remains the orchestrator:

- owns `todos`
- owns `selectedTaskId`
- calls `render()` for the list
- calls `dagView.update({ todos, selectedTaskId })` after each state change

### Event flow

```text
user changes todos in list
-> app.js mutates todos
-> saveTodos(todos)
-> render list
-> dagView.update({ todos, selectedTaskId })

user clicks node in graph
-> dag.js calls onSelectTask(id)
-> app.js sets selectedTaskId
-> app.js highlights/scolls list row
-> app.js re-renders graph with selected state
```

### Why not custom DOM events

Direct callbacks are simpler, easier to test, and consistent with the app's current single-module style. A pub/sub layer would be architecture theater at this scale.

## Layout strategy

Use **dagre** to compute a left-to-right layered layout:

- direction: `LR`
- rank separation sized for readable arrows and labels
- node ordering stabilized by current list order
- SVG rendering with rounded-rect nodes and curved arrow paths

This matches the domain model naturally:

```text
blocker -> blocked
```

The list remains primary; the graph is the dependency map.

## Empty and edge states

### No dependencies

Show a compact empty card:

- message: **No task dependencies yet**
- helper copy: **Blocked tasks will appear here when they depend on other tasks.**

Do not hide the entire section; hiding makes the feature feel inconsistent.

### One task / trivial graph

Render a single node without arrows. This confirms the feature works even before dependencies exist.

### Large graph (~100 tasks)

Behavior should shift from "always fit everything perfectly" to "provide a readable viewport":

- fixed-height viewport around `280-360px`
- auto-fit on first render
- pan when overflow exists
- clamp label width with ellipsis
- optionally render only dependency-connected nodes in the default view and provide a toggle for "show isolated tasks" if density becomes a real usability problem

**Trade-off:** we preserve performance and readability, but the overview becomes less complete at a glance on very large datasets.

### Circular references

Because cycles are currently allowed, the graph layer must detect them and fail gracefully.

Recommended behavior:

1. Detect cycles in `buildDependencyGraph()`.
2. Store the problematic edges in `cycleEdges`.
3. Remove those edges **for layout purposes only** so dagre can still place nodes.
4. Render cycle edges as **red dashed arrows** and show a small warning:
   - **"Dependency cycle detected. Layout is approximate until the cycle is removed."**

**Why this approach**

- The graph does not crash.
- Users still see the bad relationship.
- We avoid silently pretending the data is a valid DAG.

**Trade-off:** the visual layout is no longer mathematically pure when the data is invalid, but the app remains usable and honest.

## Testing guidance

Add tests for pure helpers, not SVG mechanics:

- `buildDependencyGraph()` maps `blockedBy` to edges correctly
- cycle detection identifies simple and multi-node cycles
- isolated tasks still become nodes
- list order is preserved as layout metadata

Avoid DOM-heavy snapshot tests for SVG in v1.

## Consequences

### Positive

- Preserves the current architecture: one source of truth, simple modules, no framework.
- Keeps the feature interactive without introducing a graph framework that dominates the app.
- Provides a credible path from tiny graphs to moderately large ones.

### Negative

- Adds a new dependency and a rendering subsystem.
- Requires explicit cycle handling because the data model does not prevent invalid DAGs.
- Full-width breakout styling adds some CSS complexity.

## Recommendation summary

Choose **dagre-backed SVG rendering in a dedicated `dag.js` module**.

That is the best trade-off for this project:

- smaller and simpler than Cytoscape/ELK
- more maintainable than hand-rolled layout
- more interactive and app-native than Mermaid
- more proportional to the product than turning the DAG into a full editor
# Danny Review: Dual Control of DAG UI State

**Status:** Review  
**Author:** Danny  
**Date:** 2026-03-29

## Bottom line

**VERDICT: CONTINUE**

The architecture is fundamentally sound for this app. The two bugs were not evidence that the whole design is wrong; they were evidence that one ownership boundary was violated twice.

The flat `todos` array is still the right source of truth. `app.js` is still the right orchestrator. `dag.js` is still the right place for layout and SVG rendering. The real lesson is simpler: **never let both modules control the same DOM element or the same visibility rule.**

That said, there is one boundary smell still left in the code: `app.js` imports `buildDependencyGraph()` from `dag.js` to drive section state and summary text, while `dag.js` also rebuilds the graph internally during `update()`. That is not a crisis, but it is the main remaining coupling point.

## 1. Ownership boundaries

## What is clear

Today the ownership split is mostly sensible:

- **`app.js` owns**
  - `todos`
  - `selectedTaskId`
  - `dagExpanded`
  - `dagToggleTouched`
  - task-list rendering
  - persistence
  - section-level visibility and copy:
    - `#dependency-graph`
    - `#dag-summary`
    - `#dag-empty-state`
    - `#dag-toggle`

- **`dag.js` owns**
  - deriving layout coordinates from graph data
  - rendering SVG internals
  - graph-local UI state:
    - hover
    - focus
    - pan/transform
    - reset button visibility
    - cycle warning visibility
    - tooltip visibility/content

That is the right shape.

## What was wrong

The bug happened because `#dag-empty-state` had **shared ownership**:

- `app.js` treated it as section-level UI state
- `dag.js` also treated it as view-local state

That is exactly the class of bug that repeats, because both modules can be “correct” locally and still be wrong together.

## Remaining dual-control risks

The biggest direct dual-control bug is patched, but a few risks remain:

1. **Graph container lifecycle is split across modules**
   - `app.js` controls `dagContainer.hidden`
   - `dag.js` controls `container.innerHTML`, warning, reset button, tooltip, and SVG contents
   - This is acceptable **only if** the rule stays: app owns container visibility, dag owns container contents

2. **Selection is app-owned, but dag has temporary highlight state**
   - This is okay because hover/focus are local ephemeral states, while selected task is canonical in `app.js`
   - The rule is sound, but it should stay explicit

3. **Graph-derived UI decisions live outside the graph view**
   - `app.js` computes dependency existence and stats itself
   - `dag.js` computes the same graph again
   - This is not dual DOM control, but it is split responsibility over the same derived model

So: ownership is mostly clear now, but not yet perfectly clean.

## 2. API surface

Current API:

```js
createDagView({ container, onSelectTask, emptyStateElement })
```

`update({ todos, selectedTaskId })`

## What is good

- `container` is appropriate
- `onSelectTask` is appropriate
- `update({ todos, selectedTaskId })` is appropriate for an imperative child view

## What is wrong

`emptyStateElement` should not be part of this API anymore.

Even if dag.js no longer uses it meaningfully, the parameter itself communicates the wrong contract: it implies the DAG view may participate in outer-section empty-state management. That is how teams reintroduce bugs later.

## Recommendation

The clean API should be:

```js
createDagView({ container, onSelectTask })
```

and:

```js
update({ todos, selectedTaskId })
```

That says exactly what the DAG owns: rendering inside its container, based on app-owned state.

## Does dag.js receive too much or too little?

- It currently receives **slightly too much implied responsibility** because of `emptyStateElement`
- It receives **enough actual data** for rendering
- It does **not** need ownership of section visibility, empty state, or summary text

So the answer is: **it should own less surface, not more**.

## 3. Data flow

Intended flow:

```text
todos -> buildDependencyGraph -> layout -> render
```

That is mostly true.

## What is actually happening

There are two flows:

1. **App orchestration flow**
   - `app.js` mutates `todos`
   - `app.js` computes dependency state via `buildDependencyGraph(todos)`
   - `app.js` decides whether graph section is visible/collapsed/empty
   - `app.js` calls `dagView.update(...)`

2. **DAG rendering flow**
   - `dagView.update(...)`
   - `dag.js` calls `buildDependencyGraph(todos)` again
   - `dag.js` lays out and renders

So the system is still effectively one-way in terms of truth ownership, but it is **double-derived**, not purely one-pass.

## Are there feedback loops?

There is one controlled callback loop:

```text
dag node click -> onSelectTask(id) -> app.js updates selectedTaskId -> app.js calls dagView.update(...)
```

That is fine. It is not a problematic feedback loop because:

- the DAG does not mutate `todos`
- the DAG does not mutate section visibility
- the app remains the authority

So the answer is: **one-way enough in practice**, with one acceptable UI callback loop and one unnecessary duplicate derivation.

## 4. Coupling

Coupling is **moderate**, not severe.

## Where it is nicely decoupled

- `app.js` talks to the DAG through a small imperative view object
- DAG interaction sends a simple callback upward
- The list editor and graph renderer are separate modules

## Where coupling is tighter than it should be

`app.js` imports `buildDependencyGraph()` from `dag.js`.

That means `app.js` is not only using the DAG as a view; it also depends on DAG-specific derivation logic for:

- `hasDependencies`
- graph stats
- section summary text
- expansion/collapse decisions

This makes DAG rendering less swappable than it looks.

If you replaced the DAG implementation, you would probably also need to preserve or move `buildDependencyGraph()` because `app.js` already depends on it. That is the real architectural coupling point.

## Can you swap out the DAG implementation without touching app.js?

**Not cleanly, not today.**

You could swap the SVG renderer while preserving the same exported helpers, but that is not true independence. `app.js` is coupled to graph-model derivation, not just to a rendering interface.

For a small app this is acceptable. It is not fatal. But it is real coupling.

## 5. Scale risk

For the current app size, this architecture will hold.

The bigger scale risk is not `dag.js`. It is that `app.js` is becoming the owner of:

- domain state
- persistence
- list rendering
- selection orchestration
- viewport heuristics
- section visibility rules
- graph summary logic
- graph expand/collapse policy

That is manageable now, but as more sections appear, **the risk is not “two modules both own one DOM node” so much as “the orchestrator becomes a policy dump.”**

If more UI sections are added, this app will need stricter rules like:

- parent module owns section visibility and composition
- child modules own only internal rendering and local interaction state
- derived view-model logic should live in one place, not half in parent and half in child

If those rules are followed, the architecture should scale modestly. If not, yes, you will keep reproducing dual-control bugs.

## My honest read

This is **not** a sign that the app needs a large redesign.

It **is** a sign that the team needs to treat module boundaries as contracts, not conveniences.

The empty-state bug was sloppy boundary discipline, not proof the architecture is rotten.

## Recommended next move

Because the verdict is **CONTINUE**, I am not proposing a big refactor. I am proposing one cleanup pass to finish the boundary:

### Minimal cleanup to do now

1. **Remove `emptyStateElement` from `createDagView()` entirely**
   - file: `dag.js`
   - file: `app.js`
   - reason: remove the shared-ownership affordance from the API itself

2. **Document the ownership rule in code comments or decision log**
   - `app.js` owns section visibility and summary/empty-state copy
   - `dag.js` owns rendering inside `#dependency-graph`
   - reason: prevent regression by future contributors

3. **Optionally separate graph derivation from graph rendering**
   - either move `buildDependencyGraph()` into a neutral helper module
   - or make `dagView.update()` return derived metadata if the parent needs it
   - reason: remove the current “both layers derive the same graph” coupling

That third item is a cleanup, not an emergency.

## Final verdict

**CONTINUE**

The current architecture is still the right one for this app:

- `todos` as source of truth
- `app.js` as orchestrator
- `dag.js` as derived visualization

The bugs were implementation mistakes caused by shared ownership of one DOM element. That is fixable with boundary discipline.

The remaining architectural risk is **coupling through duplicated graph derivation**, not a broken overall design. Clean that seam, and this should remain maintainable without a rewrite.
# Livingston — Embedded DAG UX Recommendations

## Goal

Add a lightweight dependency view that helps users understand blocked work without competing with the todo list. The list stays primary; the DAG is a secondary inspection and navigation surface.

## 1) Layout & positioning

### Placement

- Place the DAG **immediately below the existing footer area**, after the **"Clear finished"** button.
- Wrap it in its own section with a small top margin (`16-20px`) so it reads as a separate tool, not part of the list item stack.
- Use a section header row:
  - Title: **Dependencies**
  - Secondary helper text: **How tasks block each other**
  - Right-aligned toggle: **Show graph / Hide graph**

### Default visibility

- **Desktop / tablet:** expanded by default **only if at least one dependency exists**.
- **Mobile:** collapsed by default, even when dependencies exist.
- If there are no blocked relationships, keep the section present but show a compact empty state instead of opening a big canvas.

### Container sizing

- Use a **fixed-height viewport with internal pan/scroll**, not an infinitely growing graph.
- Recommended heights:
  - **Min:** `220px`
  - **Comfortable default:** `280px`
  - **Max on larger screens:** `360px`
- Reasoning: enough room for 2-4 layers of nodes without pushing the task list off-screen.

### Width behavior

- The DAG section should span the same full card width as the app container.
- Inside that section, the graph viewport should use the **full available width**.
- On wide screens, keep the graph roomy but visually contained with a white card and subtle border so it still matches the app.
- On narrow screens, allow horizontal panning inside the viewport rather than shrinking nodes until they become illegible.

### Recommended structure

- Footer button
- `Dependencies` section header
- Optional legend row
- Graph viewport card
- Optional hint text on mobile: **Drag to explore**

## 2) Visual design

### Overall graph style

- Implement with **SVG** rather than Canvas:
  - easier text rendering
  - easier focus states and accessibility
  - easier per-node/per-edge highlighting
- The graph sits on a **white card** with:
  - `border: 1px solid #e0e0e0`
  - `border-radius: 8px`
  - very subtle inset/background contrast against the page gray

### Node appearance

- Use **rounded rectangles**, visually echoing todo list cards.
- Node size:
  - height around `40-44px`
  - width around `140-180px`
- Internal layout:
  - single-line task label
  - optional tiny status chip or left accent strip
- Text:
  - single line with ellipsis
  - keep labels to roughly `20-24` visible characters before truncation
  - full text shown on hover/focus tooltip

### Status mapping

Match existing list semantics closely:

- **Active**
  - white fill
  - `1px` light gray border
  - normal text color `#1a1a1a`
- **Done**
  - white fill
  - gray border
  - label rendered at `opacity: 0.6`
  - strikethrough label
- **Cancelled**
  - white fill
  - muted red border or accent
  - label at `opacity: 0.5`
  - red strikethrough text using the same family as list styling (`#c0392b`)
- **Blocked**
  - warm off-white fill, aligned to `#fffbf0`
  - orange left accent or edge strip using `#e67e22`
  - slightly stronger outline than active nodes so blocked items are easy to scan

### Selected / highlighted state

- When selected from either surface:
  - blue outline/glow using `#4a90d9`
  - connected edges also turn blue
  - matching task row gets the same blue ring treatment

### Edge appearance

- Directed edges should be **left-to-right** where possible, from blocker -> blocked task.
- Use **soft curved paths** (gentle horizontal bezier curves), not rigid elbows, to keep the graph feeling lighter.
- Stroke:
  - default: `1.5px`, medium gray
  - arrowhead: small filled triangle
- Highlighted edge:
  - accent blue
  - `2px` stroke

### Relationship distinction

- **Active blocker -> blocked task**
  - edge remains medium gray or blue on highlight
  - destination blocked node carries the orange blocked styling
- **Done/cancelled task that used to block something**
  - because the app auto-cleans blockers, these relationships should generally disappear immediately
  - if transitions are animated, briefly fade the outgoing edge to light gray before removal so the change feels understandable
- Avoid persistent "historical" edges. The graph should reflect **current truth only**.

### Empty state

When no dependencies exist:

- Show a compact card around `120-140px` tall with:
  - a small simple icon or three dots connected by a faint line
  - text: **No task dependencies yet**
  - helper copy: **Blocked tasks will appear here once you link them to other tasks.**
- Keep it calm and minimal; no illustration-heavy empty state.

## 3) Interaction patterns

### Click / tap on a node

- Primary action: **scroll the corresponding task into view in the list**
- Then:
  - apply a temporary highlight pulse to the list row
  - keep the node selected in the graph
- This makes the DAG a navigation layer, not a second editor.

### Hover / focus behavior

- On hover or keyboard focus:
  - show tooltip with full task text and status
  - highlight the node's incoming and outgoing edges
  - lightly dim unrelated nodes/edges only if the graph is moderately dense
- For small graphs (most likely in this app), avoid aggressive dimming; just highlight the neighborhood.

### Creating dependencies in the DAG

- **Do not create dependencies by dragging between nodes in v1.**
- Reasons:
  - high implementation cost in vanilla JS/SVG
  - easy to misfire on touch
  - duplicates the existing blocked-by picker, which is clearer and already aligned with the data model
- Keep dependency editing in the list UI.
- If future enhancement is needed, prefer a deliberate **"Add dependency" mode** over always-on drag linking.

### Pan / zoom

- **Pan:** yes, if the graph exceeds the viewport.
  - desktop: click-drag blank space to pan
  - touch: one-finger drag to pan
- **Zoom:** minimal support only.
  - desktop: +/- buttons or `Ctrl/Cmd + wheel`
  - touch: optional pinch zoom, but only if easy to implement cleanly
- For this small app, do not overbuild. A better default is:
  - auto-fit graph on render
  - small **Reset view** control
  - modest zoom range (e.g. `80%-140%`)

### Keyboard accessibility

- Every node should be tabbable.
- On focus:
  - visible blue focus ring
  - tooltip/info mirrored in accessible text
- Keyboard actions:
  - `Enter` / `Space`: select node and scroll to task
  - arrow keys: optional movement to nearest node in that direction if practical; if not, tab order is acceptable for v1
- The show/hide control must be a real `<button>` with `aria-expanded`.
- The graph region should have an accessible name, e.g. `aria-label="Task dependency graph"`.

## 4) Sync with task list

### Data changes

When a task is added, removed, or its status changes:

- Recompute the graph from the todo array immediately after the list re-renders.
- Animate lightly:
  - new node: fade + slight upward ease-in
  - removed node/edge: fade out
  - changed node status: color transition `150-200ms`
- Avoid force-directed motion or large relayout animations; they will feel noisy in a small productivity tool.

### Reordering in the list

- Drag-reordering the list **should not change graph structure**, because order is not semantic for dependencies.
- However, if the app currently uses list order as a stable input for vertical node ordering, it is fine for the DAG layout to reshuffle slightly after reorder.
- Recommendation: preserve node ordering by current list order where possible, because that helps users mentally map the graph back to the list.

### Bidirectional highlighting

- **Click task row -> highlight node**
  - if a task is clicked/focused in the list, briefly reveal and emphasize its node in the graph
  - if the graph is collapsed, do not auto-expand on every row click; that would be noisy
- **Click node -> highlight task row**
  - scroll row into view
  - apply temporary blue highlight
- Keep only one selected task/node pair at a time.

## 5) Responsive behavior

### Mobile

- The DAG is still useful, but only as a secondary, on-demand view.
- On phones:
  - collapse by default
  - keep viewport height near `220px`
  - support horizontal and vertical panning
  - simplify labels sooner (more aggressive truncation)
  - show a tiny hint: **Tap a node to jump to the task**

### Minimum useful width

- Below roughly **360px viewport width**, the DAG becomes inspection-only rather than overview-friendly.
- Below that threshold:
  - keep it collapsed by default
  - open into a fixed-height pannable viewport
  - do not try to fit the whole graph at once
- The DAG becomes meaningfully comfortable around **480px+**.

## Practical recommendation for v1

If the team wants the best effort-to-value ratio in vanilla JS + SVG:

1. Add a **collapsible Dependencies section below the footer**
2. Render an **SVG graph in a fixed-height white card**
3. Use **rounded rectangle nodes** that mirror todo cards
4. Support **selection, tooltip, bidirectional highlighting, and panning**
5. Skip dependency creation, advanced zoom gestures, and complex animations for now

This keeps the DAG useful, visually coherent with the app, and realistic to build without turning a small todo app into a graph editor.
# Rusty — DAG Implementation Notes

**Status:** Proposed  
**Author:** Rusty  
**Date:** 2026-03-29

## Summary

Implemented the embedded dependency graph as a dedicated `dag.js` module using `dagre` for layout and native SVG for rendering.

## Key implementation choices

- Kept `todos` as the only source of truth and derived graph nodes/edges from `blockedBy` on every update.
- Added DFS-based cycle detection inside `buildDependencyGraph(todos)` and removed cycle edges from the dagre layout input so the layout engine keeps working.
- Rendered cycle edges separately as dashed red arrows with a warning banner so bad data remains visible without breaking the view.
- Kept the graph read-only. Node activation only navigates back to the matching list row and applies selection/highlight state.
- Synced list-row selection and graph-node selection through `selectedTaskId` owned by `app.js`.
- Used a breakout-width section below the footer so the graph can breathe without redesigning the existing 600px list layout.
- Defaulted the graph to collapsed on mobile and to expanded on larger screens only when real dependency edges exist.

## Consequences

- The graph stays proportional to the rest of the app and does not introduce a heavier graph-editing interaction model.
- Cycle handling is explicit and resilient, but the layout is only approximate while cyclic data exists.
- The new `dag.js` module is reusable for further DAG-only tests without coupling graph logic to DOM rendering.
# Saul Restructure Review

## Verdict: REJECT

The split is directionally better: imports resolve, `index.html` points at `/src/main.js`, `vite.config.js` is valid for the new layout, ownership comments are present, and the old flat files (`app.js`, `dag.js`, `graph.js`, `app.test.js`, `dag.test.js`) are no longer sitting at the repo root.

`npm test` and `npm run build` both pass, but this cannot ship yet. There are three blocking frontend issues:

1. **`src/main.js:161,179,232,269,280,357` — runtime crash on every mutating action**  
   `saveTodos(todos, defaultStorage, STORAGE_KEY)` is called repeatedly, but `defaultStorage` is neither defined in `main.js` nor imported from `src/todo/model.js`. In the browser this throws `ReferenceError: defaultStorage is not defined` the first time the user changes status, deletes, adds, clears, or reorders a task.  
   **Fix owner:** Rusty (or another implementation agent, not reviewer).  
   **Fix:** either call `saveTodos(todos, undefined, STORAGE_KEY)` / `saveTodos(todos)` and rely on the model default, or explicitly export/import a storage adapter from the correct layer.

2. **`src/todo/model.js:128-130` — model boundary violation**  
   `isMobileViewport()` reaches into `window.matchMedia`. That makes the todo model impure and violates the requested boundary for this file (“pure todo logic, no DOM references”). Viewport detection belongs in `main.js` or in a small UI/environment utility module, not in the domain model.  
   **Fix owner:** Rusty (or another implementation agent, not reviewer).  
   **Fix:** move viewport/media-query logic out of `src/todo/model.js`; keep this module purely about todo data, storage, and mutations.

3. **`src/dag/view.js:152-156` with `src/dag/view.js:337-343` — broken accessibility contract**  
   The SVG is marked `aria-hidden="true"`, but its child nodes are focusable interactive controls (`tabindex="0"`, `role="button"`, keyboard handlers). That hides the graph from assistive tech while still leaving keyboard stops in place — a bad accessibility regression.  
   **Fix owner:** Rusty (or another implementation agent, not reviewer).  
   **Fix:** either make the graph truly decorative/non-interactive, or remove `aria-hidden`, give the graphic an accessible name/description, and keep the node controls exposed properly.

## Notes

- `src/dag/graph.js` is clean and neutral; good boundary there.
- `src/todo/model.test.js` and `src/dag/graph.test.js` are thorough, but the current suite did not protect against the `main.js` runtime regression, so one light integration/UI-path test would pay for itself.
- CSS in `index.html` is generally clean enough for this app and the script path is correct.

Do the three fixes above, then send it back for another review pass.
# Saul Restructure Re-review

## Verdict: APPROVE

Livingston closed the three blockers I raised.

1. **`src/main.js` — `defaultStorage` crash is gone**
   - Verified there are no `defaultStorage` references left in `main.js`.
   - All persistence calls now use `saveTodos(todos)` and rely on the model defaults, so the previous `ReferenceError` path is gone.

2. **`src/todo/model.js` — viewport logic moved out**
   - `isMobileViewport()` now lives in `src/main.js`.
   - `model.js` no longer reaches into `window`, `document`, or `matchMedia`.
   - The file is back to todo data/storage concerns and mutation helpers. The only browser-facing piece left is the existing `localStorage` adapter, which is still injectable for tests and not a new boundary problem from this restructure.

3. **`src/dag/view.js` — accessibility contract repaired**
   - The SVG no longer uses `aria-hidden`.
   - It now exposes `role="img"` with `aria-label="Task dependency graph"`.
   - Interactive nodes remain keyboard reachable with `tabindex="0"` / `role="button"` and per-node labels, which is the correct direction for an interactive graphic.

## Quick pass for regressions

- I did not find any new blocker introduced by these fixes.
- `npm test` passes (`88` tests).
- `npm run build` passes.

This is in shape to ship.

---

## README Style & Tone Decision

**Status:** Proposed for team review  
**Author:** Basher (Technical Writer)  
**Date:** 2026-03-29

### Summary

The README.md for bumbledo uses a playful, conversational tone that matches the project's brand while remaining professional and practical. This document codifies the style choices for consistency in future documentation.

### Style Choices

#### 1. **Emoji Usage**

- **Section headers only** — One emoji per major section (Features, Getting Started, etc.)
- **Minimal in body text** — Emoji in tables/lists only when they add meaning
- **Rationale:** Makes scanning easier without feeling gimmicky; respects the playful "bumbledo" brand name

#### 2. **Tone**

- **Conversational, not technical** — "Just open it and start organizing" vs. "Initialize the application environment"
- **Action-focused** — Features describe what users *do*, not implementation details
- **Honest** — Known Limitations section explicitly lists trade-offs
- **Friendly** — "Made with ❤️" footer, playful tips & tricks section

#### 3. **Organization**

- **Progressive disclosure** — Quick start first, then how-to guides, then deep tech
- **Multiple entry points** — "Try It Now" (easiest), "Development Setup" (developers), "How It Works" (curious users)
- **Scannable** — Lots of headers, short paragraphs, tables for options

#### 4. **Examples**

- **JSON data format** — Shows actual localStorage structure (helpful for developers)
- **Bash code blocks** — Dev commands clearly labeled with comments
- **Tables for states/options** — Better than prose for reference

#### 5. **Link Targets**

- Link to PRD.md for "full feature scope"
- GitHub URL for issues/PRs
- Author GitHub profile in footer

### Decisions for Future Documentation

1. **Changelog.md** — Same conversational tone, but more technical (mentions impl details)
2. **API docs** — JSDoc comments in source code; link from README to specific modules
3. **Architecture docs** — Can be more technical; assume reader is developer
4. **In-app empty states** — Match README friendliness; "No todos yet. Add one above!"

### Rationale

Bumbledo is a *user-first* project. People download it to *use* it, not to study its code. The README should meet them where they are:
- Non-technical user? → "Just open index.html"
- Developer? → "npm install && npm run dev"
- Curious about dependencies? → "See Dependencies graph"

A playful, action-focused tone builds trust and makes the app feel approachable.

### Acceptance Criteria

✅ README.md deployed and live  
✅ Tone consistent throughout  
✅ Multiple entry points for different user types  
✅ Emoji used sparingly (not overdone)  
✅ Known limitations listed (transparency)  

**Next steps:** Danny reviews for accuracy; Rusty/Saul sign off if UI copy needed adjustment.

---

## README Simplification Decision

**Status:** Accepted  
**Author:** Basher (Technical Writer)  
**Date:** 2026-03-29  
**Requested by:** Vladi Lyga

### Summary

Simplified README.md for a self-explanatory app. Removed redundant explanations, eliminated state-coloring documentation, and reduced from ~235 to 129 lines (~45% reduction).

### Changes Made

1. **Removed state coloring table** — Users learn states from UI, not docs
2. **Collapsed "How It Works"** — Replaced multi-subsection breakdown with 6-bullet "Quick Start"
3. **Removed Project Structure** — Internal architecture can be explored in code
4. **Condensed Data Persistence** — Collapsed 25 lines → 1 sentence explaining localStorage trade-off
5. **Merged Accessibility + Browser Support** — Combined into single 3-line section
6. **Trimmed Tips & Tricks** — Kept only essential keyboard + offline hints
7. **Cleaned up Known Limitations** — One-liner instead of bulleted list

### Rationale

- **User feedback:** App is simple and mostly self-explanatory
- **Brand match:** Light, scannable, fun matches "bumbledo" tone
- **Principle:** Let UI teach; docs support, don't repeat
- **Priority:** Essential sections preserved (features, getting started, tech stack, license)

### What Stayed

- Project name & tagline
- Features list (brief, user-focused)
- Getting Started (try now + dev setup)
- Tech Stack table
- License
- Contributing & author credit

### Impact

- Readers now get value faster
- README is memorable (fits on screen)
- Less burden on docs to explain obvious UI
- Brand voice is lighter and more playful

### Acceptance Criteria

✅ README.md updated and validated  
✅ Reduction target achieved (~45%)  
✅ State-coloring section removed  
✅ Essential content preserved  
✅ Brand tone maintained

---

## ADR-007: PRD Architectural Alignment

**Status:** Accepted  
**Author:** Danny, Basher  
**Date:** 2026-03-29  
**Requested by:** Vladi Lyga

### Summary

The implementation honors the core PRD specification (all 10 user stories, task states, blocking logic, persistence, accessibility) but violates three stated technical constraints and includes a fully-implemented dependency graph visualization feature that is absent from the PRD.

**Audit findings:**
1. ✅ All user stories fully implemented and passing
2. ❌ Uses Vite + npm (PRD forbids build tools)
3. ❌ Modular src/ structure (PRD requires single HTML file)
4. ❌ dagre dependency (PRD forbids external packages)
5. 🆕 Full DAG visualization system (completely absent from PRD but fully functional)

### Architectural Trade-Off Analysis

**Original PRD Vision:**
- Goal: Zero-friction todo app — download one HTML, open in browser, start using
- Trade-off accepted: Minimal features, monolithic code, no build setup
- Target user: Anyone with a browser

**Current Implementation:**
- Goal: Feature-rich todo app with task dependency visualization and modular architecture
- Trade-off accepted: Requires npm setup, modular code, external dependency
- Target user: Developers or users running through dev server/build artifact

### Decision Made

**Chosen Option: Update PRD to match implementation** (recommended by Danny, executed by Basher)

**Rationale:**
- DAG visualization is well-executed and genuinely useful (not over-engineering)
- Modular architecture is proportional to codebase complexity and enables testing
- Separation of concerns (model, view, dag) makes changes safer
- Users receive a built artifact, not raw source, so Vite/npm setup is transparent
- Easier and lower-risk to document the current system than regress features
- Build step is developer-only; end users never see it

### Changes Made to PRD.md

1. **Section 1 (Overview):** Added dependency graph visualization to headline
2. **Section 2 (Goals):** Rewrote to remove single-file constraint; added dependency graph as explicit goal
3. **Section 2 (Non-Goals):** Removed "No build step, bundler, or package manager"
4. **Section 6 (Technical Constraints):** Completely rewritten:
   - Changed "Single file" → "Architecture: modular ES modules in src/"
   - Added "Build tools: Vite + npm" with dev workflow details
   - Changed "No external dependencies" → "Only dagre for graph layout"
5. **Section 7 (NEW):** Added "Dependency Graph Visualization" with full feature documentation:
   - Cycle detection with visual indicators (dashed red edges)
   - Interactive nodes: pan, zoom, selection, neighbor highlighting
   - Keyboard navigation (Tab, Enter/Space)
   - Display behavior: desktop-default, mobile-hidden (<480px)
   - Bidirectional selection: graph node ↔ task row
6. **Section 8 (Out of Scope):** Updated to remove outdated constraints

### Consequences

- ✅ PRD now accurately describes the shipped product
- ✅ Architectural evolution is documented and justified
- ✅ Future team members understand the trade-offs made
- ✅ No feature regression required
- ✅ Modular architecture enables continued feature development
- ⚠️ Build setup adds friction for casual users (acceptable: target audience changed to developers)

---


---

## 2026-03-29T16:47:46Z: User directive — Saul reviews Rusty's work

**By:** Vladi Lyga (via Copilot)

**What:** Saul must review all of Rusty's implementation plans BEFORE implementation begins, and also review the code AFTER it is written. Two-gate review process for Rusty's work.

**Why:** User request — captured for team memory

**Status:** Active

---

## 2026-03-29T16:47:46Z: User directive — Branch & PR workflow

**By:** Vladi Lyga (via Copilot)

**What:** Every code change, feature, or bug fix must be done in a new branch and pushed via PR. No direct commits to main.

**Why:** User request — captured for team memory

**Status:** Active

---

## 2026-03-29T17:31:00Z: Feature PRDs Created (Smart Blocked Alerts, Keyboard Shortcuts, Burndown View)

**Status:** Accepted  
**Author:** Tess (PM)  
**Date:** 2025-07-18  
**Related:** Product learnings session on todo app space (2025-07-17)

### Summary

Three feature PRDs have been authored based on product learnings from the todo app competitive landscape. These features address specific user pain points identified in market research: clarity (Smart Blocked Alerts), power-user efficiency (Keyboard Shortcuts), and progress visibility (Burndown View).

### Features

1. **Smart Blocked Alerts**
   - **File:** `PRD-smart-blocked-alerts.md`
   - **Rationale:** Turns the dependency DAG from a passive visual into an active planning tool by proactively surfacing newly unblocked tasks
   - **User Impact:** Reduces context loss after completing a blocker; maintains workflow momentum
   - **Technical Scope:** Builds on existing `blockedBy` data; no new fields

2. **Keyboard Shortcuts**
   - **File:** `PRD-keyboard-shortcuts.md`
   - **Rationale:** Empowers power users with frictionless task manipulation; rewards expertise without alienating casual users
   - **User Impact:** Enables rapid capture and state toggling; appeals to developers and keyboard-first planners
   - **Shortcut Set:** 6 core shortcuts (add, navigate, toggle, delete, help)

3. **Burndown View**
   - **File:** `PRD-burndown-view.md`
   - **Rationale:** Provides motivational progress visibility by tracking active task count over 30 days
   - **User Impact:** Gives users confidence in progress; helps spot personal work patterns
   - **Data Model:** New localStorage key `"todos_burndown"` for daily samples

### Positioning Rationale

These three features align with bumbledo's **"trust-first planning for makers"** positioning:

1. **Smart Alerts** strengthen the **clarity moat** (show dependencies, not just visualize them)
2. **Keyboard Shortcuts** attract **power users** (makers optimize for speed)
3. **Burndown View** address **progress anxiety** (transparent, visible, local)

All three work with the existing dependency DAG, respect the localStorage-only constraint, and avoid backend complexity.

### Next Steps

- Danny reviews PRDs for technical feasibility
- Team discusses priority and sequencing
- Features are broken down into tickets and estimated

### Non-Decisions

- These PRDs are feature exploration, not commitments
- Priority order TBD (needs team discussion)
- Implementation approach deferred to Danny (architecture/design)

---

## 2026-03-29T17:22:19Z: User directive — GitHub account

**By:** Vladi Lyga (via Copilot)

**What:** Always make sure you are working with the `lygav` GitHub account. Verify `gh auth status` shows `lygav` before any GitHub operations.

**Why:** User request — captured for team memory

**Status:** Active

### 2026-03-29T17:54:23Z: User directive — Product space
**By:** Vladi Lyga (via Copilot)
**What:** Our product space is personal productivity
**Why:** User request — captured for team memory. Tess and all agents should frame features, personas, and competitive analysis within the personal productivity space.


# Danny — PR #5 Review: Actionable Now

**Date:** 2026-03-29  
**Status:** Approved

## Decision

Approve PR #5. The implementation fits the current app architecture, keeps the filter as derived UI state instead of polluting the todo model, and preserves the established single-source-of-truth rule around the full `todos` array.

## Why

- `getActionableTodos()` and `getActionableCount()` are correctly placed in `src/todo/model.js` as pure derivation helpers.
- `src/main.js` integrates the filter into the render pipeline without changing ownership boundaries: main remains the orchestrator, the model remains pure, and the DAG continues to read the full list.
- Filtered drag-and-drop uses the right projection strategy: reorder the visible active subset, then write that sequence back into the active positions of the full list so hidden tasks retain their original placement.
- The PRD edge cases are covered in behavior: auto-unblocked tasks reappear, status changes remove tasks from the filtered view immediately, and the empty state distinguishes “no todos” from “no actionable todos”.

## Trade-offs

- Render now performs two lightweight scans of the todo list (`getActionableCount()` and `getActionableTodos()`). That is acceptable for the current scale and keeps the code easy to read.
- The biggest remaining risk area is filtered drag-and-drop verification. The implementation looks correct, but there is no direct automated test around the index remapping in `main.js`.

## Follow-up (non-blocking)

- Add a focused integration test around filtered drag-and-drop remapping if the team touches this area again.


# Danny — PR #6 Review Notes

**Date:** 2026-03-29  
**Status:** Proposed

## Decision

Keyboard shortcut state must stay aligned with what is visible and focusable in the UI. If a shortcut changes a selected task so it disappears from the current filtered view, the app must either move selection to the next visible task or clear selection; it must not keep an off-screen `selectedTaskId`.

Global shortcuts must also respect editable surfaces before acting, unless a shortcut is explicitly designed to be global. A document-level listener is acceptable here, but only if input fields, inline edit controls, selects, and contenteditable regions are consistently guarded.

## Why

The current PR introduces a split contract: the render layer treats hidden items as unselected, but the keyboard handler can immediately restore selection to an invisible todo after toggling status under the Actionable filter. That makes Enter/Delete act on an item the user can no longer see, which is a real UX and correctness bug.

The PR also adds tested model helpers for cycling and navigation, but the runtime does not use them. The trade-off is clear: isolated pure helpers are easy to test, but if the UI keeps separate inline logic, the tests no longer prove the feature works end to end.

## Review Outcome

- **Reject PR #6 for now**
- Required fixes:
  1. Make filtered selection transitions explicit after status toggles and deletes.
  2. Move editable-surface guards ahead of non-global shortcuts like Escape, or narrow Escape behavior so it does not interfere with active text inputs.
  3. Either wire `cycleStatus` / navigation helpers into `main.js`, or remove them and add tests around the actual integration path instead.


# Rusty — Burndown Rendering Note

- **Decision:** Render burndown lines from the stored daily samples as cumulative maxima for `completed` and `total`, instead of plotting the raw daily counts directly.
- **Why:** This app allows users to clear finished tasks from the live todo list, which can make later raw samples smaller than earlier ones. Using monotonic rendered series preserves the PRD's promise that both burndown lines stay non-decreasing and keeps the chart motivational instead of visually "losing" progress.
- **Impact:** Sampling still stores the raw `{ date, done, cancelled, active, total }` snapshot requested by the PRD. The chart and its summary derive display values from those samples so the visible trend remains stable and honest over time.


# Rusty — Keyboard Shortcuts Implementation Notes

**Date:** 2026-03-29  
**Status:** Proposed for log

## Decision

Treat keyboard shortcuts as view-layer orchestration in `src/main.js`, while keeping any reusable state-transition or list-navigation rules in `src/todo/model.js` as pure helpers.

## Why

- Shortcut activation depends on DOM context: whether the user is typing, whether help is open, and which visible row is selected. That belongs in the orchestrator, not the model.
- The actual status cycling and next/previous-item lookup are still useful as pure functions for tests and future UI surfaces, so they stay in the model.
- Visible-list navigation must respect the actionable filter rather than the raw todo array, otherwise keyboard selection drifts from what the user can see.

## Consequences

- Future shortcut work should extend `main.js` event handling first, then add pure model helpers only when logic is reusable beyond one DOM listener.
- Any filtered view added later needs keyboard navigation to operate on that filtered projection, not the full backing list.


# Saul PR #6 fixes

- Fixed Enter-toggle selection handling in `src/main.js` so keyboard selection never stays on a todo that becomes hidden by the actionable filter; it now moves to the next visible row, falls back to the prior visible row at the end of the list, or clears selection when nothing remains.
- Reordered global `keydown` Escape handling so help-modal close always wins, edit-mode Escape cancels inline editing before deselection logic, and non-editable Escape still clears the current keyboard selection.
- Added modal focus restoration by saving `document.activeElement` before opening the shortcuts help modal and restoring focus to that element on close.


# Decision: Actionable Now PRD Created

**Author:** Tess  
**Date:** 2025-07-19  
**Status:** Proposed  
**Affects:** PRD-actionable-now.md, task list UI, localStorage (new key)

---

## Summary

Created `PRD-actionable-now.md` — a new feature PRD for a filtered view that shows only unblocked, active tasks. This is bumbledo's 4th feature PRD alongside Smart Blocked Alerts, Keyboard Shortcuts, and Burndown View.

## Context

Every persona opens bumbledo to answer: "What can I actually do right now?" The default list mixes actionable tasks with blocked, done, and cancelled items. Users mentally filter every time. This was the #1 gap identified in the persona review — Priya, Daniel, Jake, and Marco all have the same core need in different life contexts.

## Decision

- **Toggle filter** on the task list: "Actionable" on/off. Not a separate page.
- **Filter logic:** Show only tasks with `status === "active"`. Leverages ADR-001's auto-unblock — no custom blocker-walking needed.
- **Count summary:** "N of M tasks are actionable" — always visible, updates in real time.
- **Persistence:** New localStorage key `"bumbledo_filter_actionable"` — separate from todo data, no migration.
- **Interactions:** Drag-and-drop works on visible items only; DAG always shows full graph; burndown unaffected; clear finished operates on full list.

## Rationale

1. Simplest high-impact feature — every persona wants it, implementation is lightweight
2. Builds on existing auto-unblock logic (ADR-001) — no new data model changes
3. Toggle approach preserves the "one list" mental model — users aren't navigating between views
4. localStorage preference avoids daily re-toggling friction

## Impact

- Danny: New UI toggle, list filtering logic, localStorage read/write for preference, filtered drag-and-drop behavior, actionable-specific empty state
- No changes to existing data model or storage schema
- Complements Smart Blocked Alerts (alerts = "when"; Actionable Now = "what")


# Decision: Burndown Chart Metric Change

**Author:** Tess  
**Date:** 2025-07-18  
**Status:** Proposed  
**Affects:** PRD-burndown-view.md, todos_burndown localStorage schema

---

## Summary

Changed the burndown chart's core metric from **single-line "active task count per day"** to **dual-line "cumulative completed vs. cumulative total"**.

## Context

Vladi identified that tracking active task count is a net metric. When users add tasks faster than they complete them, the chart goes up — hiding real progress and demoralizing the user. Example: complete 10 tasks, add 20 → chart shows +10 (looks like failure, but 10 tasks were actually done).

## Decision

- **Primary line ("Completed"):** Cumulative count of done + cancelled tasks. Always non-decreasing. Shows output.
- **Secondary line ("Total"):** Cumulative count of all tasks ever created. Always non-decreasing. Shows scope.
- **Gap between lines** = remaining active work.
- **Summary display:** "X of Y done (Z%) · N remaining"

## localStorage Schema Change

Old: `{ date, count }` (just active count)  
New: `{ date, done, cancelled, active, total }` (full state snapshot)

## Rationale

1. Cumulative completed always goes up → motivational, never punishing
2. Scope growth is visible but separate → honest, not demoralizing
3. Richer snapshots future-proof us for done/cancelled breakdowns later
4. Gap between lines gives "remaining work" at a glance without a separate metric

## Impact

- Danny: Data collection logic changes (sample all state counts, not just active)
- Danny: Chart rendering changes (two lines, summary text, tooltip updates)
- No breaking changes to existing localStorage (new key, additive)



# Decision: Evolutionary Architecture Refactor Recommended

**Author:** Danny  
**Date:** 2026-03-30  
**Status:** Recommended  
**Affects:** src/main.js, index.html, project structure, state management

---

## Summary

Complete architecture review of codebase completed. Verdict: refactor warranted, but this is a boundary cleanup, not a framework rewrite. Keep vanilla JS + Vite stack and strengthen module boundaries before the next feature wave.

## Current State Assessment

**Strengths:**
- Sensible module split around three concerns: todo model, graph, notification
- Pure domain modules (`src/todo/model.js`, `src/dag/graph.js`) are solid and testable
- Consistent controller/factory pattern proven in DAG and notification features
- Minimal dependencies (only `dagre` at runtime)
- Strong test coverage (193 tests passing)
- Production build succeeds

**Critical Hotspots:**
- `src/main.js`: 1820 lines — orchestrates domain flow, DOM rendering, keyboard behavior, drag/drop, charting, persistence, modal management, and selection
- `index.html`: 1770 lines — mixes markup, all styles, and app bootstrap in one file
- Status vocabulary and display mapping duplicated across `model.js`, `main.js`, and `dag/view.js`
- Full list re-renders on each update; per-row listeners wired on every render cycle

**Trend:**
Code is trending toward brittle — two files now carry most change risk. Feature velocity and consistency will degrade without boundary work.

## Recommended Refactoring (Priority Order)

### Do First (Critical Path)
1. **Break up `src/main.js` into feature controllers/renderers**
   - Extract `src/todo/list-view.js` or `src/todo/list-controller.js`
   - Extract `src/burndown/view.js`
   - Extract `src/ui/modals.js`
   - Extract `src/ui/keyboard.js`
   - Extract `src/todo/reorder.js`
   - Keep `src/main.js` as composition root

2. **Move CSS out of `index.html`**
   - Create `src/styles.css` imported from `src/main.js`
   - Later: split into feature styles (`base.css`, `todo.css`, `burndown.css`, `dag.css`, `modal.css`)

3. **Create shared constants module**
   - Centralize status vocabulary, labels, palette, storage keys
   - Replace duplicated mappings across modules

4. **Introduce lightweight app store/action layer**
   - Formalize mutations as named commands: `addTask`, `setTaskStatus`, `deleteTask`, `toggleBlocker`, `reorderTasks`, `toggleReadyFilter`
   - Derive computed values with selectors instead of ad hoc recalculation
   - Centralize persistence as post-action effect

### Do Next (Infrastructure)
5. Consolidate persistence side effects behind action layer
6. Reduce full-list re-renders; prefer event delegation where possible
7. Add ESLint, formatter, and CI guardrails

### Can Wait (Growth Phases)
8. Further split `src/dag/view.js` if graph behavior expands
9. Any framework migration discussion

## Why Not a Framework Migration?

The quality issue is not framework choice; it's missing boundaries. The code already proved that local controller boundaries work well (DAG, notifications). Reusing that pattern is lower-risk than introducing React or another framework. The dependency profile is already healthier than the internal boundary profile.

## Consequences

- Feature work now has a clear refactoring path that preserves current stack
- New features should target the extracted feature modules, not `main.js`
- App-level behavior changes must go through the action layer
- Styling changes should land in feature-specific CSS files
- Build and test infrastructure should be strengthened (ESLint, CI)

## Decision

Refactor now using evolutionary approach. Preserve vanilla JS + Vite, strengthen module boundaries, remove the two oversized hotspots before more features land.

---

## ADR-004: Seven-Issue Refactor Breakdown

**Status:** Accepted  
**Author:** Danny  
**Date:** 2026-03-30T09:22:00Z

### Summary

Decomposed the architecture refactor recommendations (from 2026-03-30 architecture review) into seven implementation-ready GitHub issues with explicit dependencies, sequencing, and team assignments. Avoids framework rewrite; preserves vanilla JS + Vite.

### Decision

**Break refactoring work into seven dependency-ordered issues rather than one monolithic task.**

| Issue | Title | Assignee | Dependencies |
|-------|-------|----------|--------------|
| #59 | Create shared app constants module for status, palette, and storage keys | Rusty | — |
| #60 | Extract inline app styles from `index.html` into `src/styles.css` | Rusty | #59 |
| #61 | Split `src/main.js` into feature controllers with `main.js` as composition root | Saul | #59 |
| #62 | Introduce a lightweight app store and named action layer | Saul | #61 |
| #63 | Route todo and burndown persistence through post-action effects | Rusty | #62 |
| #64 | Use delegated list events instead of per-row listener wiring | Rusty | #61 |
| #65 | Add ESLint, formatter, and GitHub Actions CI guardrails | Danny | #59–#64 |

### Rationale

A single large issue hides critical dependency edges and makes parallel execution unsafe. Seven issues create explicit seams:

1. **Establish vocabulary and boundaries first** (#59, #60): Create constants module and move styles out of HTML
2. **Extract feature modules and state orchestration** (#61, #62): Break up `main.js`, introduce store/actions
3. **Tighten persistence and DOM event wiring** (#63, #64): Route effects through actions, use event delegation
4. **Lock it down** (#65): Add tooling guardrails to prevent future drift

This sequencing staggers the work across team members while keeping blockers minimal and dependencies clear.

**Trade-off:** More up-front project management overhead. Justified because the architecture risk is concentrated in shared boundaries (`main.js`, `index.html`). Unclear sequencing would create rework across contributors.

### Assignments

- **Rusty:** #59, #60, #63, #64 (constants, styles, persistence, events)
- **Saul:** #61, #62 (controllers, store)
- **Danny:** #65 (tooling)

### Consequences

- Team now has implementation-ready work with explicit ownership and acceptance criteria
- Dependencies are explicit enough to stage refactor safely without a framework freeze
- Future architecture decisions can reference concrete issue numbers
- Work begins with Rusty on #59 (constants extraction)
