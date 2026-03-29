# ADR: Multi-state todos (active / done / cancelled / blocked)

**By:** Danny (Lead/Architect)
**Date:** 2025-07-17
**Status:** Proposed

---

## Context

The app currently models todos as `{ id, text, done: bool }` — a binary toggle. Users want richer state tracking: a todo can be **active** (in progress), **done** (completed), **cancelled** (abandoned), or **blocked** (waiting on something). The existing checkbox toggle and "Clear done" button need to evolve to support this.

This is still a single-file, no-framework app. Decisions must stay proportional to that scope.

---

## Decisions

### 1. Data model: `done: bool` → `status: string`

Replace the boolean `done` field with a `status` string enum.

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
- A single field means states are mutually exclusive by construction (no "done AND blocked" bugs).

### 2. UI interaction: Option B — inline `<select>` dropdown

**Chosen:** Replace the checkbox with a small `<select>` element showing the current status.

**Rejected alternatives:**
- **Option A (checkbox + context menu):** Two controls for one concept. Adds interaction complexity and discoverability issues. How does the user know there's a secondary menu?
- **Option C (click to cycle):** Requires the user to know the state order. Cycling through 4 states to get back to "active" is 3 clicks. Accidental clicks land you in the wrong state with no affordance showing what comes next.

**Why Option B wins for this app:**
- A `<select>` is the standard HTML control for "pick one of N" — zero learning curve.
- One control, one concept, always visible. No hidden interactions.
- Accessible out of the box — keyboard and screen reader support for free.
- Keeps the UI minimal: the select replaces the checkbox in the same layout slot.
- For 4 options, a native `<select>` is proportional. If we had 10+ states we'd reconsider.

**Implementation notes:**
- The `<select>` replaces the `<input type="checkbox">` in each `<li>`.
- Options: `Active`, `Done`, `Cancelled`, `Blocked`.
- Use a `change` event listener that calls a new `setStatus(id, newStatus)` function.
- Style the select to be compact (no wide padding). Use a fixed width (~100px) so the list doesn't jump when status text length changes.

### 3. Visual treatment

Each state gets a CSS class on the `<li>`:

| Status | CSS class | Visual treatment |
|--------|-----------|------------------|
| `active` | *(none / default)* | Current default styling — white background, full opacity |
| `done` | `.status-done` | Strikethrough text + `opacity: 0.6` + muted text color `#999` (matches current `.done` style) |
| `cancelled` | `.status-cancelled` | Strikethrough text + `opacity: 0.5` + text color `#c0392b` (muted red). Visually "more dismissed" than done. |
| `blocked` | `.status-blocked` | Left border `3px solid #e67e22` (orange) + background `#fffbf0` (light warm tint). No strikethrough — the text is still relevant. |

**Why these choices:**
- Done and cancelled both get strikethrough because the todo text is no longer actionable, but the color difference (grey vs. red) distinguishes intent.
- Blocked uses a left-border accent rather than text styling — the task text itself hasn't changed, only its ability to proceed. The warm tint draws the eye without implying the item is finished.
- All treatments work in both light backgrounds and meet WCAG AA contrast minimums against white.

### 4. "Clear done" button → "Clear finished"

Rename the button to **"Clear finished"**. It removes all todos with status `"done"` OR `"cancelled"`.

**Rationale:**
- Done and cancelled are both terminal states — neither requires further action. Keeping cancelled items around permanently defeats the purpose of having the state.
- A single button is simpler than two buttons ("Clear done" + "Clear cancelled") for a 4-state app.
- "Finished" communicates "no longer active" better than "done" when cancelled items are also removed.
- The button is disabled when there are zero done + zero cancelled todos.

**Rejected:** Separate "Clear cancelled" button — adds UI clutter for a marginal distinction.

### 5. localStorage migration

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
- After migration, immediately `saveTodos()` so the old format is overwritten.
- No version field needed — the presence of `done` vs `status` is the version signal. Keep it simple.

**Why not a version number?** This is a single-file app with one migration. A version/schema system is over-engineering. If we ever need a second migration, we can add one then.

---

## Consequences

### For the team

- **Livingston (UX):** Replace the checkbox with a `<select>`. Add CSS classes for the 4 states. Rename the clear button and update its logic. The drag-and-drop code doesn't change — it operates on list items regardless of state.
- **Linus (QA):** Update acceptance criteria tests. The toggle test (AC3) becomes a state-change test. Verify migration by loading old-format localStorage data. Verify "Clear finished" removes both done and cancelled.
- **PRD:** Updated (see below) — §4.2 and §4.5 revised, acceptance criteria amended.

### What changes in the codebase

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

- **Native `<select>` styling:** Native selects are hard to style consistently cross-browser. Accept the platform look — don't fight it. A custom dropdown would violate the "no framework, keep it simple" constraint.
- **Accidental state changes:** A `<select>` can be changed with a single click. This is intentional — the same was true of the checkbox. There's no undo, same as before.
- **Migration edge cases:** Corrupted localStorage could have todos missing both `done` and `status`. The migration should default these to `"active"`.
