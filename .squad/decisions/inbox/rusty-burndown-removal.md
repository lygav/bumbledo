# Rusty Inbox: Burndown Removal + Toolbar Toggle Refresh

## Context
- User feedback said the burndown feature added no value and duplicated the simpler status overview already shown in the main app.
- The existing **Hide Blocked** control looked like a button with dead space because its affordance depended on an icon slot that stayed empty when off.

## Decision Notes
- Remove burndown UI, store state, persistence, selectors, helpers, and dedicated view code entirely instead of leaving the chart hidden behind a dormant toggle.
- Keep the status counter pills and move them into the main toolbar row so they remain the primary progress overview.
- Implement **Hide Blocked** as a switch-style button using `role="switch"` and `aria-checked` with a visible track/thumb state change.

## Why
- One progress system is easier to scan than a split between inline pills and a secondary historical chart.
- The switch pattern makes the blocked filter state obvious at a glance and avoids the previous “empty icon gutter” look.
