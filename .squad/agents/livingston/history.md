# Livingston — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** UX Engineer
- **Joined:** 2026-03-29T08:36:00.628Z

## Learnings

<!-- Append learnings below -->
- 2026-03-30: Touch reordering works best when the ⠿ handle owns a short long-press timer and global touchmove/touchend listeners manage the drag, so taps and scroll gestures still behave normally while active drags can prevent page scroll and track drop targets with elementFromPoint().
- 2026-03-29: Recommended the embedded DAG as a collapsible, full-width section placed directly below the "Clear finished" footer control, with mobile-first collapse behavior and SVG-based interaction patterns that keep the task list as the primary surface.
- 2026-03-29: The clear-finished flow already removes blocker references inside `clearFinished`, so the UX fix for missed Smart Blocked Alerts was to snapshot todos before the click, then call `surfaceUnblockedTodos` after clearing and before re-rendering.
- 2026-03-29: For the blocked-status picker, tasks with `status: "blocked"` but no blockers should stay actionable while the picker is open, then auto-revert to `active` on blur so Actionable Now never hides a task that is effectively ready.
- 2026-03-29: `hasActiveBlockers` should ignore self-references and treat blocker cycles that route back through the current todo as non-blocking, so blocked-task completion guards do not trap users in circular dependency loops.
- 2026-03-29: A lightweight completion celebration works best as a fixed-position burst anchored to the task row, with CSS-driven piece animations and JS only responsible for spawning and removing short-lived confetti nodes.
- 2026-03-29: Keeping the dependency graph outside the main app shell lets the todo area switch to a desktop sidebar layout by CSS alone, so secondary tools can move beside the list without affecting drag-and-drop or the graph's wider presentation.
