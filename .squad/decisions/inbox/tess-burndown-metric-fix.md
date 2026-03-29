# Decision: Burndown Chart Metric Change

**Author:** Tess  
**Date:** 2025-07-18  
**Status:** Proposed  
**Affects:** PRD-burndown-view.md, todos_burndown localStorage schema

---

## Summary

Changed the burndown chart's core metric from **single-line "active task count per day"** to **dual-line "cumulative completed vs. cumulative total"**.

## Context

Vladi identified that tracking active task count is a net metric. When users add tasks faster than they complete them, the chart goes up — hiding real progress and demoralizing the user. Example: complete 10 tasks, add 20 → chart shows +10 (looks like failure, but 10 tasks were actually done).

## Decision

- **Primary line ("Completed"):** Cumulative count of done + cancelled tasks. Always non-decreasing. Shows output.
- **Secondary line ("Total"):** Cumulative count of all tasks ever created. Always non-decreasing. Shows scope.
- **Gap between lines** = remaining active work.
- **Summary display:** "X of Y done (Z%) · N remaining"

## localStorage Schema Change

Old: `{ date, count }` (just active count)  
New: `{ date, done, cancelled, active, total }` (full state snapshot)

## Rationale

1. Cumulative completed always goes up → motivational, never punishing
2. Scope growth is visible but separate → honest, not demoralizing
3. Richer snapshots future-proof us for done/cancelled breakdowns later
4. Gap between lines gives "remaining work" at a glance without a separate metric

## Impact

- Danny: Data collection logic changes (sample all state counts, not just active)
- Danny: Chart rendering changes (two lines, summary text, tooltip updates)
- No breaking changes to existing localStorage (new key, additive)
