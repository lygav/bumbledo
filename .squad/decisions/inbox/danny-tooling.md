# Danny: Tooling Guardrails for Issue #65

## Decision

Adopt **ESLint flat config + Prettier + one simple GitHub Actions CI workflow** for the vanilla JS + Vite + Vitest stack.

## Choices

- **Linting:** `eslint.config.js` using `@eslint/js` recommended rules as the base
- **Globals:** browser globals for app code, Node globals only for repo config files that actually run under Node (`vite.config.js`, `eslint.config.js`)
- **Formatting:** Prettier with single quotes, trailing commas, and 2-space indentation
- **CI:** one `ci.yml` workflow with one `verify` job running `npm ci`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build`
- **Exclusions:** ignore `.squad/`, `.worktrees/`, `.copilot/`, `dist/`, and `node_modules/` from formatting/linting sweeps where appropriate

## Trade-offs

### Why this level of tooling

This app is small and framework-free, so the right trade-off is **boring standards, not policy-heavy enforcement**. ESLint recommended rules catch real defects, and Prettier removes style debate without adding architectural ceremony.

### Why flat config

Flat config is ESLint's current standard and keeps configuration explicit in one file. The trade-off is slightly more setup verbosity than legacy `.eslintrc`, but it avoids adopting a legacy path right as the repo is stabilizing.

### Why Prettier instead of ESLint style rules

Separating linting from formatting keeps responsibilities clean: ESLint finds correctness issues, Prettier normalizes layout. The trade-off is another dev dependency, but it is the lowest-friction standard choice for a JavaScript repo of this size.

### Why one simple CI job

A single verification job is enough for this repo's current scale and keeps CI understandable for contributors. The trade-off is less parallelism and less granularity, but simplicity is more valuable than shaving a few seconds off runtime right now.
