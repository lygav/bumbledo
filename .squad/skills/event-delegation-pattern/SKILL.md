---
name: "Event Delegation Pattern"
description: "Container-level listeners with event.target.closest() instead of per-row wiring, enabling efficient interaction handling through full re-renders without rebinding."
domain: "frontend"
confidence: "medium"
source: "earned"
---

## Context

When building interactive lists or tables that re-render frequently (e.g., after drag reorder, status changes, or filter updates), attaching listeners to individual rows creates a brittleness problem: every re-render orphans the old listeners, forcing rebinding. Event delegation moves all wiring to a stable parent container and identifies targets at event time using `event.target.closest(selector)`, eliminating rebinding overhead and making listener setup resilient to re-renders.

This pattern is essential in frontend apps that use functional re-rendering without a virtual DOM layer (vanilla DOM or light frameworks).

## Patterns

### 1. Container-Level Listener Setup
Attach listeners to a stable container element (e.g., the list `<ul>`) once during initialization, not inside the render loop:

```javascript
// ✅ Good: Single listener setup, survives re-renders
const todoList = document.querySelector('#todo-list');
todoList.addEventListener('click', handleListClick);

// ❌ Bad: Re-bound per render, stale references after update
function render(todos) {
  todos.forEach(todo => {
    const li = document.createElement('li');
    li.addEventListener('click', () => handleTodoClick(todo.id));
  });
}
```

### 2. Target Resolution with Closest
Use `event.target.closest(selector)` to walk up the DOM tree and find the nearest ancestor matching a selector. Include stable `data-` attributes on each row:

```javascript
function handleListClick(event) {
  const todoRow = event.target.closest('[data-todo-id]');
  if (!todoRow) return;

  const todoId = todoRow.dataset.todoId;
  const action = event.target.dataset.action;

  if (action === 'delete') {
    store.dispatch('deleteTask', todoId);
  } else if (action === 'edit') {
    store.dispatch('enterEditMode', todoId);
  }
}
```

### 3. Stopping Event Propagation for Nested Controls
When a row has nested interactive controls (e.g., checkboxes, buttons), stop their clicks from bubbling to the row's generic click handler:

```javascript
// Nested control: checkbox for blocking toggles
const blockerCheckbox = document.querySelector('input[data-blocker-id]');
blockerCheckbox.addEventListener('change', (event) => {
  event.stopPropagation(); // Prevent row selection
  const blockerId = event.target.dataset.blockerId;
  store.dispatch('toggleBlocker', blockerId);
});
```

### 4. Handling Multiple Event Types
Delegate multiple event types (click, change, focus, keydown) to the same container listener, dispatching to sub-handlers based on the target:

```javascript
const todoList = document.querySelector('#todo-list');

// Single listener for all interactive events
todoList.addEventListener('click', handleListClick);
todoList.addEventListener('change', handleListChange);
todoList.addEventListener('dblclick', handleListDblclick);
todoList.addEventListener('keydown', handleListKeydown);

function handleListClick(event) {
  const todoRow = event.target.closest('[data-todo-id]');
  if (!todoRow) return;
  // ... dispatch action
}

function handleListChange(event) {
  const todoCheckbox = event.target.closest('input[data-todo-id]');
  if (!todoCheckbox) return;
  // ... dispatch action
}
```

## Examples

From the todo app (`src/todo/list-view.js`):

**Before (per-row listeners, broken after re-render):**
```javascript
function renderTodo(todo) {
  const li = document.createElement('li');
  li.dataset.todoId = todo.id;
  li.addEventListener('click', () => selectTodo(todo.id)); // ← Lost after next render
  return li;
}
```

**After (delegated from container):**
```javascript
export function initListView(container, store) {
  container.addEventListener('click', (event) => {
    const row = event.target.closest('[data-id]');
    if (!row) return;
    const id = row.dataset.id;

    const checkbox = event.target.closest('input[data-blocker-id]');
    if (checkbox) {
      event.stopPropagation();
      store.dispatch('toggleBlocker', checkbox.dataset.blockerId);
      return;
    }

    const deleteBtn = event.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      store.dispatch('deleteTask', id);
      return;
    }

    store.dispatch('setTaskStatus', { id, status: 'active' });
  });

  container.addEventListener('dblclick', (event) => {
    const row = event.target.closest('[data-id]');
    if (row) store.dispatch('enterEditMode', row.dataset.id);
  });

  // Other event handlers...
}
```

**Key data attributes used:**
- `data-id` on each row for identifying the todo
- `data-blocker-id` on blocker checkboxes to distinguish from status checkboxes
- `data-action` on buttons to encode the action

## Anti-Patterns

1. **Rebinding on every render:** Attaching listeners inside the render function or calling `addEventListener` in a render loop causes stale references and memory leaks.

2. **Forgetting `event.stopPropagation()`:** Nested controls that don't stop bubbling will trigger the parent row's click handler, causing unintended state changes (e.g., toggling a blocker checkbox also selecting the row).

3. **Using generic selectors:** `event.target.closest('input')` is fragile because it might match unrelated inputs. Use data attributes (`input[data-blocker-id]`) to be explicit.

4. **Not validating the closest match:** Always check that `event.target.closest(...)` returns a non-null result before accessing its properties, or you'll crash on unrelated clicks.

5. **Delegating to the wrong container:** If the container can be removed or replaced, the listener is lost. Use a stable ancestor (e.g., `document` or a persistent wrapper) if rows' parents re-render.

---

**Confidence: Medium** — Pattern confirmed by fixing real interaction bugs in the todo list when drag reorder and filter changes stopped rebinding listeners.
