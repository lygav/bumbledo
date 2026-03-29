# PRD: Smart Blocked Alerts

**Author:** Tess  
**Status:** Draft  
**Date:** 2025-07-18

---

## 1. Overview

When a user completes or unblocks a task, bumbledo will proactively surface any tasks that just became available to work on. This turns the dependency graph from a passive visualization into an active planning assistant, helping users discover their next move without manually scanning the list.

**Why:** Users often lose sight of what's unblocked after completing a blocker. A small notification ("You've unblocked 3 tasks!") with visual highlighting creates a "moment of clarity" and keeps momentum flowing.

---

## 2. Goals & Non-Goals

### Goals

- Show a brief notification when task completion unblocks one or more tasks
- Highlight newly unblocked tasks in the list for easy scanning
- Make the feature non-intrusive (dismiss-able, don't interrupt)
- Build on the existing dependency DAG without adding new data fields

### Non-Goals

- No push notifications or browser alerts
- No email/external notifications
- No automatic task reordering based on unblock state
- No "smart ordering" algorithm
- No analytics or logging of unblock events

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| U1 | Power user | See which tasks just became unblocked after I complete a blocker | I can immediately grab the next high-impact task |
| U2 | User | Have newly unblocked tasks visually distinct for a few seconds | I don't miss them in a long list |
| U3 | User | Dismiss the unblock notification if I'm focused on something else | It doesn't distract me |
| U4 | User | See the notification even if I'm scrolled down in the list | I don't have to scroll up to know what unblocked |

---

## 4. Functional Requirements

### 4.1 Unblock Detection

- When a todo's status changes from `blocked` to `active` (or `done`/`cancelled`), scan all remaining blocked todos
- For each blocked todo, check if any of its blockers are now in a terminal state (`done`, `cancelled`) or are no longer in the list
- If a blocked todo's `blockedBy` array becomes empty, mark it as "newly unblocked"

### 4.2 Notification UI

- Display a brief, dismissible notification bar **below the input field, above the todo list**
- Format: `"You've unblocked N task(s). Scroll down to find them."`
- Include a small close (×) button to dismiss
- Duration: Auto-hide after 5 seconds if not dismissed manually
- Do not appear if zero tasks were unblocked

### 4.3 Visual Highlighting

- For 3 seconds after the notification appears, newly unblocked todos show a **subtle yellow/gold background highlight**
- The highlight fades smoothly over the 3-second window
- All other styling (text, state indicators) remains unchanged
- Highlight applies to **all** newly unblocked items, even if the user scrolls

### 4.4 Interaction

- Clicking a newly highlighted todo removes the highlight manually (user can "acknowledge" it)
- If the user clicks the close button on the notification, both the notification and highlights are cleared
- Refreshing the page clears highlights (they are not persisted to localStorage)

### 4.5 Accessibility

- Use ARIA `role="status"` on the notification bar for screen reader announcements
- Include descriptive text: e.g., "Alert: You've unblocked 3 tasks. Deploy app, Write docs, Review PR"
- Notification is keyboard-accessible for dismissal

---

## 5. Technical Constraints

- No new localStorage fields required; leverage existing `blockedBy` and `status` data
- Use existing DOM mutation to trigger unblock detection (piggyback on existing status-change handler)
- CSS transitions for smooth fade-out of highlights
- No external libraries beyond what's already included

---

## 6. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | Changing a blocked todo's status to "done" triggers unblock detection on all remaining todos. |
| AC2 | A notification appears showing the count of newly unblocked tasks. It auto-dismisses after 5 seconds. |
| AC3 | Newly unblocked todos are highlighted with a subtle yellow background for 3 seconds. |
| AC4 | The notification bar includes a close button; clicking it dismisses both notification and highlights. |
| AC5 | Clicking a newly highlighted todo clears its highlight immediately. |
| AC6 | Refreshing the page removes all unblock highlights (they don't persist). |
| AC7 | The notification is announced to screen readers with task names and count. |
| AC8 | If zero tasks are unblocked, no notification appears. |
| AC9 | The notification bar does not hide the input field or first todo (responsive positioning). |

---

## 7. Out of Scope (v1)

- Per-notification settings or preferences
- Notification history or log
- Grouping notifications by blocker (show "Completed: Deploy app → unblocked 3 tasks")
- Sound or haptic feedback
- Custom highlight color/style

---

## 8. Dependencies

- **Existing features:** Task states (active, done, cancelled, blocked), `blockedBy` field, status change handlers
- **Data:** No new fields; builds on existing todo data model
- **Does not block:** Other features; adds UI on top of existing state logic

---

*This feature enhances the dependency-aware planning workflow without adding complexity. It's a small, high-impact improvement to the core experience.*
