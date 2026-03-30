---
name: "Touch Drag Reorder"
description: "Long-press handle + global touchmove/touchend pattern for mobile drag-and-drop reordering. Decouples touch drag from scroll gestures and uses elementFromPoint() for accurate drop targeting."
domain: "ux"
confidence: "medium"
source: "earned"
---

## Context

Touch reordering on mobile devices must coexist peacefully with page scrolling and native touch gestures. A naive implementation that delegates to HTML5 `draggable` or `mousedown`-based drag fails because:

1. **Scroll interference:** Touch listeners on the page interfere with native scroll
2. **Drop accuracy:** elementFromPoint() at touch coordinates requires active drag state to work reliably
3. **Click suppression:** Long-press activation must suppress accidental clicks and taps
4. **Handle discovery:** Users need an obvious affordance (⠿ handle) to initiate drag

This pattern separates the initiation phase (handle-targeted long-press) from the drag phase (document-scoped touchmove/touchend), allowing scroll gestures and normal taps to work normally until the timer fires.

## Patterns

### 1. **Handle-Based Long-Press Activation**

The drag handle is the only element that starts drag:

```javascript
function handleTouchStart(event) {
  const handle = event.target?.closest('.drag-handle');
  if (!handle) return;
  
  const item = handle.closest('li[data-id]');
  
  touchDragState = {
    active: false,      // Drag not yet active
    handle,
    item,
    startX: touch.clientX,
    startY: touch.clientY,
    lastX: touch.clientX,
    lastY: touch.clientY,
    timerId: window.setTimeout(() => {
      beginTouchDrag();
    }, TOUCH_DRAG_HOLD_MS),  // ~180ms
    touchId: touch.identifier,
  };
  
  handle.classList.add('touch-armed');  // Visual feedback
}
```

**Key properties:**
- `TOUCH_DRAG_HOLD_MS = 180`: Minimum hold time before drag starts (user-friendly, matches native app expectations)
- `touch-armed` class: Visual feedback that timer is running
- `active: false` initially: Drag hasn't started yet, allowing cancel if user moves

### 2. **Travel Distance Gate (TOUCH_DRAG_CANCEL_DISTANCE)**

Before the timer fires, if the user moves their finger too far, cancel the pending drag:

```javascript
function handleTouchMove(event) {
  if (!touchDragState) return;
  
  const touch = findTouchById(event.touches, touchDragState.touchId);
  if (!touch) return;
  
  touchDragState.lastX = touch.clientX;
  touchDragState.lastY = touch.clientY;
  
  if (!touchDragState.active) {
    // Before drag starts, check if user scrolled too far
    const travelDistance = Math.hypot(
      touch.clientX - touchDragState.startX,
      touch.clientY - touchDragState.startY,
    );
    
    if (travelDistance > TOUCH_DRAG_CANCEL_DISTANCE) {  // ~10px
      resetTouchDragState();  // Let scroll happen naturally
    }
    return;
  }
  
  // Active drag: prevent scroll and update position
  event.preventDefault();
  updateTouchDragPosition(touch.clientX, touch.clientY);
  getDragTargetFromPoint(touch.clientX, touch.clientY);
}
```

**Why this matters:**
- Users can start a scroll gesture without accidentally triggering drag
- Mimics native app behavior (10–15px "slop" is standard iOS convention)
- Prevents `event.preventDefault()` until drag is truly active

### 3. **Drop Target Detection via elementFromPoint()**

Once active, find the drop target without relying on mouseover events:

```javascript
function getDragTargetFromPoint(clientX, clientY) {
  const hoveredElement = document.elementFromPoint(clientX, clientY);
  const item = hoveredElement?.closest('li[data-id]') ?? null;
  return getDragTarget(item, clientY);
}

function getDragTarget(item, clientY) {
  clearDragIndicators();
  if (!item || item.dataset.id === draggedId) {
    return null;
  }
  
  const rect = item.getBoundingClientRect();
  const insertAfter = clientY >= rect.top + rect.height / 2;
  item.classList.add(insertAfter ? 'drag-over-below' : 'drag-over-above');
  return { targetId: item.dataset.id, insertAfter };
}
```

**Key insight:**
- `elementFromPoint()` only works reliably during an active drag (when drag-over indicators are visible)
- The item's vertical midpoint determines insertion above/below
- Visual classes (`drag-over-above`, `drag-over-below`) provide user feedback

### 4. **Global Document Listeners**

Drag handlers are attached to the *document*, not the list:

```javascript
attach() {
  listEl.addEventListener('dragstart', handleDragStart);
  listEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  
  // Global handlers for active drag
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd, { passive: false });
  document.addEventListener('touchcancel', handleTouchCancel);
}
```

**Why document?**
- Users can drag outside the list viewport (especially on mobile)
- Touch can escape the list container during fast movement
- Global listeners ensure drag is trackable regardless of scroll position

### 5. **Click Suppression on Drag End**

After an active drag, suppress the next click on the dragged item:

```javascript
function resetTouchDragState({ suppressClick = false } = {}) {
  const wasActive = touchDragState?.active ?? false;
  
  clearTouchHold();
  touchDragState = null;
  
  if (wasActive && suppressClick) {
    suppressClickUntil = performance.now() + 400;  // ~400ms window
  }
  
  return { wasActive };
}

function handleClickCapture(event) {
  if (performance.now() >= suppressClickUntil) {
    return;  // Click is allowed
  }
  
  event.preventDefault();
  event.stopPropagation();
  suppressClickUntil = 0;
}
```

**Why needed:**
- After `touchend`, the browser may fire a synthetic `click` event
- Without suppression, clicking the item's checkbox could trigger while drag completes

### 6. **Position Tracking with CSS Variables**

Update the dragged item's position via CSS variables (not inline styles):

```javascript
function updateTouchDragPosition(clientX, clientY) {
  if (!draggedElement || !touchDragState?.active) return;
  
  draggedElement.style.setProperty(
    '--touch-drag-x',
    `${clientX - touchDragState.startX}px`,
  );
  draggedElement.style.setProperty(
    '--touch-drag-y',
    `${clientY - touchDragState.startY}px`,
  );
}
```

**CSS:**
```css
li.touch-dragging {
  transform: translate(var(--touch-drag-x, 0), var(--touch-drag-y, 0));
  opacity: 0.7;
  z-index: 1000;
}
```

## Examples

### From this project: `src/todo/reorder.js`

- **Handles**: `.drag-handle` class (⠿ icon)
- **Items**: `li[data-id]` list items
- **Drag timer**: 180ms before drag activates
- **Travel gate**: 10px cancel distance
- **Drop indicators**: `drag-over-above` and `drag-over-below` classes
- **Dragged item**: `touch-dragging` class for visual styling

### HTML Structure

```html
<ul id="todo-list">
  <li data-id="task-1">
    <button class="drag-handle" aria-label="Reorder">⠿</button>
    <span>Task title</span>
  </li>
  <li data-id="task-2">
    <button class="drag-handle" aria-label="Reorder">⠿</button>
    <span>Task title</span>
  </li>
</ul>
```

### Integration

```javascript
import { createTodoReorderController } from './reorder.js';

const reorderController = createTodoReorderController({
  listEl: document.querySelector('#todo-list'),
  getTodos: () => todos,
  getVisibleTodos: () => visibleTodos,
  isFiltered: () => filterActive,
  isReorderableTodo: (todo) => isActionable(todo.status),
  reorderTodos: (todos, draggedId, targetId, insertAfter) => {
    // Return reordered array
  },
  onReorder: (nextTodos) => {
    // Persist and re-render
    return true;  // Success
  },
  onDismissReorderTip: () => {
    // Called on first successful drag
  },
});

reorderController.attach();
```

## Anti-Patterns

### ❌ Attaching touchmove/touchend to the list

**Problem:** Listeners on the list element don't fire when touch moves outside the list (common on mobile). Global listeners are required.

```javascript
// Bad
listEl.addEventListener('touchmove', handleTouchMove);
listEl.addEventListener('touchend', handleTouchEnd);

// Good
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });
```

### ❌ Preventing scroll immediately on touchstart

**Problem:** Blocks legitimate scroll gestures. Only prevent scroll once drag is `active`.

```javascript
// Bad
function handleTouchStart(event) {
  event.preventDefault();  // Blocks all scrolling!
}

// Good
function handleTouchStart(event) {
  // No preventDefault here; wait for timer
}

function handleTouchMove(event) {
  if (touchDragState?.active) {
    event.preventDefault();  // Only block scroll during active drag
  }
}
```

### ❌ Using mousedown for drag initiation

**Problem:** Touch events don't fire `mousedown`, so this only works on desktop. Separate mouse and touch handlers.

```javascript
// Bad
element.addEventListener('mousedown', startDrag);

// Good
element.addEventListener('touchstart', handleTouchStart, { passive: true });
element.addEventListener('dragstart', handleDragStart);  // Separate, for desktop
```

### ❌ Forgetting to suppress clicks after drag

**Problem:** After `touchend`, the browser synthesizes a `click` event, which can trigger actions on the same element (e.g., toggle checkbox).

```javascript
// Bad (no click suppression)
function handleTouchEnd(event) {
  // Drag completes, but next click fires immediately
}

// Good
function resetTouchDragState({ suppressClick = false } = {}) {
  if (wasActive && suppressClick) {
    suppressClickUntil = performance.now() + 400;
  }
}

// And suppress clicks in capture phase:
listEl.addEventListener('click', handleClickCapture, true);
```

### ❌ Not clearing touch state on multi-touch

**Problem:** Users might touch with two fingers (e.g., pinch to zoom). Cancel drag immediately.

```javascript
function handleTouchMove(event) {
  if (event.touches.length > 1) {
    resetTouchDragState({ suppressClick: true });
    return;
  }
  // ... rest of drag logic
}
```

### ❌ Using inline styles instead of CSS variables

**Problem:** Inline styles can't be overridden by media queries or CSS classes.

```javascript
// Bad
draggedElement.style.transform = `translate(${dx}px, ${dy}px)`;

// Good
draggedElement.style.setProperty('--touch-drag-x', `${dx}px`);
draggedElement.style.setProperty('--touch-drag-y', `${dy}px`);
// CSS: transform: translate(var(--touch-drag-x, 0), var(--touch-drag-y, 0))
```

## Accessibility Considerations

- **Handle labeling:** Use `aria-label="Reorder"` on the handle button
- **Keyboard alternative:** Provide a keyboard shortcut or modal dialog for reordering (not shown in this skill, but recommended)
- **ARIA live region:** Announce drag start/end to screen readers if applicable
- **Visual feedback:** Ensure `drag-over-above`/`drag-over-below` indicators have sufficient contrast
