---
name: "Evolutionary Refactoring"
description: "Break a monolithic module into composed feature controllers without framework migration, by fixing boundaries first and moving behavior incrementally."
domain: "refactoring, architecture, module-composition"
confidence: "high"
source: "earned"
---

## Context

This pattern emerged when `src/main.js` grew to 1821 lines—combining DOM initialization, event listeners, state mutations, persistence, and 5+ feature areas (todos, reordering, modals, keyboard, burndown, DAG) into a single file.

**The challenge:** Refactor into modules without:
- Rewriting in a different framework
- Breaking existing test coverage
- Introducing circular dependencies
- Losing access to shared state

**The insight:** Focus on behavioral boundaries first, not code organization or framework choices. The framework follows the architecture, not the other way around.

## Patterns

### 1. Fix Architectural Boundaries Before Moving Code

Before extracting modules, identify clean seams in responsibility:
- **Todo list rendering & row events** → `src/todo/list-view.js`
- **Drag/touch reorder state** → `src/todo/reorder.js`
- **Modal lifecycle & focus return** → `src/ui/modals.js`
- **Global keyboard shortcut routing** → `src/ui/keyboard.js`
- **Burndown chart rendering & toggle** → `src/burndown/view.js`
- **Shared UI: status pill rendering** → `src/ui/status-metrics.js`

**Do not** extract by code type (helpers, utilities, constants) first. Extract by feature domain.

### 2. Keep the Composition Root as Orchestrator

Preserve a single `src/main.js` that:
- Owns canonical application state (todos, selection, filter, UI toggles, burndown samples, DAG expansion)
- Instantiates the store once
- Wires all controllers together via explicit dependency injection (callbacks, not globals)
- Coordinates cross-feature effects (persistence, notifications, confetti, DAG sync)

The composition root remains the source of truth for how features interact:
```js
// src/main.js — the orchestrator
const store = createAppStore();
const listView = createListView(todoContainer, {
  onAddTodo: (title) => store.dispatch('addTodo', title),
  onRemoveTodo: (id) => store.dispatch('removeTodo', id),
  onSelectTodo: (id) => store.dispatch('setSelectedTodoId', id),
  /* ...other callbacks... */
});
const reorder = createReorder(todoContainer, { onReorder: (ids) => store.dispatch('setTodoOrder', ids) });
const keyboard = createKeyboard(document, { onCreateTodo: () => {/* ... */} });
```

### 3. Move Behavior Incrementally, One Feature at a Time

Don't refactor the entire file at once. Extract in order of independence:
1. **Isolate self-contained features first** (reorder, keyboard) — they have fewer cross-feature dependencies
2. **Extract shared rendering** (status-metrics) — used by multiple features, no state mutations
3. **Move state-aware controllers last** (list-view) — depend on store and may have complex event flows

Keep tests passing between each extraction. Commit after each feature controller is wired.

### 4. Never Move the Store or Persistence Logic

State management and persistence stay in the composition root or a dedicated `src/app/` directory:
- `src/main.js` — DOM wiring + orchestration
- `src/app/store.js` — state mutations + action dispatch
- `src/app/selectors.js` — derived state
- `src/app/constants.js` — shared constants

**Why:** Controllers must remain reusable. If they own persistence or instantiate the store, they're locked to this app.

### 5. Use Explicit Callbacks, Not Globals

Controllers never access the store directly or import each other. Instead:
```js
// ✅ Reusable: controller takes callbacks as config
createListView(container, {
  onAddTodo: (title) => { /* ...*/ },
  onRemoveTodo: (id) => { /* .../* },
  todos: visibleTodos,
});

// ❌ Not reusable: controller imports store
import { store } from './app/store.js';
export function createListView() {
  store.dispatch('addTodo', ...); // Hard to test, hard to reuse
}
```

## Examples

From this project:

**Before (monolithic):**
- `src/main.js` = 1821 lines
  - 300 lines: DOM init + event listener setup
  - 400 lines: Todo list rendering + row events
  - 250 lines: Reorder drag/touch logic
  - 200 lines: Modal + focus management
  - 300 lines: Keyboard shortcut routing
  - 200 lines: Burndown chart
  - 151 lines: DAG visualization + interaction

**After (modular):**
- `src/main.js` = 836 lines (orchestration + persistence)
- `src/todo/list-view.js` = ~200 lines (row rendering + DOM events)
- `src/todo/reorder.js` = ~180 lines (drag/touch state)
- `src/ui/modals.js` = ~120 lines (modal lifecycle)
- `src/ui/keyboard.js` = ~140 lines (shortcut routing)
- `src/burndown/view.js` = ~90 lines (chart rendering)
- `src/app/store.js` = ~150 lines (state + actions)
- `src/app/selectors.js` = ~100 lines (derived state)

**Key win:** No framework rewrite. No test environment overhaul. Same 213+ tests. Better boundaries.

## Anti-Patterns

❌ **Avoid:**
- Extracting by code type first (helpers, utilities). Extract by behavior/domain.
- Moving the store into a controller module. It stays in the composition root.
- Passing the store directly to controllers. Use callbacks.
- Creating circular dependencies between controllers (sign: controllers importing each other).
- Extracting "just to reduce line count" without fixing boundaries. Move for clarity, not aesthetics.
- Leaving cross-feature effects scattered in controllers. Keep them in `main.js`.
- Assuming the framework choice comes before module extraction. Test the architecture first, then choose the framework.

❌ **Don't use this when:**
- You're already using a framework (React, Vue). Let the framework guide module structure.
- The monolith is <500 lines of clear, focused code. The extraction overhead isn't worth it.
- Multiple teams own different parts. Boundaries become ownership lines, not just architectural seams.

## Confidence Note

**High confidence** — Validated in this project:
- Reduced complexity from 1821 → 836 lines in `src/main.js`
- All 213+ tests passing before and after refactor
- Controllers are reusable (no hidden store dependencies)
- Cross-feature effects remain in composition root for clarity
- 6 PRs merged incrementally (constants → CSS → main split → store → delegation → persistence)
