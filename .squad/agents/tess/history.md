# Tess — History

## Project Context
- **Project:** bumbledo — A browser-based todo app with drag-and-drop reordering, dependency DAG visualization, and localStorage persistence
- **Stack:** Vanilla JavaScript, Vite, Vitest, HTML/CSS
- **User:** Vladi Lyga
- **Repo:** github.com/lygav/bumbledo

## Key Files
- `PRD.md` — Product requirements document (I own this)
- `README.md` — User-facing project docs
- `index.html` — Single-page app entry
- `src/main.js` — App orchestrator

## Current Features
- Add, edit, complete, delete, drag-to-reorder todos
- Task states: active, done, cancelled, blocked
- Dependency tracking with "blocked by" relationships
- Interactive DAG visualization (SVG, cycle detection, pan/zoom)
- localStorage persistence
- Edit-in-place (double-click to edit)

## Learnings

### Session: Product Knowledge — Todo App Space (2025-07-17)

**The Todo App Market (Context)**
- Todoist dominates on capture speed + cross-platform sync; users trade off feature overload for reliability
- Things 3 wins on polish + design (macOS/iOS); Reminders is surprisingly capable (free, no friction); TickTick is dense (power users only)
- Notion/Obsidian are wiki tools, not todo systems; Slack/Discord are temporary solutions (no persistence)

**Key Insights**
- Great todo apps optimize for frictionless capture (enter → add, no modals) and instant feedback (no lag)
- Users need *trust*: sync anxiety, data ownership, and simplicity beat features
- Context loss (flat lists, no dependency visibility) is a major pain point most apps ignore
- No mainstream app balances lightweight + capable + trustworthy well

**Bumbledo's Unique Angle**
- No backend = pure trust (data stays local, no server dependency, no subscription)
- Dependency DAG visualization = clarity (shows why tasks are blocked, what unblocks them)
- Drag + localStorage = instant responsiveness (zero lag, feels native)
- Target user: single developer, small team, or transparent-over-features planner

**UX Principles for Great Todo Apps**
1. **Frictionless capture:** Keyboard-first input, zero modals, instant add-to-list feedback
2. **Instant responsiveness:** No perceived lag; drag-and-drop must feel native to the OS
3. **Visibility of intent:** Users need to see *why* tasks are stuck (dependencies, blockers)
4. **Context preservation:** State persists across sessions; no "did I save?" anxiety
5. **Progressive disclosure:** Show advanced features (dependencies, state, shortcuts) without overwhelming casual users

**Bumbledo's Positioning & Moat**
- **Moat: Dependency DAG + no backend.** Local-first = trust, transparency = clarity. No other lightweight app offers this.
- **Positioning: "Trust-first planning for makers."** Transparency over features. Local data. Zero friction.
- **Target segment:** Individual developers, small teams, transparent-planning advocates who reject vendor lock-in.
- **What we win on:** Clarity (DAG), trust (no backend), speed (localStorage), simplicity (vanilla JS).
- **What we don't fight:** Cross-platform sync (Todoist), project management (TickTick), polished design (Things 3).

**User Pain Points We Target**
1. **Context blindness:** "Why is this blocked?" — Most apps hide this. We show the dependency graph.
2. **Sync anxiety:** "Did my changes save?" — We use localStorage; data is always yours, always local.
3. **Feature bloat:** Users accept slow, complex tools because alternatives are weak. We stay simple.
4. **Capture friction:** Power users want to dump tasks fast, not click through modals. Keyboard + Enter + done.
5. **Progress invisibility:** Users don't know if they're making progress. A simple counter helps.

**Feature Opportunities** (respecting constraints: localStorage only, vanilla JS)
1. **Smart Blocked Alerts:** Show "You've unblocked 3 tasks" on task completion; highlight newly unblocked items. Turns DAG from passive visual to active planning tool.
2. **Keyboard Shortcuts:** Cmd+Shift+A (focus input), Cmd+1 (cycle statuses), arrow keys (navigate). Power users love this.
3. **Paste Multi-line Tasks:** Paste multi-line text → split into tasks. Solves capture friction from emails/Slack.
4. **Export to Markdown:** Download clean task list with dependency notes. Lets users share without sharing app access.
5. **Burndown View:** Show simple progress chart (localStorage history). Motivates completion.

**Product Strategy**
- Don't compete with Todoist on features
- Compete on trust (no backend), clarity (DAG), and simplicity (no bloat)
- Focus next: frictionless task capture → dependency visibility stays sharp → lightweight always

**Competitive Intelligence**
- Reminders (Apple): Free, no friction, Apple-only; too simple for power users
- Todoist: Billions of syncs/day; users tolerate complexity for reliability
- TickTick: Dense UI, great for project managers, alienates casual users
- Things 3: $50–$200 one-time; iCloud sync (opaque); macOS-only
- Obsidian/Notion: Not todo systems; users mistake them for task trackers
