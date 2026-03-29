# PRD: Keyboard Shortcuts

**Author:** Tess  
**Status:** Draft  
**Date:** 2025-07-18

---

## 1. Overview

Power users want speed. Keyboard shortcuts will let experienced planners manipulate tasks without reaching for the mouse, reducing friction and enabling rapid task capture and state transitions. Bumbledo will support a curated set of shortcuts focused on the most common actions: add, navigate, edit, cycle state, and mark done.

**Why:** Keyboard shortcuts are the hallmark of tools trusted by power users. They reward expertise, reduce cognitive load, and make complex workflows feel effortless. The shortcut set is intentionally small to stay discoverable.

---

## 2. Goals & Non-Goals

### Goals

- Enable keyboard-only task management for power users
- Focus on high-frequency actions (add, cycle state, navigate, done)
- Keep the shortcut set small (< 10 keys) for discoverability and muscle memory
- Display a help modal showing all available shortcuts
- Respect browser/OS conventions (avoid conflicts with system keybindings)

### Non-Goals

- Customizable keybindings (fixed set only)
- Vim-style shortcuts or command palettes
- Conflict resolution if a shortcut collides with browser default
- Vi-mode or Emacs-style bindings
- Shortcuts for graph navigation or settings

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| U1 | Power user | Press a key to focus the input and add a task | I can capture ideas without using the mouse |
| U2 | Power user | Use arrow keys to navigate between todos | I can stay on the keyboard while browsing my list |
| U3 | Power user | Press a key to cycle a task's state (active → done → active) | I can quickly toggle completion without a dropdown |
| U4 | Power user | Press a key to delete the currently selected todo | I can remove items fast |
| U5 | Power user | See a help modal listing all shortcuts | I can discover and remember them over time |
| U6 | Casual user | Use the app without knowing about shortcuts | Shortcuts don't interfere with normal interaction |

---

## 4. Functional Requirements

### 4.1 Shortcut Set

| Key Combo | Action | Context |
|-----------|--------|---------|
| `Cmd/Ctrl + Shift + A` | Focus input field + select all text | Anywhere in app |
| `ArrowUp / ArrowDown` | Navigate between todos | List focused or after click |
| `Enter` | Toggle state of selected todo | Todo is focused/selected |
| `Delete / Backspace` | Delete selected todo | Todo is focused/selected |
| `?` | Show/toggle help modal | Anywhere in app |
| `Escape` | Deselect current todo; close help | Todo selected or help open |

### 4.2 Focus Management

- Typing in the input field disables todo-list keyboard shortcuts
- Clicking a todo highlights it and enables navigation/toggle shortcuts
- Tab can be used to move focus between input and todos (standard browser behavior)
- Escape clears the todo selection and returns focus to the list

### 4.3 Help Modal

- A simple, lightweight modal displaying all shortcuts in a 2-column table
- Show shortcut key (platform-specific: "Cmd" on Mac, "Ctrl" on Windows/Linux) + description
- Include instructions: "Click a todo to select it, then use arrow keys to navigate"
- Triggered by `?` key or clicking a "Help" link (if space permits)
- Dismiss by clicking outside the modal, pressing Escape, or clicking a close button

### 4.4 Platform Awareness

- Detect OS (Mac vs. Windows/Linux) and display `Cmd` vs. `Ctrl` in help text and documentation
- Use `metaKey` (Cmd on Mac, Windows key on Windows) or `ctrlKey` as appropriate
- All examples in help should show both variants: "Cmd + Shift + A (Mac) or Ctrl + Shift + A (Windows)"

### 4.5 No Interference

- Shortcuts only activate when they won't conflict with input (e.g., typing in a text field)
- If a shortcut conflicts with a browser default, document it but do not override the browser
- Users can opt-out by disabling shortcuts (add a settings toggle if scope allows, or document workaround)

---

## 5. Technical Constraints

- No external libraries for shortcut handling; use native `keydown` events and `event.key` / `event.metaKey`
- Shortcuts fire on `keydown` to enable rapid repeat (e.g., holding down arrow to navigate)
- No global event listeners that interfere with form inputs or contentEditable regions
- Help modal can be a simple HTML overlay or a CSS-based toggle

---

## 6. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | Pressing Cmd/Ctrl + Shift + A focuses the input field and selects all text. |
| AC2 | When a todo is selected, ArrowUp and ArrowDown move selection to adjacent todos without page scroll issues. |
| AC3 | When a todo is selected, pressing Enter cycles its state: active → done → active (or other state sequence). |
| AC4 | When a todo is selected, Delete or Backspace removes it from the list (no confirmation). |
| AC5 | Pressing ? opens a help modal listing all 6 shortcuts with clear descriptions. |
| AC6 | Help modal shows platform-specific keys (Cmd on Mac, Ctrl on Windows/Linux). |
| AC7 | Pressing Escape closes the help modal and deselects the current todo. |
| AC8 | Typing in the input field does not trigger todo-list shortcuts (e.g., pressing ? in the input does not open help). |
| AC9 | Tab key moves focus between input and todo list (standard browser behavior, not overridden). |
| AC10 | Keyboard shortcuts work with the dependency blocker UI (selecting todos with blockers behaves normally). |

---

## 7. Out of Scope (v1)

- Customizable keybindings
- Macro recording or command sequences
- Vim or Emacs mode
- Undo/redo shortcuts
- Shortcuts for editing task text inline
- Settings panel for disabling individual shortcuts
- Shortcut chaining or key combos beyond single key + modifier

---

## 8. Dependencies

- **Existing features:** Todo list, state cycling, task selection/focus
- **No new data fields required**
- **Does not block:** Other features; purely additive UI enhancement

---

*This feature rewards power users without alienating casual ones. The shortcut set is intentionally small to avoid cognitive overload.*
