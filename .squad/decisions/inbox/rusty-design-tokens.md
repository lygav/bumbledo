# Rusty: Design tokens and visual unification

## Summary
- Added a flat design-token layer in `src/styles.css` covering radii, text, borders, surfaces, spacing, shadows, and focus treatment.
- Standardized control radius to 6px, surface radius to 8px, and passive pills/badges to 999px.
- Unified form controls on a shared 1px border, shared border color, and shared focus ring.
- Routed status palette values from `src/app/constants.js` into CSS variables at runtime so status visuals stay aligned across list rows, pills, burndown, and DAG rendering.

## Files touched
- `src/styles.css`
- `src/app/constants.js`
- `src/main.js`
- `src/todo/list-view.js`
- `src/burndown/view.js`
- `src/dag/view.js`
- `src/styles.test.js`

## Decision for review
Keep the token system flat and app-scoped: one `:root` block plus runtime CSS-variable hydration from `constants.js` is enough for this codebase; no component-library abstraction is needed yet.
