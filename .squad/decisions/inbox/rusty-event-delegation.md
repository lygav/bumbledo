# Rusty: delegated todo-list events

## Decision
`src/todo/list-view.js` should attach one set of stable listeners to the list container and resolve row/action intent with `event.target.closest(...)` plus row data attributes, instead of binding listeners inside each rendered `<li>`.

## Why
The list is fully re-rendered after store updates and reorder operations, so per-row wiring is wasted work and a regression trap. Container-level delegation keeps edit, status, delete, and blocker flows alive across render cycles while respecting the app-store boundary by dispatching named store actions for every mutation.

## Scope touched
- `src/todo/list-view.js`
