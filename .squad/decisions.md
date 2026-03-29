# Decisions Log

> Shared context for all squad agents. Read before starting work.

---

## ADR-001: Task Dependency (Blocked-By) Feature

**Status:** Accepted  
**Author:** Danny  
**Date:** 2025-07-17

- `blockedBy: string[]` field on todo objects (only meaningful when `status === "blocked"`)
- Inline checkbox picker below blocked items for selecting blockers
- "Blocked by: ..." subtitle text on blocked todos
- Auto-cleanup: deleting/completing a blocker removes it from all `blockedBy` arrays; empty `blockedBy` → auto-revert to active
- No circular dependency detection (acceptable for a todo app)
- Backward-compatible localStorage: omit `blockedBy` when saving non-blocked todos

Full ADR: `.squad/decisions/inbox/danny-task-deps.md`
