# Saul — main.js split notes

## Issue

- #61 — Split `src/main.js` into feature controllers with `main.js` as composition root

## Module boundaries

- `src/todo/list-view.js`
  - Owns todo row rendering, inline edit DOM, blocked-by subtitle/picker DOM, per-row click/focus/change handlers, and selection/highlight/focus helpers.
- `src/todo/reorder.js`
  - Owns drag/drop and touch-reorder lifecycle, filtered reorder remapping, click suppression after touch drag, and drag indicator cleanup.
- `src/ui/modals.js`
  - Owns help modal lifecycle, blocked-completion modal lifecycle, focus return, backdrop click behavior, and blocked-modal Tab trapping.
- `src/ui/keyboard.js`
  - Owns global shortcut routing for focus-input, help toggle, Escape handling, list navigation, Enter status toggle, and delete/backspace deletion.
- `src/burndown/view.js`
  - Owns burndown toggle behavior, chart rendering, tooltip behavior, series/trend derivation, and expanded/collapsed chart presentation.
- `src/ui/status-metrics.js`
  - Shared helper for status-pill metric rendering used by the task summary and burndown summary surfaces.

## APIs exposed

- `createTodoListView({...})`
  - `update({ todos, visibleTodos, selectedTaskId, editingId })`
  - `syncSelection(selectedTaskId)`
  - `syncUnblockedHighlights()`
  - `focusList()`
  - `focusTask(id)`
  - `scrollTaskIntoView(id, { flash })`
  - `destroy()`
- `createTodoReorderController({...})`
  - `attach()`
  - `detach()`
  - `reset()`
- `createModals({...})`
  - `openHelp()`
  - `closeHelp()`
  - `toggleHelp()`
  - `isHelpOpen()`
  - `openBlocked(message, { returnFocusEl })`
  - `closeBlocked()`
  - `isBlockedOpen()`
  - `trapBlockedFocus(event)`
  - `destroy()`
- `createKeyboardController({...})`
  - `attach()`
  - `detach()`
  - `getFocusInputShortcutMarkup()`
- `createBurndownView({...})`
  - `update({ burndownData, progress, expanded })`
  - `hideTooltip()`
  - `destroy()`

## Composition-root decisions

- `src/main.js` keeps canonical app state and cross-feature orchestration:
  - todo mutations and persistence
  - selection + edit state
  - ready filter preference
  - burndown sample state
  - DAG visibility + sync
  - notification/controller wiring
  - confetti side effect
- Extracted modules communicate only through callbacks and state pushed from `main.js`.
- `main.js` line count reduced from 1821 to 836.
