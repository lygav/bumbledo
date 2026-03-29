# Decision: Drag-and-drop reordering implementation

**By:** Livingston (UX Engineer)
**Date:** 2025-01-20

## What
Added HTML5 Drag and Drop API-based reordering to the todo list.

## Key choices
- **Whole-item draggable**: Each `<li>` is draggable (not just the handle). The handle provides the visual affordance (`cursor: grab`) but the entire row can be dragged. This feels more natural and forgiving.
- **Event delegation**: All drag events are attached to `#todo-list` via delegation, so they survive `render()` calls that rebuild the DOM.
- **Drop indicator**: Uses `box-shadow` (not border) for the insertion line so it doesn't shift layout. Blue line (#4a90d9) matches the app's accent color.
- **Top/bottom half detection**: `dragover` checks cursor position relative to the target item's midpoint to determine whether to insert above or below.
- **CSS classes**: `.dragging` (opacity 0.4), `.drag-over-above` / `.drag-over-below` (blue line indicator), `body.is-dragging` (grabbing cursor globally).
- **No external libraries**: Pure HTML5 DnD API as required.
