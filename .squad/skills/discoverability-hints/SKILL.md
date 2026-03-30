---
name: "Discoverability Hints"
description: "Lightweight, dismissible inline tips tied to clear user milestones with localStorage one-shot logic. Contextual onboarding without persistent clutter."
domain: "ux"
confidence: "low"
source: "earned"
---

## Context

New users often miss powerful but non-obvious features (keyboard shortcuts, drag-and-drop reordering, complex dialogs). However, persistent tooltips and overlays create visual clutter and annoy repeat users.

The discoverability hints pattern addresses this by:

1. **Tying hints to milestones:** Show a hint only when the user reaches a specific interaction threshold (e.g., "added 3 tasks", "first mobile reorder")
2. **One-shot dismissal:** localStorage prevents the same hint from appearing more than once, ever
3. **Lightweight inline presentation:** Hints are small, inline elements in the UI, not modals or overlays
4. **User control:** Always include a dismiss button (×) so users can close hints at any time

This pattern works well for features that are valuable but discoverable through experimentation, without requiring formal training or documentation.

## Patterns

### 1. **Storage Key Convention**

Define hint dismissal keys in a central constants file:

```javascript
export const APP_STORAGE_KEYS = Object.freeze({
  TODOS: 'todos',
  BURNDOWN: 'todos_burndown',
  READY_FILTER: 'bumbledo_filter_ready',
  SHORTCUTS_TIP_DISMISSED: 'bumbledo_tip_shortcuts_dismissed',
  REORDER_TIP_DISMISSED: 'bumbledo_tip_reorder_dismissed',
});
```

**Convention:**
- Prefix: `bumbledo_tip_` (app-specific)
- Suffix: Feature name + `_dismissed`
- Immutable: Use `Object.freeze()` to prevent mutations
- Centralized: All keys defined in one place for easy auditing

### 2. **State Management: Load and Save Preferences**

In the app store, load dismissal state from localStorage on init:

```javascript
import { APP_STORAGE_KEYS } from './constants.js';

function loadBooleanPreference(key, storage) {
  const stored = storage.getItem(key);
  return stored === 'true';  // Defaults to false
}

function saveBooleanPreference(key, value, storage) {
  storage.setItem(key, String(value));
}

function createInitialState(isMobileViewport, storage) {
  return {
    // ... other state ...
    shortcutsTipDismissed: loadBooleanPreference(
      APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED,
      storage,
    ),
    reorderTipDismissed: loadBooleanPreference(
      APP_STORAGE_KEYS.REORDER_TIP_DISMISSED,
      storage,
    ),
  };
}
```

**Key pattern:**
- Load on app init
- Store as boolean in app state
- Treat localStorage as the source of truth (users expect dismissal to persist across sessions)

### 3. **Milestone-Based Visibility Logic**

Compute whether to show a hint based on app state (not just whether it was dismissed):

```javascript
function syncDiscoverabilityTips() {
  if (shortcutsTip) {
    // Show only if: not dismissed AND user has added 3+ tasks
    const shouldShowShortcutsTip =
      !shortcutsTipDismissed && todos.length >= 3;
    shortcutsTip.hidden = !shouldShowShortcutsTip;
  }

  if (reorderTip) {
    // Show only if: not dismissed AND user is on mobile AND has reorderable items
    const shouldShowReorderTip =
      !reorderTipDismissed &&
      isMobileViewport &&
      getVisibleTodos().some((todo) => isActionableStatus(todo.status));
    reorderTip.hidden = !shouldShowReorderTip;
  }
}
```

**Milestone examples:**
- "Shortcuts tip": `todos.length >= 3` (third task added)
- "Reorder tip": `isMobileViewport && hasReorderableTodos` (first eligible mobile view)
- "First blocker": `todos.some((t) => t.status === 'blocked')` (first blocked task created)
- "First completion": `todos.some((t) => t.status === 'done')` (first task completed)

**Never show a hint if:**
- It was already dismissed (check localStorage)
- The current context doesn't match (e.g., don't show mobile reorder hint on desktop)

### 4. **Dismissal Action: Update State + Save**

When user clicks dismiss, update app state and persist to localStorage:

```javascript
// In the store reducer:
dismissReorderTip(currentState) {
  if (currentState.reorderTipDismissed) {
    return currentState;  // Already dismissed, no change
  }

  return { ...currentState, reorderTipDismissed: true };
},

// Side effect: When state changes, save to localStorage
{
  shouldRun: (previousState, nextState) =>
    previousState.reorderTipDismissed !== nextState.reorderTipDismissed,
  run: (_previousState, nextState) =>
    saveBooleanPreference(
      APP_STORAGE_KEYS.REORDER_TIP_DISMISSED,
      nextState.reorderTipDismissed,
      storage,
    ),
},
```

**Pattern:**
- Idempotent: Dismissing twice is safe (state doesn't change)
- Side effect triggers only on state change
- localStorage writes should be automatic, not require explicit calls

### 5. **HTML Structure: Inline, Dismissible Tip**

Hints are inline elements in the page, not overlays:

```html
<div id="reorder-tip" class="discoverability-tip" hidden>
  <p>
    Long-press the <span class="icon">⠿</span> handle on any task to reorder.
  </p>
  <button
    id="reorder-tip-dismiss"
    class="dismiss-btn"
    aria-label="Dismiss"
  >
    ×
  </button>
</div>

<div id="shortcuts-tip" class="discoverability-tip" hidden>
  <p>
    Pro tip: Use <kbd>?</kbd> to view keyboard shortcuts.
  </p>
  <button
    id="shortcuts-tip-dismiss"
    class="dismiss-btn"
    aria-label="Dismiss"
  >
    ×
  </button>
</div>
```

**Key attributes:**
- `hidden` attribute: CSS sets `display: none`
- `class="discoverability-tip"`: Shared styling for all hints
- `id="*-dismiss"`: Dismiss button for each hint
- `aria-label="Dismiss"`: Accessibility for screen readers

### 6. **Event Binding: Dismiss Button Logic**

Bind dismiss buttons to the store action:

```javascript
const reorderTipDismiss = document.querySelector('#reorder-tip-dismiss');
const shortcutsTipDismiss = document.querySelector('#shortcuts-tip-dismiss');

reorderTipDismiss?.addEventListener('click', () => {
  dismissReorderTip();
});

shortcutsTipDismiss?.addEventListener('click', () => {
  dismissShortcutsTip();
});

function dismissReorderTip() {
  store.dismissReorderTip();
}

function dismissShortcutsTip() {
  store.dismissShortcutsTip();
}
```

**Pattern:**
- Null-check before binding (`?.` optional chaining)
- Dismiss action is a simple store call
- Visibility updates happen automatically via `syncDiscoverabilityTips()` after render

## Examples

### From this project

**Storage keys** (`src/app/constants.js`):
```javascript
SHORTCUTS_TIP_DISMISSED: 'bumbledo_tip_shortcuts_dismissed',
REORDER_TIP_DISMISSED: 'bumbledo_tip_reorder_dismissed',
```

**State management** (`src/app/store.js`):
- Load: `shortcutsTipDismissed: loadBooleanPreference(...)`
- Action: `dismissReorderTip(currentState) { ... }`
- Side effect: Watch state change, save to localStorage

**Visibility logic** (`src/main.js`):
```javascript
function syncDiscoverabilityTips() {
  if (shortcutsTip) {
    const shouldShowShortcutsTip =
      !shortcutsTipDismissed && todos.length >= 3;
    shortcutsTip.hidden = !shouldShowShortcutsTip;
  }

  if (reorderTip) {
    const shouldShowReorderTip =
      !reorderTipDismissed &&
      isMobileViewport &&
      getVisibleTodos().some((todo) => isActionableStatus(todo.status));
    reorderTip.hidden = !shouldShowReorderTip;
  }
}
```

**Event binding** (`src/main.js`):
```javascript
reorderTipDismiss?.addEventListener('click', () => {
  dismissReorderTip();
});

shortcutsTipDismiss?.addEventListener('click', () => {
  dismissShortcutsTip();
});
```

### CSS Styling Example

```css
.discoverability-tip {
  display: none;  /* Override with hidden attribute */
  position: relative;
  padding: 12px 16px 12px 16px;
  margin: 8px 0;
  background-color: #fffbf0;
  border: 1px solid #e6d5b8;
  border-radius: 4px;
  font-size: 13px;
  color: #5f5f5f;
  line-height: 1.5;
}

.discoverability-tip:not([hidden]) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.discoverability-tip p {
  margin: 0;
  flex: 1;
}

.discoverability-tip .icon {
  font-family: monospace;
  font-weight: bold;
}

.discoverability-tip kbd {
  background-color: #f5f5f5;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
}

.discoverability-tip .dismiss-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.discoverability-tip .dismiss-btn:hover {
  color: #333;
}
```

## Anti-Patterns

### ❌ Persistent, always-visible hints

**Problem:** Creates visual clutter and annoys users who already know the feature.

```javascript
// Bad: Always visible
tip.hidden = false;

// Good: Tied to milestone + dismissal state
const shouldShowTip = !tipDismissed && hasNotReachedMilestone();
tip.hidden = !shouldShowTip;
```

### ❌ Dismissing hints without saving to localStorage

**Problem:** Users dismiss a hint but it reappears on next session, breaking trust.

```javascript
// Bad: State change only
function dismissTip() {
  tipDismissed = true;
}

// Good: Update state AND save to localStorage
function dismissTip() {
  store.dismissReorderTip();  // Triggers side effect to save
}
```

### ❌ Using multiple localStorage keys for one hint

**Problem:** Inconsistent naming makes hints hard to audit and remove.

```javascript
// Bad
localStorage.setItem('tip_reorder_seen', 'true');
localStorage.setItem('reorder_hint_dismissed', 'true');

// Good
localStorage.setItem(APP_STORAGE_KEYS.REORDER_TIP_DISMISSED, 'true');
```

### ❌ Modal or overlay hints instead of inline

**Problem:** Modals interrupt workflow and feel jarring. Inline hints feel integrated.

```javascript
// Bad: Modal overlay
showModal({
  title: 'Pro Tip',
  message: 'Use keyboard shortcuts!',
  onDismiss: () => { /* ... */ },
});

// Good: Inline dismissible tip in the page
<div class="discoverability-tip" hidden>
  <p>Pro tip: Use <kbd>?</kbd> for shortcuts.</p>
  <button class="dismiss-btn">×</button>
</div>
```

### ❌ Milestone logic hardcoded in UI

**Problem:** Hard to test, understand, or change milestones. Logic should be in the app store.

```javascript
// Bad: Logic scattered in rendering code
if (!tipDismissed && todos.length >= 3) {
  tip.hidden = false;
}

// Good: Centralized in store/state
const shouldShowTip = selectShouldShowReorderTip(state);
tip.hidden = !shouldShowTip;
```

### ❌ Forgetting to sync hints after state changes

**Problem:** Hint visibility doesn't update if `syncDiscoverabilityTips()` isn't called after render.

```javascript
// Bad: No sync call
function renderApp() {
  // ... render logic ...
  // (hint visibility doesn't update)
}

// Good: Sync after render
function renderApp() {
  // ... render logic ...
  syncDiscoverabilityTips();  // Update visibility
}
```

### ❌ Dismissing hints without idempotency check

**Problem:** Multiple dismiss clicks or state changes can cause unexpected behavior.

```javascript
// Bad: No guard
dismissReorderTip(state) {
  return { ...state, reorderTipDismissed: true };
}

// Good: Idempotent
dismissReorderTip(state) {
  if (state.reorderTipDismissed) {
    return state;  // No change
  }
  return { ...state, reorderTipDismissed: true };
}
```

## Advanced Patterns

### **Time-Based Milestones**

Show a hint only after a certain time has elapsed:

```javascript
function selectShouldShowGettingStartedTip(state) {
  const appStartedAtMs = state.appStartedAt;
  const elapsedMs = Date.now() - appStartedAtMs;
  
  return (
    !state.gettingStartedTipDismissed &&
    elapsedMs > 5000 &&  // Wait 5 seconds before showing
    state.todos.length === 0  // Only on empty state
  );
}
```

### **Progressive Hints**

Show different hints as user advances through milestones:

```javascript
// Level 1: First task added
shouldShowLevel1Tip() {
  return !state.level1TipDismissed && state.todos.length === 1;
}

// Level 2: First task completed
shouldShowLevel2Tip() {
  return (
    !state.level2TipDismissed &&
    state.todos.some((t) => t.status === 'done') &&
    state.todos.length >= 3
  );
}

// Level 3: First dependency added
shouldShowLevel3Tip() {
  return (
    !state.level3TipDismissed &&
    state.todos.some((t) => t.blockers.length > 0)
  );
}
```

### **Context-Aware Hints**

Only show hints in the correct context:

```javascript
function syncDiscoverabilityTips() {
  // Desktop users don't need mobile reorder hint
  if (reorderTip) {
    const shouldShowReorderTip =
      !state.reorderTipDismissed &&
      state.isMobileViewport &&  // Context: mobile only
      hasReorderableTodos();
    reorderTip.hidden = !shouldShowReorderTip;
  }

  // Don't show shortcuts hint if app is in tutorial mode
  if (shortcutsTip) {
    const shouldShowShortcutsTip =
      !state.shortcutsTipDismissed &&
      !state.isTutorialMode &&  // Context: not in tutorial
      state.todos.length >= 3;
    shortcutsTip.hidden = !shouldShowShortcutsTip;
  }
}
```

## Accessibility Considerations

- **Dismiss button labeling:** Use `aria-label="Dismiss this tip"` for clarity
- **ARIA live region:** Optionally announce new tips: `aria-live="polite"` on the tip element
- **Keyboard dismissal:** Ensure dismiss button is keyboard-accessible (it is, being a button)
- **Color contrast:** Tip background and text should meet WCAG AA contrast ratios
- **No flashing:** Don't animate tips appearing/disappearing (could trigger motion sensitivity)
