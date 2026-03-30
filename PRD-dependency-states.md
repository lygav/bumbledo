# PRD: Task Dependency State Interactions

**Author:** Tess (Product Manager)
**Status:** Revised per stakeholder feedback
**Date:** 2025-07-19 (revised 2025-07-22)
**Requested by:** Vladi Lyga

---

## 1. Problem Statement

### The Immediate Bug

Users cannot cancel a blocked task that has active blockers. When a user selects "Cancelled" from the status dropdown on a blocked task, the app rejects the change and shows a "blocked completion" warning — the same guard that (correctly) prevents marking a blocked task as "Done."

**Root cause:** The `selectBlockedStatusChange` guard in `selectors.js` treats both terminal statuses (`done` and `cancelled`) identically. It checks `TERMINAL_STATUS_SET.has(nextStatus)`, which blocks the transition to *either* terminal state when active blockers exist. Cancellation is conceptually different from completion — "I'm not doing this anymore" is valid regardless of blocker state.

### The Systemic Issue

The dependency system was built incrementally (ADR-001 for blocked-by, ADR-002 for multi-state, later adding `inprogress`). Each piece works in isolation, but the **interactions between statuses and dependencies are undefined**. There is no single document that specifies what should happen for every combination of:

- A task's current status
- The target status a user selects
- Whether the task has blockers (is blocked by others)
- Whether the task is a blocker (other tasks depend on it)

This leads to recurring bugs because each new feature or fix addresses one case without a reference for the complete picture. This PRD defines that complete picture.

---

## 2. Status Definitions

Bumbledo has five task statuses. Two are **actionable** (the task can be worked on), two are **terminal** (the task is finished), and one is **dependency-driven** (determined by relationships to other tasks).

| Status | Internal Value | UI Label | Category | Meaning |
|--------|---------------|----------|----------|---------|
| **To Do** | `todo` | To Do | Actionable | Not started. Available to work on. Default for new tasks. |
| **In Progress** | `inprogress` | In Progress | Actionable | Actively being worked on. |
| **Done** | `done` | Done | Terminal | Completed successfully. |
| **Cancelled** | `cancelled` | Cancelled | Terminal | Abandoned. The user decided not to do this task. |
| **Blocked** | `blocked` | Blocked | Dependency | Cannot proceed because it depends on other uncompleted tasks. Has a `blockedBy` array of task IDs. |

### Key Distinctions

- **Done vs. Cancelled:** Both are terminal, but they have different semantic meaning. "Done" means the work was accomplished. "Cancelled" means the user chose to abandon it. Both release dependent tasks.
- **Blocked is structural, not manual:** A task is blocked *because* it has active blockers, not because the user arbitrarily labeled it. When all blockers are resolved, the block should lift automatically.
- **Actionable means "can be worked on now":** Both `todo` and `inprogress` are actionable. The "Ready" filter shows only these.

---

## 3. Dependency Concepts

Before defining rules, clarify the two roles a task can play:

| Role | Meaning | Example |
|------|---------|---------|
| **Dependent** | This task has entries in its `blockedBy` array — it is waiting on other tasks. | "Paint walls" is blocked by "Buy paint" |
| **Blocker** | This task appears in another task's `blockedBy` array — other tasks are waiting on it. | "Buy paint" is a blocker for "Paint walls" |

A task can be both simultaneously (it blocks some tasks while being blocked by others). These roles are independent.

---

## 4. Complete Interaction Rules

### 4.1 Transitions FOR a task that IS a dependent (has blockers)

These rules govern what a user can do with a task that is currently in `blocked` status with active blockers.

> **⚠️ STRICT RULE (stakeholder mandate):**
> While a task has **any active blockers**, the **ONLY** allowed status transition is **blocked → cancelled**. All other manual transitions are forbidden. The task can only leave `blocked` status in two ways: cancellation by the user, or automatic unblocking when all blockers resolve.

| Transition | Allowed? | Behavior | Rationale |
|-----------|----------|----------|-----------|
| blocked → todo | ❌ **FORBIDDEN** while active blockers exist | Denied. Dropdown option is disabled. | A blocked task's status is structurally determined by its dependencies. The user cannot manually override the block — blockers must be resolved first. |
| blocked → inprogress | ❌ **FORBIDDEN** while active blockers exist | Denied. Dropdown option is disabled. | Same as above. Starting work on a task whose prerequisites are unmet is not allowed. |
| blocked → done | ❌ **FORBIDDEN** while active blockers exist | Denied. Dropdown option is disabled. Warning: "This task is blocked by N task(s). Complete or cancel them first." | Completing a task that has unfinished prerequisites doesn't make sense. |
| blocked → cancelled | ✅ **Yes, always** | Clean up `blockedBy`. If this task is a blocker for others, release them (see §4.2). | Cancellation means "I'm not doing this." That's valid regardless of blocker state. **This is the bug fix.** |

**Automatic transitions for dependents:**

| Trigger | Behavior |
|---------|----------|
| All blockers become done or cancelled | Auto-transition from `blocked` → `todo`. Show "unblocked" highlight (per Smart Blocked Alerts PRD). Normal transition rules apply from `todo`. |
| A blocker is deleted | Remove it from `blockedBy`. If `blockedBy` becomes empty, auto-transition to `todo`. |
| User unchecks all blockers in picker | `blockedBy` becomes empty. Auto-transition to `todo`. |

### 4.2 Transitions FOR a task that IS a blocker (other tasks depend on it)

These rules define the cascade effects when a blocker task changes status.

| Transition | Cascade Effect |
|-----------|---------------|
| Any status → done | Remove this task's ID from all `blockedBy` arrays. Any dependent whose `blockedBy` becomes empty auto-transitions to `todo`. Trigger unblocked highlight. |
| Any status → cancelled | **Same as done.** Remove from all `blockedBy` arrays. Dependents with empty `blockedBy` auto-transition to `todo`. Trigger unblocked highlight. |
| Any status → deleted | Remove from all `blockedBy` arrays. Dependents with empty `blockedBy` auto-transition to `todo`. Trigger unblocked highlight. |
| done → todo (reopen) | **No automatic re-blocking.** Dependents that were previously unblocked remain in their current state. See §4.4 Edge Case E1. |
| done → inprogress | **No automatic re-blocking.** Same as reopening to todo. |
| cancelled → todo (reopen) | **No automatic re-blocking.** Same principle. |

### 4.3 General Status Transition Table

For all tasks, regardless of dependency role. This table defines the allowed transitions and any guards.

| From → To | Allowed? | Guard / Side Effect |
|-----------|----------|-------------------|
| todo → inprogress | ✅ Yes | None. |
| todo → done | ✅ Yes | If this task is a blocker, cascade cleanup (§4.2). |
| todo → cancelled | ✅ Yes | If this task is a blocker, cascade cleanup (§4.2). |
| todo → blocked | ✅ Yes | Show blocker picker. `blockedBy` starts as `[]`. |
| inprogress → todo | ✅ Yes | None. |
| inprogress → done | ✅ Yes | If this task is a blocker, cascade cleanup (§4.2). |
| inprogress → cancelled | ✅ Yes | If this task is a blocker, cascade cleanup (§4.2). |
| inprogress → blocked | ✅ Yes | Show blocker picker. `blockedBy` starts as `[]`. |
| done → todo | ✅ Yes | No re-blocking of dependents (§4.2). |
| done → inprogress | ✅ Yes | No re-blocking of dependents. |
| done → cancelled | ✅ Yes | No additional cascade (already terminal). |
| done → blocked | ✅ Yes | Show blocker picker. User must select blockers. |
| cancelled → todo | ✅ Yes | No re-blocking of dependents (§4.2). |
| cancelled → inprogress | ✅ Yes | No re-blocking of dependents. |
| cancelled → done | ✅ Yes | No additional cascade. |
| cancelled → blocked | ✅ Yes | Show blocker picker. User must select blockers. |
| blocked → todo | ❌ **No** (while active blockers exist) | Denied. Dropdown option is disabled. User must resolve blockers first, or cancel the task. | Blocked status is structural. See §4.1 strict rule. |
| blocked → inprogress | ❌ **No** (while active blockers exist) | Denied. Dropdown option is disabled. | Blocked status is structural. See §4.1 strict rule. |
| blocked → done | ❌ **No** (while active blockers exist) | Denied. Dropdown option is disabled. Warning: "This task is blocked by N task(s). Complete or cancel them first." | Blocked status is structural. See §4.1 strict rule. |
| blocked → cancelled | ✅ Yes, always | Clear `blockedBy`. If this task is a blocker for others, cascade cleanup (§4.2). **This is the bug fix.** |

### 4.4 Edge Cases

**E1: Reopening a completed blocker**
A user marks "Buy paint" as done, which unblocks "Paint walls" (auto-transitions to `todo`). Then the user reopens "Buy paint" back to `todo`.

- **Behavior:** "Paint walls" stays in `todo`. It is NOT automatically re-blocked.
- **Rationale:** The `blockedBy` array was cleaned up when "Buy paint" completed. The dependency relationship no longer exists in the data. Re-establishing it would require the user to manually set "Paint walls" back to blocked and re-select "Buy paint" as a blocker.
- **Why not auto-re-block?** Auto-re-blocking would be surprising and disruptive. The user may have already started working on "Paint walls." Dependents should only be blocked by explicit user action, not implicit state inference.

**E2: Circular dependencies**
Circular dependencies are prevented at the point of creation (blocker picker rejects selections that would form a cycle, per ADR-001 revision). No additional handling is needed for status transitions because cycles cannot exist in valid data.

- **Behavior:** When a user checks a blocker in the picker, if adding that blocker would create a cycle (A blocks B blocks A), the checkbox is rejected with the message: "Can't add — would create a circular dependency."
- **Validation:** The `wouldCreateCycle` function performs a BFS traversal to detect cycles before allowing a blocker to be added.

**E3: Deleting a task that blocks multiple tasks**
A user deletes "Buy paint" which blocks both "Paint walls" and "Paint trim."

- **Behavior:** "Buy paint" is removed from both tasks' `blockedBy` arrays. Any task whose `blockedBy` becomes empty auto-transitions to `todo`. This already works correctly via `cleanupBlockedBy`.
- **No confirmation dialog** for the delete itself (per PRD.md §4.4: "no confirmation dialog"). See §5.2 for future consideration.

**E4: "Clear finished" when done tasks are blockers**
A user clicks "Clear finished." Several done tasks are blockers for blocked tasks.

- **Behavior:** Each removed task triggers `cleanupBlockedBy`, which removes it from all `blockedBy` arrays. This is processed iteratively. Any blocked task whose blockers are all cleared auto-transitions to `todo`. This already works correctly via the `clearFinished` function in model.js.

**E5: Self-referencing dependencies**
A task cannot block itself. The `wouldCreateCycle` function returns `true` when `taskId === blockerId`, and the blocker picker only shows *other* tasks (filtered by `item.id !== todo.id`). Both guards prevent self-reference.

**E6: Blocker task is itself blocked**
"Task C" is blocked by "Task B," which is blocked by "Task A." The user completes "Task A."

- **Behavior:** "Task A" is removed from "Task B"'s `blockedBy`. If "Task B"'s `blockedBy` is now empty, "Task B" auto-transitions to `todo`. "Task C" remains blocked because "Task B" still exists in its `blockedBy` array (even though "Task B" is no longer blocked itself). "Task C" will unblock when "Task B" is completed, cancelled, or deleted.
- **Note:** The `hasActiveBlockers` function already handles this correctly — it walks the chain to determine if a blocker is truly active.

**E7: Keyboard status cycling for blocked tasks**
The keyboard shortcut (`Cmd+1` / `Ctrl+1`) cycles through statuses via `TODO_STATUS_CYCLE`. Blocked tasks with active blockers are excluded from cycling (the cycle function returns the task unchanged).

- **Behavior:** Keyboard cycling on a blocked task with active blockers should be a no-op. The user must use the dropdown to cancel the task (the only allowed transition per §4.1).
- **Rationale:** The cycle path is `todo → inprogress → done → todo`. Blocked is outside this cycle. Per the strict rule in §4.1, no transition except blocked → cancelled is allowed while active blockers exist, and cancellation is not part of the keyboard cycle.

---

## 5. UX Behavior

### 5.1 Status Dropdown

When a task has **active blockers** (is in `blocked` status with a non-empty `blockedBy`), the status dropdown (`<select>`) must **disable all options except "Cancelled."** The disabled options should appear greyed out to signal they are unavailable.

- **Rationale:** Vladi's strict rule (§4.1) forbids all transitions except blocked → cancelled while blockers exist. Disabling options prevents user confusion — rather than allowing a selection and then rejecting it, the UI communicates upfront that these transitions are not available.
- **When all blockers are resolved:** The task auto-transitions to `todo`, at which point the dropdown shows all options enabled and normal transition rules apply.
- **For tasks NOT in blocked status:** The dropdown shows all five status options enabled as before.

### 5.2 Confirmation Dialogs

**Current state:** No confirmation dialogs exist for any action (per PRD.md: "no confirmation dialog" for delete, "low-risk" for clear finished).

**This PRD does not add confirmation dialogs.** The principle of frictionless interaction (history.md UX Principle #1) outweighs the risk. Undo would be the right solution for accidental actions, but undo is out of scope (PRD.md §8).

**Future consideration:** If user testing reveals frequent accidental deletions of blocker tasks, consider adding a lightweight confirmation: "This task blocks 3 others. They will be unblocked. Delete?" This is explicitly deferred — do not implement unless validated by user feedback.

### 5.3 User Feedback

| Scenario | Feedback |
|----------|----------|
| Blocked task with active blockers — dropdown interaction | "To Do", "In Progress", and "Done" options are **disabled** (greyed out). Only "Cancelled" is selectable. No toast needed — the disabled state is self-explanatory. |
| Task completed/cancelled and dependents unblocked | Unblocked tasks get the "unblocked" highlight animation (per Smart Blocked Alerts PRD). Toast: "You've unblocked N task(s)!" |
| Task deleted and dependents unblocked | Same unblocked highlight. No additional toast for the delete itself. |
| Blocked → cancelled (the bug fix) | Task transitions to cancelled normally. If this task was a blocker for others, standard unblocked feedback applies. |
| Clear finished removes blocker tasks | Unblocked highlight on newly unblocked tasks. Standard "clear finished" behavior. |

### 5.4 Blocker Picker Behavior

The blocker picker (inline checkbox panel) is shown when a task's status is `blocked`. It lists eligible tasks (those with status `todo`, `inprogress`, or `blocked`).

- **When a task transitions away from blocked** (via dropdown or auto-unblock): The picker disappears. `blockedBy` is cleared.
- **When a blocked task is cancelled:** The picker disappears. `blockedBy` is cleared. This is the natural consequence of the status change.
- **Finalization:** When the user moves focus away from a blocked task's row (clicks elsewhere), if `blockedBy` is still empty, the task auto-reverts to `todo`. This prevents orphaned blocked tasks with no blockers.

---

## 6. Acceptance Criteria

Each criterion maps to a specific rule from §4. All must pass in Chrome and Firefox (latest).

### Bug Fix: Blocked → Cancelled

| # | Criterion | Rule |
|---|-----------|------|
| AC1 | A blocked task with active blockers can be set to "Cancelled" via the status dropdown. The task transitions to cancelled, `blockedBy` is cleared, and the blocker picker disappears. | §4.1, §4.3 |
| AC2 | When a blocked task is cancelled and it was a blocker for other tasks, those tasks have this task removed from their `blockedBy`. If their `blockedBy` becomes empty, they auto-transition to `todo`. | §4.2 |
| AC3 | The blocked → done guard still works: a blocked task with active blockers CANNOT be set to "Done." The dropdown option is disabled. | §4.1, §4.3 |

### Strict Blocked Transition Rules

| # | Criterion | Rule |
|---|-----------|------|
| AC8 | A blocked task with active blockers CANNOT be set to "To Do" via the dropdown. The option is disabled (greyed out). | §4.1, §4.3 |
| AC9 | A blocked task with active blockers CANNOT be set to "In Progress" via the dropdown. The option is disabled (greyed out). | §4.1, §4.3 |
| AC-8a | When a blocked task has active blockers, the status dropdown disables all options except "Cancelled." | §5.1 |
| AC-8b | When all blockers of a blocked task are resolved (done/cancelled/deleted), the task auto-transitions to `todo` and all dropdown options become enabled. | §4.1 |

### Cascade Behavior

| # | Criterion | Rule |
|---|-----------|------|
| AC4 | Completing a task (any status → done) removes it from all other tasks' `blockedBy` arrays. Blocked tasks whose `blockedBy` becomes empty auto-transition to `todo`. | §4.2 |
| AC5 | Cancelling a task (any status → cancelled) removes it from all other tasks' `blockedBy` arrays, with the same auto-unblock behavior as completion. | §4.2 |
| AC6 | Deleting a task removes it from all other tasks' `blockedBy` arrays, with the same auto-unblock behavior. | §4.2 |
| AC7 | "Clear finished" removes done and cancelled tasks. For each removed task, `blockedBy` cleanup runs. Blocked tasks whose blockers are all cleared auto-transition to `todo`. | §4.4 E4 |

### Reopen Behavior

| # | Criterion | Rule |
|---|-----------|------|
| AC10 | Reopening a completed task (done → todo) does NOT re-block tasks that were previously unblocked by its completion. | §4.4 E1 |
| AC11 | Reopening a cancelled task (cancelled → todo) does NOT re-block tasks that were previously unblocked by its cancellation. | §4.4 E1 |

### Dependency Integrity

| # | Criterion | Rule |
|---|-----------|------|
| AC12 | Circular dependencies cannot be created. Attempting to add a blocker that would form a cycle is rejected with an error message. | §4.4 E2 |
| AC13 | A task cannot block itself. The blocker picker does not list the task itself. | §4.4 E5 |
| AC14 | When ALL blockers of a blocked task are resolved (done/cancelled/deleted), the task auto-transitions to `todo`. From `todo`, the user can then transition to `done` normally. There is no direct blocked → done path. | §4.1 |

### Keyboard Cycling

| # | Criterion | Rule |
|---|-----------|------|
| AC15 | Keyboard status cycling (Cmd/Ctrl+1) on a blocked task with active blockers is a no-op. The task remains blocked. | §4.4 E7 |
| AC16 | Keyboard status cycling follows the path: todo → inprogress → done → todo. Cancelled and blocked are not part of the keyboard cycle. | §4.4 E7 |

### Data Persistence

| # | Criterion | Rule |
|---|-----------|------|
| AC17 | All status transitions and `blockedBy` changes persist to localStorage. Reloading the page restores the exact state. | PRD.md §4.7 |
| AC18 | When a blocked task transitions away from blocked (by any means), `blockedBy` is omitted from the saved JSON. | ADR-001 |

---

## 7. Implementation Notes

These are observations for the implementing engineer, not product requirements.

### The Bug Fix (AC1–AC3)

The fix is in `selectBlockedStatusChange` in `src/app/selectors.js`. The guard currently uses `TERMINAL_STATUS_SET.has(nextStatus)` which catches both `done` and `cancelled`. Per the strict rule (§4.1), the guard should block **all** transitions except `cancelled` when active blockers exist:

```
// Current (buggy):
TERMINAL_STATUS_SET.has(nextStatus)

// Should be (strict rule):
nextStatus !== TODO_STATUS.CANCELLED
```

When active blockers exist, **only** `cancelled` is allowed. All other transitions (`todo`, `inprogress`, `done`) are denied. The dropdown should disable these options (§5.1) so the guard is a safety net, not the primary UX.

The `setTaskStatus` action in `store.js` already handles `cancelled` cleanup correctly (lines 431–438) — it runs `cleanupBlockedBy` for both done and cancelled. The only problem is the guard preventing the code from reaching that cleanup logic.

### Dropdown Disabling (AC-8a)

When a task is in `blocked` status with active blockers, the status dropdown must disable all options except "Cancelled." This is a new UX requirement (§5.1) that replaces the previous approach of showing all options and rejecting invalid selections with a toast.

### Cascade Cleanup

The `cleanupBlockedBy` and `detectUnblockedTodos` functions in `model.js` already handle cascade correctly. The `setTaskStatus` action in `store.js` calls these for both `done` and `cancelled` transitions. **No changes needed here.**

---

## 8. What This PRD Does NOT Cover

- **Undo:** Out of scope per PRD.md §8. Would be the ideal solution for accidental destructive actions.
- **Confirmation dialogs for blocker deletion:** Deferred. See §5.2.
- **Re-blocking on reopen:** Intentionally excluded. See §4.4 E1.
- **Dependency visualization changes:** The DAG graph is read-only and reflects current data. No changes needed for these rules.
- **New statuses:** This PRD documents interactions for the existing five statuses only.

---

*This PRD is the authoritative reference for how task statuses interact with dependencies. All five statuses × all dependency scenarios are covered. If an interaction is not listed here, it should be raised before implementation.*

---

## 9. PRD Revision History

| Date | Author | Change |
|------|--------|--------|
| 2025-07-19 | Tess | Initial draft. Defined all status × dependency interactions. Identified blocked → cancelled bug. |
| 2025-07-22 | Tess (per Vladi's feedback) | **Strict blocked transition rules.** While a task has active blockers, the ONLY allowed transition is blocked → cancelled. Removed manual override (blocked → todo, blocked → inprogress). Updated §4.1, §4.3, §5.1 (dropdown disabling), §5.3, §6 (acceptance criteria), §4.4 E7, and §7 (implementation notes). Status changed from "Draft" to "Revised." |
