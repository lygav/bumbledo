# Saul: blocked status regression follow-up

- **Area:** delegated task-row events in `src/todo/list-view.js`
- **Problem:** after the delegation refactor, the shared `focusout` path started finalizing blocked status for rows that had just been switched from `todo` to `blocked`.
- **Root cause:** the delegated handler keyed off the latest store state instead of the DOM state that initiated the blur. When the status select rerendered the row, the blur from the old row observed the task as `blocked` and immediately normalized it back to `todo` because no blockers had been chosen yet.
- **Decision candidate:** keep delegated events, but preserve the old blocked-row semantics:
  1. only run blocked finalization for rows already rendering `.blocker-picker`
  2. defer the finalize check with `queueMicrotask()` and re-read the current row/focus state after rerender
- **Why it matters:** event delegation is fine for steady-state interactions, but blur/focus orchestration is sensitive to rerender timing. Future extractions of row-local handlers need an explicit focus-semantics pass, not just event coverage.
