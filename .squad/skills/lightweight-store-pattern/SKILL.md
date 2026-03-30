---
name: "Lightweight Store Pattern"
description: "Build minimal reactive state management with named actions and selectors for vanilla JS apps that outgrow scattered state, without framework overhead."
domain: "state-management, vanilla-js, architecture"
confidence: "high"
source: "earned"
---

## Context

This pattern applies when a vanilla JavaScript app reaches a complexity threshold where:
- State lives in multiple places (DOM, module variables, closures)
- Controllers need shared state without tight coupling
- You need centralized persistence hooks
- Test coverage requires state inspection without DOM queries

It explicitly **avoids** framework solutions (React hooks, Vuex, Redux) and targets single-page apps with inline HTML/CSS and ES modules.

## Patterns

### 1. Single Centralized Store with Named Actions

Create a `src/app/store.js` that exports a `createAppStore()` factory. The store:
- Owns all mutable state (todos, selection, filters, UI toggles)
- Dispatches via named actions (not generic `setState`)
- Notifies subscribers on mutations
- Separates action intent from side effects

Example action names from the pattern:
- Task CRUD: `addTodo`, `removeTodo`, `updateTodo`
- Status changes: `setTodoStatus`, `toggleBlocker`
- Derived state: `setFilter`, `setSelectedTodoId`, `setEditingId`
- UI toggles: `toggleDagView`, `toggleBurndownView`, `setBurndownSamples`

### 2. Pure Selectors for Derived Data

Create `src/app/selectors.js` exporting functions that derive state without mutations:
- `selectVisibleTodos(todos, filter)` → filtered array
- `selectProgressTotals(todos)` → `{ done, blocked, total }`
- `selectIsReadyEmpty(todos, filter)` → boolean
- `selectBurndownProps(todos, samples)` → chart render data

Selectors are:
- Pure functions (same input → same output)
- Reusable across components
- Testable without store instantiation
- Named for clarity (not anonymous `get*`)

### 3. Composition Root as Store Owner

Keep `src/main.js` as the single orchestrator that:
- Instantiates the store once
- Wires controllers together through callbacks
- Subscribes to store changes and fans state to render functions
- Owns truly global concerns (persistence, DAG sync, confetti)

Never pass store directly to controllers. Instead:
```js
// In main.js
const store = createAppStore();
const listView = createListView(container, {
  onAddTodo: (title) => store.dispatch('addTodo', title),
  onRemoveTodo: (id) => store.dispatch('removeTodo', id),
  todos: selectVisibleTodos(...),
});
store.subscribe((newState) => listView.render(newState));
```

### 4. Persistence via Post-Action Effects

Rather than scattering `localStorage.setItem()` calls, centralize persistence as effects:
- Hook into store subscription
- Persist only specific slices (todos, burndown data, ready filter state)
- Use injectable storage for test mocking
- Never persist UI-only state (edit mode, selection, modals)

```js
// In store subscription
store.subscribe((newState, lastAction) => {
  if (lastAction.type.startsWith('todo') || lastAction.type === 'toggleReady') {
    storage.setItem('todos', JSON.stringify(newState.todos));
  }
});
```

## Examples

From this project (`src/app/store.js`):
- **Named actions:** `addTodo(title)`, `setTodoStatus(id, status)`, `setBurndownSamples(samples)`
- **Selectors:** `selectVisibleTodos()`, `selectProgressTotals()`, `selectBlockedCompletionCheck()`
- **Composition root:** `src/main.js` lines 1–50 instantiate store, wire controllers, and subscribe to render list/burndown/DAG
- **Persistence:** Store post-action effects persist `todos`, `burndownSamples`, and `readyFilter` only

The refactor reduced `src/main.js` from 1821 → 836 lines by moving state management into the store and extracting 5 feature controllers that dispatch actions instead of mutating state directly.

## Anti-Patterns

❌ **Avoid:**
- Passing the store directly to controllers (breaks reusability and testability)
- Generic `setState(path, value)` actions (loses intent, hard to debug)
- Persisting UI state (modals, selection, edit mode) — only persist domain data
- Mixing store mutations with side effects in action dispatchers
- Unnamed or anonymous selectors (`obj.todos.filter(...)` inline)
- Multiple store instances per app (fragments state, causes sync bugs)

❌ **Don't use this for:**
- Tiny 1-page apps with <200 lines of JS (too much overhead)
- React/Vue apps (use built-in state management or frameworks)
- Real-time multi-user systems without offline-first design
- Apps that don't need shared state (pure document generators)
