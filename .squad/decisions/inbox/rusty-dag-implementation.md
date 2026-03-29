# Rusty — DAG Implementation Notes

**Status:** Proposed  
**Author:** Rusty  
**Date:** 2026-03-29

## Summary

Implemented the embedded dependency graph as a dedicated `dag.js` module using `dagre` for layout and native SVG for rendering.

## Key implementation choices

- Kept `todos` as the only source of truth and derived graph nodes/edges from `blockedBy` on every update.
- Added DFS-based cycle detection inside `buildDependencyGraph(todos)` and removed cycle edges from the dagre layout input so the layout engine keeps working.
- Rendered cycle edges separately as dashed red arrows with a warning banner so bad data remains visible without breaking the view.
- Kept the graph read-only. Node activation only navigates back to the matching list row and applies selection/highlight state.
- Synced list-row selection and graph-node selection through `selectedTaskId` owned by `app.js`.
- Used a breakout-width section below the footer so the graph can breathe without redesigning the existing 600px list layout.
- Defaulted the graph to collapsed on mobile and to expanded on larger screens only when real dependency edges exist.

## Consequences

- The graph stays proportional to the rest of the app and does not introduce a heavier graph-editing interaction model.
- Cycle handling is explicit and resilient, but the layout is only approximate while cyclic data exists.
- The new `dag.js` module is reusable for further DAG-only tests without coupling graph logic to DOM rendering.
