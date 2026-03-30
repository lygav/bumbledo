# Saul — App store architecture for issue #62

## Decision
Introduce a lightweight vanilla JS store in `src/app/store.js` with named actions and a small subscribe/notify API, backed by pure selectors in `src/app/selectors.js`.

## Store shape
The store owns canonical app state needed across features:
- `todos`
- `burndownData`
- `selectedTaskId`
- `filterActive`
- `editingId`
- `burndownExpanded`
- `dagExpanded`
- `dagToggleTouched`
- `isMobileViewport`

## Actions
Named actions formalize all meaningful mutations instead of letting `main.js` mutate state ad hoc:
- `addTask`
- `setTaskStatus`
- `deleteTask`
- `toggleBlocker`
- `finalizeBlockedStatus`
- `clearFinished`
- `reorderTasks`
- `selectTask`
- `clearSelection`
- `moveSelection`
- `enterEditMode`
- `saveEditedTask`
- `cancelEdit`
- `toggleSelectedTaskStatus`
- `toggleReadyFilter`
- `toggleBurndownExpanded`
- `toggleDagExpanded`
- `setViewport`
- `ensureBurndownSample`

## Selectors
Selectors own derived data that had been scattered across `main.js`:
- progress counts and percentages
- visible todos under the ready filter
- ready-filter empty state
- selected todo / visible selection reconciliation
- blocked-completion guard info
- keyboard toggle target info
- burndown view model
- DAG section state and effective expansion

## Side effects
Persistence is centralized inside the store as post-action effects:
- `saveTodos()` when `todos` changes
- `saveBurndownData()` when `burndownData` changes
- ready-filter preference write when `filterActive` changes

UI-only effects stay outside the store but react to action metadata emitted by dispatch:
- blocked-task modal
- unblocked notification/highlight
- confetti
- post-render focus/scroll behavior

## Integration rule
`src/main.js` stays the composition root, but it no longer owns mutation logic. Controllers dispatch named actions, a single store subscription synchronizes render state, and selectors feed the task summary, list, burndown, and DAG views.

## Why this bar
This keeps the architecture honest without dragging in a framework. State transitions are explicit, persistence is centralized, and the browser wiring remains reviewable instead of dissolving back into another 800-line mutation soup.
