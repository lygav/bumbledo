# PRD: Browser-Based Todo App

**Author:** Danny (Lead/Architect)
**Status:** Draft
**Date:** 2025-07-17

---

## 1. Overview

A single-page, browser-based todo application with dependency graph visualization. Users can add, complete, delete, and **drag-to-reorder** todo items, set task dependencies, and view blocking relationships in an interactive dependency graph. Data persists in `localStorage`.

**Target user:** Anyone who wants a lightweight, feature-rich task list with visual dependency tracking — no accounts, no backend, no frameworks.

---

## 2. Goals & Non-Goals

### Goals

- Ship a fully functional todo app with drag-and-drop and task dependency visualization
- Drag-and-drop reordering that feels responsive and intuitive
- Task blocking and dependency tracking with interactive graph visualization
- Persistent state across browser sessions via `localStorage`
- Clean, minimal UI that works on desktop and mobile browsers

### Non-Goals

- No backend, API, or database
- No authentication or multi-user support
- No framework dependencies (React, Vue, etc.)
- No offline-first/PWA features beyond basic `localStorage`
- No user accounts or multi-user list sharing

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| U1 | User | Add a new todo by typing text and pressing Enter (or clicking a button) | I can capture tasks quickly |
| U2 | User | Set a todo's state to done, cancelled, or blocked via a dropdown | I can track progress and surface obstacles |
| U3 | User | Change a todo's state back to active | I can reopen a task that's not finished |
| U4 | User | Delete a single todo | I can remove items I no longer need |
| U5 | User | Drag a todo to a new position in the list | I can prioritize my tasks visually |
| U6 | User | Click "Clear finished" to remove all done and cancelled todos at once | I can clean up my list without deleting one-by-one |
| U7 | User | Close the browser and come back to find my list intact | I don't lose my work |
| U8 | User | See a helpful message when I have no todos | I know the app is working and how to start |
| U9 | User | Specify which task(s) block a "blocked" todo | I can track *why* a task is stuck and what needs to happen first |
| U10 | User | See "Blocked by: ..." on a blocked todo | I can quickly see what's holding up a task without opening anything |

---

## 4. Functional Requirements

### 4.1 Adding a Todo

- A text input field at the top of the list.
- Pressing **Enter** or clicking an **Add** button creates a new todo with the entered text.
- New todos are appended to the **bottom** of the list.
- Empty or whitespace-only input is ignored (no empty todos).
- The input field clears after a successful add.
- The input field retains focus after adding, enabling rapid entry.

### 4.2 Task States

Each todo has one of four mutually exclusive states, controlled by a `<select>` dropdown that replaces the original checkbox:

| State | Default? | Description |
|-------|----------|-------------|
| **Active** | ✅ | The todo is actionable. This is the default for new items. |
| **Done** | | The todo is completed. Strikethrough text, muted color, reduced opacity. |
| **Cancelled** | | The todo was abandoned. Strikethrough text, muted red color, reduced opacity. |
| **Blocked** | | The todo is waiting on something. Orange left-border accent, warm background tint. Text remains unstyled. |

- Changing the dropdown immediately updates the todo's state and visual treatment.
- Todos remain in their current list position regardless of state — they are **not** automatically moved or hidden.
- The `<select>` is accessible by keyboard and screen reader out of the box.

### 4.3 Task Dependencies (Blocked-By)

When a todo's status is set to "blocked", the user can specify which other task(s) block it.

#### Data Model

- Each todo gains an optional `blockedBy` field: an array of todo IDs.
- `blockedBy` is only meaningful when `status === "blocked"`. It is cleared when status changes away from "blocked".
- Example: `{ "id": "abc", "text": "Deploy", "status": "blocked", "blockedBy": ["def"] }`

#### Setting Blockers

- When the user changes a todo's status to "blocked", an inline panel appears **below that list item** showing checkboxes for all other active or blocked tasks.
- Checking/unchecking a box immediately adds/removes that task's ID from `blockedBy` and persists the change.
- The panel is only visible on items with `status === "blocked"`.
- If there are no other eligible tasks, the panel shows: "No other tasks to select."

#### Displaying Blockers

- When a blocked todo has blockers, a subtitle line appears below the todo text: _"Blocked by: Task A, Task B"_.
- Blocker text is truncated to ~30 characters each. If more than 3 blockers, show the first 2 and "+ N more".
- Styled with smaller, muted text.

#### Edge Cases

- **Blocking task deleted or completed/cancelled:** Remove its ID from all `blockedBy` arrays. If `blockedBy` becomes empty, auto-set the blocked task's status to `active`.
- **Circular dependencies:** Allowed. No validation. A task may be blocked by a blocked task.
- **User unchecks all blockers:** `blockedBy` becomes `[]`, status auto-reverts to `active`.
- **Status changed away from "blocked":** `blockedBy` is cleared to `[]`.
- **Transitional state:** A todo can be `blocked` with `blockedBy: []` immediately after the user selects "Blocked" (before picking blockers). Auto-unblock fires only when blockers are *removed*, not on initial status change.

### 4.4 Deleting a Single Todo

- Each todo has a **delete** control (e.g., an "×" button).
- Clicking it removes the todo immediately — no confirmation dialog.
- The delete control should be visually subtle to avoid accidental clicks (e.g., visible on hover/focus, or low-contrast until hovered).

### 4.5 Drag-and-Drop Reordering

- Users can grab any todo and drag it to a new position in the list.
- While dragging, a visual indicator shows the insertion point (e.g., a line between items, or a placeholder).
- The dragged item is visually distinguished (e.g., slightly elevated/shadow, reduced opacity at source position).
- Dropping the item reorders the list and persists the new order.
- Must work with mouse. Touch support (mobile drag) is a stretch goal — document trade-offs if omitted.
- Implementation: use the **HTML5 Drag and Drop API** (`draggable`, `dragstart`, `dragover`, `drop` events). No external libraries.

### 4.6 "Clear Finished" Button

- A single button labeled **"Clear finished"**.
- Clicking it removes **all** todos with status `done` or `cancelled` (both are terminal states).
- The button is **disabled** when there are zero done + zero cancelled todos.
- No confirmation dialog — the action is low-risk since these items are already terminal.

### 4.7 Persistence (localStorage)

- The full todo list (text, done state, order) is saved to `localStorage` on every mutation (add, delete, toggle, reorder, clear done).
- On page load, the app reads from `localStorage` and restores the list.
- If `localStorage` is empty or missing, the app starts with an empty list (no sample data).
- Data format: a JSON array of objects, e.g.:
  ```json
  [
    { "id": "abc123", "text": "Buy milk", "status": "active" },
    { "id": "def456", "text": "Walk dog", "status": "done" },
    { "id": "ghi789", "text": "Old task", "status": "cancelled" },
    { "id": "jkl012", "text": "Deploy app", "status": "blocked", "blockedBy": ["abc123"] }
  ]
  ```
- **Migration:** On load, if a todo has the legacy `{ done: bool }` format and no `status` field, it is automatically migrated: `done: true` → `status: "done"`, `done: false` → `status: "active"`. The `done` field is removed and the migrated data is saved back immediately. If a todo has `status: "blocked"` but no `blockedBy` field, set `blockedBy: []`. When saving, omit `blockedBy` for non-blocked todos to keep stored JSON clean.
- Each todo gets a unique `id` (e.g., `Date.now().toString(36)` + random suffix). IDs are stable across reorders.
- `localStorage` key: `"todos"` (simple, no prefix needed for a single-page app).

### 4.8 Empty State

- When the list has zero todos, display a short message (e.g., "No todos yet. Add one above!").
- The empty state message disappears as soon as the first todo is added.

---

## 5. UI/UX Requirements

### Layout

- Centered, single-column layout, max-width ~600px.
- Top-to-bottom flow: **title/header → input field + add button → todo list → "Clear done" button (or footer area)**.

### Visual Design

- Clean, minimal aesthetic. No heavy theming.
- Use system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- Sufficient contrast for text readability (WCAG AA as a baseline target).
- Subtle hover/focus states on interactive elements.
- Done items: strikethrough + reduced opacity + muted grey text.
- Cancelled items: strikethrough + reduced opacity + muted red text.
- Blocked items: orange left-border accent + warm background tint.

### Responsiveness

- Fluid layout that works from ~320px to wide desktop.
- No horizontal scroll.
- Touch-friendly tap targets (minimum 44×44px hit area for checkboxes, delete buttons).

### Accessibility Basics

- All interactive elements reachable by keyboard (Tab, Enter, Space).
- Appropriate ARIA roles/labels on non-standard controls.
- Visible focus indicators.
- `<label>` associations for the input field.
- Semantic HTML: `<main>`, `<header>`, `<ul>`/`<li>` for the list, `<button>` for buttons (not `<div onclick>`).

---

## 6. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Architecture** | Modular ES modules in `src/` tree. Entry point: `index.html` → `src/main.js`. CSS inlined in HTML. |
| **Build tools** | Vite for dev server and production build. npm for package management. Dev workflow: `npm install` then `npm run dev`. |
| **No frameworks** | Vanilla HTML, CSS, JavaScript only. No React, Vue, jQuery, or UI frameworks. |
| **External dependencies** | Only `dagre` for dependency graph layout. No other third-party packages. |
| **No backend** | No server, no API calls, no database. `localStorage` only. |
| **Browser support** | Modern evergreen browsers (Chrome, Firefox, Safari, Edge — latest 2 versions). No IE11. |

---

## 7. Dependency Graph Visualization

### Overview

An interactive, SVG-based visualization showing task blocking relationships. When tasks have dependencies (via the `blockedBy` field), the graph displays them in a left-to-right layered layout.

### Features

- **Layout:** Directed acyclic graph (DAG) with layered left-to-right positioning using dagre
- **Cycle detection:** Dashed red edges and warning message when circular dependencies exist
- **Interactive nodes:** Click a node to select the corresponding task row (auto-scrolls into view)
- **Bidirectional selection:** Click a task row to select the corresponding graph node
- **Neighbor highlighting:** Edges connected to a selected node are highlighted
- **Pan and zoom:** Users can navigate the graph on small screens
- **Tooltips:** Hover over a node to see the full task name
- **Keyboard navigation:** Tab through nodes, Enter/Space to select

### Display & Toggles

- **Desktop (≥ 480px):** Graph section shown by default, collapsible with toggle button
- **Mobile (< 480px):** Graph section hidden by default, expandable with toggle button
- **Summary line:** Shows "X tasks · Y dependencies"
- **Empty state:** "No task dependencies yet..." when no blockedBy relationships exist
- **Cycle warning:** "Dependency cycle detected. Layout is approximate." when cycles are detected

### Integration

- Section below the task list in the main container
- Breaks out to a wider layout (max-width 1200px) to accommodate the graph
- Does not affect task list functionality or data model
- Read-only visualization (cannot add/modify dependencies from the graph directly)

---

## 8. Out of Scope

The following are explicitly **not** part of this project:

- User authentication / accounts
- Multi-user / shared lists
- Categories, tags, or labels
- Due dates, reminders, or scheduling
- Sub-tasks or nested todos
- Search or filter (beyond the implicit visual scan)
- Undo/redo
- Import/export
- Dark mode toggle (may style with `prefers-color-scheme` if trivial, but not required)
- Animations beyond basic drag feedback
- PWA / service worker / installability
- Automated testing infrastructure

---

## 9. Acceptance Criteria

The app is **done** when all of the following pass in Chrome and Firefox (latest):

| # | Criterion |
|---|-----------|
| AC1 | Opening `index.html` in a browser displays the app with an input field and empty state message. |
| AC2 | Typing text and pressing Enter adds a todo to the list with status "active". Empty input does nothing. |
| AC3 | Each todo has a status dropdown with options: Active, Done, Cancelled, Blocked. Changing the dropdown updates the todo's visual state immediately. |
| AC4 | Done todos show strikethrough + muted grey text. Cancelled todos show strikethrough + muted red text. Blocked todos show an orange left-border accent and warm background. Active todos have default styling. |
| AC5 | Clicking a todo's delete button removes it from the list. |
| AC6 | Dragging a todo to a new position reorders the list. The new order persists after page reload. |
| AC7 | The "Clear finished" button removes all done and cancelled todos. The button is disabled when no done or cancelled todos exist. |
| AC8 | Refreshing the page restores all todos (text, status, order) from `localStorage`. |
| AC9 | Loading old-format data (`{ done: bool }`) auto-migrates to `{ status: "active" | "done" }` and renders correctly. |
| AC10 | With zero todos, an empty state message is displayed. |
| AC11 | The layout is usable at 320px wide (mobile) and 1440px wide (desktop) without horizontal scroll. |
| AC12 | All interactive elements are keyboard-accessible (Tab, Enter, Space). |
| AC13 | Setting a todo's status to "blocked" reveals an inline panel with checkboxes for other active/blocked tasks. Checking a box adds it as a blocker; unchecking removes it. |
| AC14 | A blocked todo with blockers displays a "Blocked by: ..." subtitle showing blocker task names, truncated appropriately. |
| AC15 | Deleting or completing/cancelling a blocker task removes it from all `blockedBy` arrays. If a blocked todo's last blocker is removed, its status auto-reverts to "active". |
| AC16 | Changing a todo's status away from "blocked" clears its `blockedBy` array. |
| AC17 | Unchecking all blockers in the picker auto-reverts the todo's status to "active" and hides the picker. |
| AC18 | `blockedBy` data persists across page reloads via `localStorage`. |

---

*This PRD is the source of truth for implementation scope. If a question arises that isn't covered here, raise it — don't assume.*
