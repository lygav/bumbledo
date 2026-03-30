---
name: "Composition Root Pattern"
description: "Structure a single orchestrator module that owns app state, wires controllers via callbacks, and coordinates cross-feature effects—without controllers owning domain logic."
domain: "architecture, dependency-injection, state-coordination"
confidence: "high"
source: "earned"
---

## Context

The Composition Root Pattern is the architectural glue that holds modular frontend systems together. It solves the coordination problem: **How do you keep multiple feature controllers in sync without tight coupling?**

In this project, after extracting 5+ feature controllers from a monolithic `src/main.js`, the composition root became the single source of truth for:
- Canonical application state (todos, selection, filter, UI toggles)
- How controllers wire together (dependency injection via callbacks)
- Cross-feature effects (persistence, notifications, DAG sync, confetti)

Without a clear composition root, extracted controllers either:
- Import each other directly (creates circular dependencies)
- Access global state (breaks testability and reusability)
- Re-implement state management independently (causes sync bugs)

## Patterns

### 1. Single Orchestrator Module (`src/main.js`)

The composition root is a single module that:
- Instantiates the store **once** at the top
- Instantiates all controllers with explicit dependencies
- Owns all cross-feature effect subscriptions
- Never hands control to child modules

```js
// src/main.js — the orchestrator
if (typeof document !== 'undefined') {
  const store = createAppStore(injectedStorage || defaultStorage);
  
  // Wire controllers
  const listView = createListView(todoContainer, {
    onAddTodo: (title) => store.dispatch('addTodo', title),
    onRemoveTodo: (id) => store.dispatch('removeTodo', id),
    todos: selectVisibleTodos(store.getState()),
  });
  
  const keyboard = createKeyboard(document, {
    onCreateTodo: () => store.dispatch('addTodo', 'New task'),
  });
  
  const modals = createModals(document);
  const reorder = createReorder(todoContainer, {
    onReorder: (ids) => store.dispatch('setTodoOrder', ids),
  });
  
  // Wire cross-feature effects
  store.subscribe((newState, action) => {
    // Persistence effect
    if (action.type.startsWith('todo') || action.type === 'toggleReady') {
      storage.setItem('todos', JSON.stringify(newState.todos));
    }
    
    // Notification effect (keyboard + reorder + status changes)
    if (action.type === 'completeTodo') {
      showNotification('Task completed! 🎉');
      if (newState.todos.some(t => t.status === 'done')) {
        confetti();
      }
    }
    
    // List view render
    listView.render(selectVisibleTodos(newState), newState.selectedTodoId);
    
    // DAG sync
    dagView.render(buildDag(newState.todos));
  });
}
```

### 2. Dependency Injection via Callbacks

Controllers receive their dependencies as configuration objects, not as global imports:

```js
// ✅ Controller receives callbacks (reusable)
export function createListView(container, { onAddTodo, onRemoveTodo, todos }) {
  button.onclick = () => onAddTodo(input.value);
  todoRow.onclick = () => onRemoveTodo(todoId);
  render(todos);
}

// In composition root
createListView(container, {
  onAddTodo: (title) => store.dispatch('addTodo', title),
  onRemoveTodo: (id) => store.dispatch('removeTodo', id),
  todos: visibleTodos,
});
```

**Why callbacks, not store:**
- Controllers never import the store (reusable anywhere)
- Dependencies are explicit (documented in the config object)
- Easy to mock for testing (pass test doubles)
- Controllers stay pure and stateless

### 3. Guarded DOM Initialization

Use a guard to allow the module to be imported in Node/test environments without errors:

```js
// At the end of src/main.js
if (typeof document !== 'undefined') {
  // DOM setup only runs in browsers
  const container = document.getElementById('app');
  const store = createAppStore();
  // ... wire controllers ...
}
```

This allows:
- Unit tests to import and test pure logic functions
- Same file to export pure utilities for testing
- Vitest/Node to run without throwing on `document` access

### 4. Subscription-Based Event Distribution

The composition root subscribes to store changes and fans out to all controllers:

```js
store.subscribe((newState, action) => {
  // Each subscription re-renders its target
  listView.render(selectVisibleTodos(newState));
  burndownView.render(selectBurndownProps(newState));
  dagView.render(buildDag(newState.todos));
  
  // Effects with side effects happen here
  if (action.type === 'completeTodo') {
    showNotification('Task completed!');
  }
});
```

This is simpler than event emitters between controllers and avoids cascading action dispatch (action → effect → another action → infinite loop).

### 5. Cross-Feature Effects in the Composition Root

Effects that touch multiple features (persistence, notifications, DAG sync) belong in the composition root, not in controllers:

```js
// ❌ Wrong: effect scattered in a controller
export function createListView(container, { onAddTodo, storage }) {
  button.onclick = () => {
    onAddTodo(title);
    storage.setItem('todos', JSON.stringify(state.todos)); // Effect here!
  };
}

// ✅ Right: effect in composition root
store.subscribe((newState, action) => {
  if (action.type === 'addTodo') {
    storage.setItem('todos', JSON.stringify(newState.todos));
    showNotification('Task added');
  }
});
```

**Why in the composition root:**
- One place to reason about effect order
- Effects can coordinate (e.g., "save then show confirmation")
- Easy to disable effects for testing (mock store)
- Controllers stay focused on their UI responsibility

### 6. The focusout/Microtask Lesson

A subtle but critical insight: browser events don't always sync with JS state updates. When a `focusout` event fires, the DOM may be in the middle of a re-render:

```js
// Blocker select blur event
todoRow.addEventListener('focusout', (e) => {
  if (e.relatedTarget?.closest('.blocker-picker')) {
    // User is still in the blocker picker, don't finalize yet
    return;
  }
  
  // Defer the final check to a microtask so the re-render completes
  queueMicrotask(() => {
    const isBocked = store.getState().todos.find(t => t.id === todoId).blockers.length > 0;
    if (isBlocked) {
      completeTask();
    }
  });
});
```

**The lesson:** When event handlers need to inspect state that may have just changed via a re-render, use `queueMicrotask()` to defer the check. Event handlers run *before* microtasks, so the deferred code sees the updated DOM and state.

This is NOT a bug—it's a timing coordination issue between browser events and app state updates. Handle it explicitly in the composition root or the module that owns the event listener, never implicitly.

## Examples

From this project:

**Composition root structure (`src/main.js`):**
- Lines 1–100: Store instantiation + controller initialization
- Lines 100–150: Store subscription for list/burndown/DAG rendering
- Lines 150–200: Cross-feature effects (persistence, notifications)
- Remaining lines: Helper functions, guard for DOM env

**Controllers (all stateless):**
- `src/todo/list-view.js` — renders rows, receives todos + callbacks
- `src/todo/reorder.js` — manages drag/touch state, calls `onReorder` callback
- `src/ui/keyboard.js` — watches global key events, calls action callbacks
- `src/ui/modals.js` — owns modal lifecycle, no state mutations
- `src/burndown/view.js` — renders chart from props

**No circular dependencies:**
- Controllers never import each other
- Controllers never import the store
- Main never imports controllers by reference (they're instantiated inline)

## Anti-Patterns

❌ **Avoid:**
- Passing the store into controllers (breaks reusability, hides dependencies)
- Controllers importing each other directly (creates circular dependencies)
- Scattering cross-feature effects in controllers (hard to reason about order)
- Multiple "composition roots" or orchestrators (fragments responsibility)
- Composition root that does business logic (only coordinates, doesn't compute)
- Controllers that call other controllers (breaks the callback model)
- Async effects (persistence, notifications) without error handling in the composition root

❌ **Don't use when:**
- Using a framework with built-in dependency injection (React, Angular, Vue)
- The app has <3 feature areas (simpler patterns suffice)
- Controllers are one-off, never reused (tighter coupling is acceptable)

## Confidence Note

**High confidence** — Battle-tested in this project:
- Refactored 1821-line monolith into 6 reusable controllers + store + selectors
- All 213+ tests pass without mocking the composition root
- Controllers are genuinely reusable (no hidden dependencies)
- Cross-feature effects (persistence, notifications, confetti, DAG) remain orchestrated in one place
- The focusout/microtask lesson prevented a subtle race condition in blocker-picker interaction
