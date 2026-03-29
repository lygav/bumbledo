# ADR: Task Dependency (Blocked-By) Feature

**Status:** Proposed
**Author:** Danny (Lead/Architect)
**Date:** 2025-07-17

---

## Context

Users can set a todo's status to "blocked", but there's no way to specify *what* blocks it. The request is to let users link a blocked task to one or more other tasks as its blockers. This is a lightweight dependency feature — not a full DAG/Gantt system.

Current data model: `{ id, text, status }` where status ∈ {active, done, cancelled, blocked}.

---

## Decisions

### 1. Data Model — `blockedBy` array on each todo

**Decision:** Add an optional `blockedBy: string[]` field to the todo object, containing IDs of blocking tasks.

```json
{ "id": "abc", "text": "Deploy app", "status": "blocked", "blockedBy": ["def", "ghi"] }
```

**Rejected alternative:** A separate adjacency list (`deps: [{from, to}]`) alongside the todos array. This adds a second data structure to keep in sync (orphan cleanup, separate persistence), which is disproportionate for a single-file app with no backend.

**Rationale:**
- Keeps the flat array of todos as the single source of truth.
- `blockedBy` is only meaningful when `status === "blocked"` — it's ignored otherwise.
- No new storage keys. Same `localStorage` key, same JSON array.
- Deletion/cleanup is a simple filter during existing mutation operations.

### 2. UI for Setting Blockers — Inline checkbox list (Option A)

**Decision:** When a todo's status is changed to "blocked", render an inline panel *below that list item* containing a checkbox for each other non-done/non-cancelled task. Checking a box adds that task's ID to `blockedBy`; unchecking removes it.

**Rejected alternatives:**
- **Option B (dropdown picker next to item):** A `<select multiple>` is awkward on mobile and doesn't show task text well.
- **Option C (modal):** Explicitly ruled out — disproportionate for a single-file app.

**Design details:**
- The blocker-picker panel appears *only* on items with `status === "blocked"`.
- It lists all other todos that are `active` or `blocked` (not done/cancelled — those are terminal/irrelevant).
- Each entry is a `<label>` wrapping a `<input type="checkbox">` + task text (truncated to ~40 chars).
- Selecting/deselecting a checkbox immediately updates `blockedBy` and persists.
- The panel collapses when status changes away from "blocked".
- If there are no eligible blockers (e.g., only one task exists), show a short message: "No other tasks to select."

### 3. Displaying Dependencies — Inline text below blocked items

**Decision:** When a blocked todo has `blockedBy.length > 0`, render a small text line below the todo text:

> _Blocked by: Buy milk, Walk dog_

- Use the blocker tasks' text, truncated to ~30 chars each.
- Comma-separated. If more than 3 blockers, show first 2 + "+ N more".
- Styled with smaller font, muted color (like a subtitle).
- This line is always visible on blocked items (regardless of whether the picker panel is open).
- If a blocker ID no longer resolves (deleted), it's silently omitted from display.

### 4. Edge Cases

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| **Blocking task is deleted** | Remove its ID from all `blockedBy` arrays. If a todo's `blockedBy` becomes empty, auto-set its status to `active`. | Stale references are confusing. Auto-unblock prevents orphaned blocked state. |
| **Blocking task is completed/cancelled** | Remove its ID from all `blockedBy` arrays. If `blockedBy` becomes empty, auto-set status to `active`. | A resolved blocker is no longer a blocker. Same cleanup as deletion. |
| **Task blocked by a blocked task** | Allowed. No circular-dependency detection. | This is a todo list, not a project scheduler. Cycles are harmless — the user can manually unblock. Adding cycle detection is disproportionate. |
| **User unchecks all blockers** | `blockedBy` becomes `[]`. Auto-set status to `active`. | A blocked task with no blockers is semantically active. |
| **Status changed away from "blocked"** | Clear `blockedBy` to `[]`. | Keeps data clean. If the user re-blocks later, they pick fresh blockers. |
| **User sets status to "blocked" with no blockers selected yet** | Status is "blocked" with `blockedBy: []`. The picker is shown so user can select. No auto-revert to active in this transitional moment. | The status change is the trigger that opens the picker. Immediate revert would make it impossible to enter blocked state. |

**Note on the "transitional blocked" state:** A todo can momentarily be `status: "blocked"` with `blockedBy: []` — this happens right after the user selects "Blocked" from the dropdown, before they've picked any blockers. The auto-unblock rule (empty blockedBy → active) fires only when blockers are *removed*, not on initial status change.

### 5. localStorage — Migration and Persistence

**Decision:** No schema version field. Backward-compatible detection on load.

- **New format:** `{ id, text, status, blockedBy? }` — `blockedBy` is optional.
- **Migration (load-time):** If a todo has `status === "blocked"` and no `blockedBy` field, set `blockedBy: []`. For all other statuses, omit `blockedBy` or set to `[]`.
- **Cleanup (save-time):** When serializing, omit `blockedBy` if it's empty or status isn't "blocked". This keeps stored JSON clean and backward-compatible — older code will simply ignore the field.
- **No new storage key.** Same `"todos"` key, same array structure.

---

## Consequences

- **Simple and self-contained.** No new data structures, no new storage keys.
- **Auto-cleanup on delete/complete keeps data healthy** but may surprise users who expected a blocked task to stay blocked after its blocker is done. This is the right trade-off for a lightweight app — users can always re-block.
- **No circular dependency protection.** Acceptable for a todo app. If this ever becomes a project tool, revisit.
- **The inline picker adds DOM complexity to the render function.** Each blocked item gets a sub-list of checkboxes. Performance is fine for a reasonable number of todos (<100).
