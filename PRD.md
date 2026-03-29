# PRD: Browser-Based Todo App

**Author:** Danny (Lead/Architect)
**Status:** Draft
**Date:** 2025-07-17

---

## 1. Overview

A single-page, browser-based todo application. One HTML file, no backend, no build tools. Users can add, complete, delete, and **drag-to-reorder** todo items. Data persists in `localStorage`.

**Target user:** Anyone who wants a lightweight, instant-on task list — no accounts, no setup, no servers.

---

## 2. Goals & Non-Goals

### Goals

- Ship a fully functional todo app in a single HTML file (inline CSS + JS)
- Drag-and-drop reordering that feels responsive and intuitive
- Persistent state across browser sessions via `localStorage`
- Clean, minimal UI that works on desktop and mobile browsers

### Non-Goals

- No backend, API, or database
- No build step, bundler, or package manager
- No authentication or multi-user support
- No framework dependencies (React, Vue, etc.)
- No offline-first/PWA features beyond basic `localStorage`

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

### 4.3 Deleting a Single Todo

- Each todo has a **delete** control (e.g., an "×" button).
- Clicking it removes the todo immediately — no confirmation dialog.
- The delete control should be visually subtle to avoid accidental clicks (e.g., visible on hover/focus, or low-contrast until hovered).

### 4.4 Drag-and-Drop Reordering

- Users can grab any todo and drag it to a new position in the list.
- While dragging, a visual indicator shows the insertion point (e.g., a line between items, or a placeholder).
- The dragged item is visually distinguished (e.g., slightly elevated/shadow, reduced opacity at source position).
- Dropping the item reorders the list and persists the new order.
- Must work with mouse. Touch support (mobile drag) is a stretch goal — document trade-offs if omitted.
- Implementation: use the **HTML5 Drag and Drop API** (`draggable`, `dragstart`, `dragover`, `drop` events). No external libraries.

### 4.5 "Clear Finished" Button

- A single button labeled **"Clear finished"**.
- Clicking it removes **all** todos with status `done` or `cancelled` (both are terminal states).
- The button is **disabled** when there are zero done + zero cancelled todos.
- No confirmation dialog — the action is low-risk since these items are already terminal.

### 4.6 Persistence (localStorage)

- The full todo list (text, done state, order) is saved to `localStorage` on every mutation (add, delete, toggle, reorder, clear done).
- On page load, the app reads from `localStorage` and restores the list.
- If `localStorage` is empty or missing, the app starts with an empty list (no sample data).
- Data format: a JSON array of objects, e.g.:
  ```json
  [
    { "id": "abc123", "text": "Buy milk", "status": "active" },
    { "id": "def456", "text": "Walk dog", "status": "done" },
    { "id": "ghi789", "text": "Old task", "status": "cancelled" }
  ]
  ```
- **Migration:** On load, if a todo has the legacy `{ done: bool }` format and no `status` field, it is automatically migrated: `done: true` → `status: "done"`, `done: false` → `status: "active"`. The `done` field is removed and the migrated data is saved back immediately.
- Each todo gets a unique `id` (e.g., `Date.now().toString(36)` + random suffix). IDs are stable across reorders.
- `localStorage` key: `"todos"` (simple, no prefix needed for a single-page app).

### 4.7 Empty State

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
| **Single file** | One `.html` file with inline `<style>` and `<script>`. No external CSS/JS files. |
| **No frameworks** | Vanilla HTML, CSS, JavaScript only. No React, Vue, jQuery, etc. |
| **No build step** | No Webpack, Vite, npm, etc. Open the file in a browser and it works. |
| **No backend** | No server, no API calls, no database. `localStorage` only. |
| **Browser support** | Modern evergreen browsers (Chrome, Firefox, Safari, Edge — latest 2 versions). No IE11. |
| **No external dependencies** | No CDN links, no imported libraries. Fully self-contained. |

---

## 7. Out of Scope

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
- Automated testing infrastructure (Linus will test manually per acceptance criteria; no test framework to ship)

---

## 8. Acceptance Criteria

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

---

*This PRD is the source of truth for implementation scope. If a question arises that isn't covered here, raise it — don't assume.*
