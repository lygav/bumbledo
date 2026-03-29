# Decision: Actionable Now PRD Created

**Author:** Tess  
**Date:** 2025-07-19  
**Status:** Proposed  
**Affects:** PRD-actionable-now.md, task list UI, localStorage (new key)

---

## Summary

Created `PRD-actionable-now.md` — a new feature PRD for a filtered view that shows only unblocked, active tasks. This is bumbledo's 4th feature PRD alongside Smart Blocked Alerts, Keyboard Shortcuts, and Burndown View.

## Context

Every persona opens bumbledo to answer: "What can I actually do right now?" The default list mixes actionable tasks with blocked, done, and cancelled items. Users mentally filter every time. This was the #1 gap identified in the persona review — Priya, Daniel, Jake, and Marco all have the same core need in different life contexts.

## Decision

- **Toggle filter** on the task list: "Actionable" on/off. Not a separate page.
- **Filter logic:** Show only tasks with `status === "active"`. Leverages ADR-001's auto-unblock — no custom blocker-walking needed.
- **Count summary:** "N of M tasks are actionable" — always visible, updates in real time.
- **Persistence:** New localStorage key `"bumbledo_filter_actionable"` — separate from todo data, no migration.
- **Interactions:** Drag-and-drop works on visible items only; DAG always shows full graph; burndown unaffected; clear finished operates on full list.

## Rationale

1. Simplest high-impact feature — every persona wants it, implementation is lightweight
2. Builds on existing auto-unblock logic (ADR-001) — no new data model changes
3. Toggle approach preserves the "one list" mental model — users aren't navigating between views
4. localStorage preference avoids daily re-toggling friction

## Impact

- Danny: New UI toggle, list filtering logic, localStorage read/write for preference, filtered drag-and-drop behavior, actionable-specific empty state
- No changes to existing data model or storage schema
- Complements Smart Blocked Alerts (alerts = "when"; Actionable Now = "what")
