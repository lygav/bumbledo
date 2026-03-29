# PRD: Actionable Now

**Author:** Tess  
**Status:** Draft  
**Date:** 2025-07-19

---

## 1. Overview

"Actionable Now" is a filtered view of the task list that shows **only tasks a user can actually work on right now** — hiding everything that's done, cancelled, or blocked by incomplete prerequisites. It answers the single most common question every persona asks when they open bumbledo: **"What can I actually do right now?"**

**Why:** Bumbledo already tracks dependencies and blocked states — but the default list mixes actionable tasks with blocked, done, and cancelled items. When Priya opens bumbledo with her morning coffee, she doesn't want to mentally filter 30 tasks to find the 8 she can act on today. She wants to flip a switch and see *only* the things she can pick up. This is the #1 gap across all four personas: instant clarity on what's ready.

---

## 2. Goals & Non-Goals

### Goals

- Provide a toggle/filter that shows only unblocked, active tasks (hiding done, cancelled, and blocked items)
- Display a count summary: "N of M tasks are actionable" so users always know scope
- Remember the user's filter preference across sessions (localStorage)
- Keep the feature lightweight — a filter toggle, not a separate page or mode
- Work with existing data model; no new fields or storage keys needed

### Non-Goals

- No separate "Actionable" page or route — this is an inline filter on the existing list
- No smart ordering or auto-prioritization of actionable tasks
- No time-based filtering (e.g., "actionable today" vs. "actionable this week")
- No due date or calendar awareness
- No notifications when the actionable count changes (Smart Blocked Alerts covers that)
- No grouping or categorization within the filtered view
- No "snooze" or "hide until later" functionality

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| U1 | Priya (Household Organizer) | Toggle to see only actionable tasks during my morning coffee | I instantly know which errands I can run, which meals I can prep, and which calls I can make — without scanning past things I'm waiting on (like the landlord's approval or a package delivery) |
| U2 | Daniel (Wellness & Routine Tracker) | Open bumbledo Sunday evening and see only what's ready for my week | I can plan my Monday without being distracted by medical steps I'm waiting on (like blood work results) or fitness milestones that depend on completing earlier weeks |
| U3 | Jake (Student Life Planner) | Check between classes and see only unblocked tasks | I can grab the most impactful thing to knock out in 30 minutes — homework that's ready, chores I can do, errands I can run — without wading through 40 items where half are blocked by prerequisites |
| U4 | Marco (Side-Project Hobbyist) | Open bumbledo on Saturday morning and see only what I can tackle | I stop wasting weekend time figuring out what's available across my renovation, car maintenance, and side projects — I just see the list and start doing |
| U5 | Any user | See how many tasks are actionable out of my total | I get a sense of how much of my list is available to work on vs. waiting on something else |
| U6 | Any user | Have bumbledo remember my filter preference | I don't have to re-toggle the filter every time I open the app — it picks up where I left off |
| U7 | Any user | Switch back to the full list view at any time | I can still see everything when I need the big picture — blocked items, completed items, and all |

---

## 4. Functional Requirements

### 4.1 Filter Toggle

- Add a toggle control (button or switch) near the top of the task list, labeled **"Actionable"** (or "Show actionable only")
- The toggle has two states:
  - **Off (default for new users):** Show all tasks (current behavior)
  - **On:** Show only tasks where `status === "active"` — hiding `done`, `cancelled`, and `blocked` tasks
- Toggling the filter immediately updates the visible list (no page reload, no delay)
- The toggle is always visible, whether the list is empty or has hundreds of tasks

### 4.2 Actionable Count Summary

- Display a count summary near the toggle: **"N of M tasks are actionable"**
  - `N` = number of tasks with `status === "active"` (not done, not cancelled, not blocked)
  - `M` = total number of tasks in the list (all statuses)
- The count updates in real time as tasks are added, completed, deleted, or unblocked
- When the filter is active and no tasks are actionable, show a friendly empty state: **"Nothing actionable right now. All your tasks are either done or waiting on something."**
- When the filter is off, still show the count as informational context (e.g., above the list or in a subtle status bar)

### 4.3 Filter Logic

A task is **actionable** if and only if:
1. Its `status` is `"active"` — meaning it is not `done`, `cancelled`, or `blocked`

This is a simple status check. Tasks with `status === "blocked"` are hidden regardless of whether their blockers are done or not — the existing auto-unblock logic (ADR-001) already transitions tasks from `blocked` to `active` when all blockers complete. The filter simply reads the current `status` field.

**Edge cases:**
- A task that was just unblocked (auto-reverted to `active` by ADR-001 logic) immediately appears in the actionable view — no extra handling needed
- A newly added task (default `status: "active"`) immediately appears in the actionable view
- If the user changes a task's status to `blocked` while the filter is on, the task disappears from view
- If the user changes a task's status to `done` or `cancelled` while the filter is on, the task disappears from view

### 4.4 Persistence

- Store the filter state in localStorage key: `"bumbledo_filter_actionable"` with value `"true"` or `"false"`
- On page load, read the stored preference and apply the filter accordingly
- If no stored value exists, default to `"false"` (show all tasks — existing behavior preserved)
- The stored preference is independent of the todo list data (`"todos"` key) — no migration needed

### 4.5 Interaction with Existing Features

- **Drag-and-drop:** When the filter is active, only actionable tasks are visible — but their underlying order in the full list is preserved. Dragging in filtered mode reorders only among visible items. When the filter is turned off, non-actionable items reappear in their original positions.
- **Clear finished:** Still operates on the full list (removes all done + cancelled), regardless of filter state
- **Empty state:** If all tasks are filtered out, show the actionable-specific empty state (§4.2), not the "No todos yet" message
- **Dependency graph:** The graph always shows the full dependency structure regardless of filter — it's a planning tool, not a "what's next" tool
- **Burndown view:** Unaffected — burndown samples the full list, not the filtered view
- **Smart Blocked Alerts:** Complementary — alerts notify you *when* something unblocks; Actionable Now shows you *what's* unblocked right now
- **Keyboard shortcuts:** Navigation shortcuts (arrow keys) operate on the visible (filtered) list only

### 4.6 Visual Treatment

- The toggle should be visually lightweight — not a primary action, but easy to find
- When the filter is active, consider a subtle visual indicator (e.g., the toggle is highlighted, or a small badge/pill shows the count)
- The count summary should be readable but not dominant — secondary text below or beside the toggle
- No changes to individual task styling — the filter only controls visibility, not appearance

---

## 5. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | A toggle control labeled "Actionable" is visible near the top of the task list. |
| AC2 | Clicking the toggle hides all tasks with status `done`, `cancelled`, or `blocked`, showing only `active` tasks. |
| AC3 | Clicking the toggle again restores the full list (all statuses visible). |
| AC4 | A count summary "N of M tasks are actionable" is displayed and updates in real time as tasks change. |
| AC5 | When the filter is active and no tasks are actionable, a friendly empty state message is shown (not the "No todos yet" message). |
| AC6 | The filter preference persists in localStorage. Refreshing the page preserves the toggle state. |
| AC7 | A newly added task (status: active) immediately appears in the filtered view. |
| AC8 | A task whose status changes to `blocked`, `done`, or `cancelled` while the filter is on disappears from the visible list. |
| AC9 | A task that auto-unblocks (blockers completed, status reverts to active) immediately appears in the filtered view. |
| AC10 | Drag-and-drop reordering works correctly in filtered mode: only visible tasks are reorderable; full list order is preserved. |
| AC11 | "Clear finished" removes done/cancelled tasks from the full list regardless of filter state. |
| AC12 | The dependency graph is unaffected by the filter — it always shows the full DAG. |
| AC13 | The toggle and count summary are usable on mobile (320px) and desktop (1440px) without layout issues. |
| AC14 | All filter controls are keyboard-accessible. |

---

## 6. Out of Scope (v1)

- Multiple filter options (e.g., "show blocked only", "show done only") — this is a single actionable toggle
- Saved filter presets or named views
- Filter by text search or keyword
- Time-based filtering ("actionable today" vs. "actionable this week")
- Auto-sorting actionable tasks by priority, creation date, or dependency depth
- Filter animations or transitions (tasks appearing/disappearing can be instant)
- Badge or count in browser tab title
- Filter state synced across browser tabs

---

## 7. Dependencies

- **Existing features:** Task states (`active`, `done`, `cancelled`, `blocked`), `blockedBy` auto-unblock logic (ADR-001), localStorage persistence
- **New data:** `"bumbledo_filter_actionable"` localStorage key (separate, non-breaking, no migration)
- **Complements:** Smart Blocked Alerts (alerts notify on unblock events; Actionable Now shows the current state)
- **Does not block:** Other features; purely additive UI enhancement on top of existing task state logic

---

*This is the simplest high-impact feature bumbledo can ship. Every persona — Priya with her morning coffee, Daniel planning his week, Jake between classes, Marco on Saturday morning — opens bumbledo to answer one question: "What can I do right now?" Actionable Now gives them the answer in one click.*
