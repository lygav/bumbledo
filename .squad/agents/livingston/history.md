# Livingston — History

## Core Context

- **Project:** A single-page browser-based todo app with draggable reordering and no backend
- **Role:** UX Engineer
- **Joined:** 2026-03-29T08:36:00.628Z

## Learnings

<!-- Append learnings below -->
- 2026-03-29: Recommended the embedded DAG as a collapsible, full-width section placed directly below the "Clear finished" footer control, with mobile-first collapse behavior and SVG-based interaction patterns that keep the task list as the primary surface.
- 2026-03-29: The clear-finished flow already removes blocker references inside `clearFinished`, so the UX fix for missed Smart Blocked Alerts was to snapshot todos before the click, then call `surfaceUnblockedTodos` after clearing and before re-rendering.
