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

### Session: Burndown PRD Metric Fix (2025-07-18)

**What happened:** Vladi caught a critical flaw in the burndown chart PRD. The original metric — "number of active tasks per day" — is a net metric that conflates scope changes with progress. If a user completes 10 tasks but adds 20, the chart goes UP, hiding real work done.

**The fix:** Replaced single "active count" line with a dual-line chart: **cumulative completed** (done + cancelled) vs. **cumulative total** (all tasks ever created). Completed line always goes up (shows output). Total line always goes up (shows scope). Gap = remaining work.

**Key learning:** When designing progress metrics for tools where scope isn't fixed, never use net metrics (remaining = total - done). They punish users who are good at identifying new work. Instead, separate *output* (what you did) from *input* (what came in). Cumulative metrics are motivational because they only go up.

**Also learned:** Data snapshots should capture all state counts (done, cancelled, active, total), not just one derived number. Richer snapshots enable future features (e.g., done vs. cancelled breakdown) without schema migration.

### Session: Persona Revision — Personal Productivity Pivot (2025-07-18)

**What happened:** Vladi clarified that bumbledo's product space is **personal productivity** — not developer tools, not project management, not team collaboration. Revised all four personas to reflect this. Previously, personas were developer-centric (solo dev, privacy planner, freelancer, OSS maintainer). Now they represent a broader audience managing personal lives.

**Revised personas (saved to `docs/personas.md`):**
1. **Marco** — Side-Project Juggler (technical, personal coding/learning projects)
2. **Priya** — Life Planner (non-technical, home improvement/family events/finance)
3. **Jake** — Student Planner (non-technical, coursework/grad apps/campus life)
4. **Lin** — Creative Project Maker (non-technical, illustration pipeline/Etsy shop/courses)

**Key design decisions:**
- 3 of 4 personas are non-technical — personal productivity tools serve everyone, not just developers
- Every persona has a concrete dependency scenario from real life (not work): course prerequisites, home renovation sequences, creative production pipelines, side-project task chains
- Local-first and zero-friction remain universal needs — they matter even more in personal contexts where people reject "work tools" for personal use
- Kept Marco as the one technical persona since developers are still a valid personal productivity user — but reframed from "solo dev doing work" to "person managing side projects in limited free time"

**Key learning:** When pivoting product positioning, personas must change *who the people are*, not just *what words describe them*. A developer managing Jira tickets is a different person than a developer managing weekend side projects — same human, different mindset, different needs, different competition. The personal productivity lens forces you to think about evenings, weekends, and life complexity — not sprints and standups.

### Session: Personal Life Organization as Primary Use Case (2025-07-19)

**What happened:** Vladi clarified that bumbledo is **mainly for personal life organization**, not just side projects. Side projects and learning goals are still valid but secondary. The primary framing is: "I use bumbledo to organize my life."

**Changes made to `docs/personas.md`:**
- Reframed product space from "personal productivity" to "personal life organization"
- Promoted Priya to persona #1 ("Household Organizer") — expanded with grocery planning, home maintenance, moving house, tax season, birthday party scenarios
- Replaced Lin with Daniel ("Wellness & Routine Tracker") — covers fitness programs, medical appointment chains, morning/evening routines, family logistics
- Expanded Jake with domestic scenarios (apartment chores, meal prep, move-out) alongside academics
- Moved Marco to persona #4, reframed as "Side-Project Hobbyist" — now leads with kitchen renovation, car maintenance, and camping trips; side projects are secondary
- Added "Key scenarios" sections with concrete dependency DAG examples grounded in real personal life situations (grocery→cook→prep, doctor→blood work→results→follow-up, etc.)
- Updated summary table and cross-cutting themes to lead with "Life organization first"

**Key learning:** The distinction between "personal productivity" and "personal life organization" matters. "Productivity" still sounds like work optimization. "Life organization" immediately evokes groceries, doctor appointments, family events, and daily routines — the stuff that fills most people's actual days. When dependency examples come from household management and health rather than code deploys, the product feels universally relevant, not niche-technical. Every persona should be someone who'd say "I use this to run my life," not "I use this to ship my side project."

### Session: Actionable Now PRD (2025-07-19)

**What happened:** Wrote PRD-actionable-now.md — a filtered view showing only unblocked, active tasks. This was the #1 gap identified in the persona review: every persona's primary moment of use is "I open bumbledo and want to know what I can do right now." Priya with morning coffee, Daniel on Sunday evening, Jake between classes, Marco on Saturday morning — all the same question, different life contexts.

**Key design decisions:**
- Filter, not a page — toggle between "all" and "actionable" views inline. A separate page breaks the mental model of "one list."
- Filter logic is dead simple: `status === "active"`. No complex blocker-walking needed because ADR-001's auto-unblock already transitions tasks to active when all blockers complete. The filter just reads the current state.
- Count summary ("N of M tasks are actionable") gives context even when not filtering — users always know how much of their list is available vs. waiting.
- localStorage persistence for the toggle preference — users who prefer the filtered view shouldn't have to re-enable it every session.
- Explicitly scoped interactions with every existing feature (drag-drop, clear finished, DAG, burndown, shortcuts, smart alerts) to prevent spec gaps during implementation.

**Key learning:** The simplest features often require the most careful spec work around *interactions with existing features*. The filter itself is trivial (hide items by status). But drag-and-drop in filtered mode, empty state disambiguation, and DAG independence all need explicit decisions upfront or they become implementation ambiguities. When a feature touches the list view, it touches *everything*. Spec the edges, not just the happy path.

**Also learned:** When a feature opportunity emerges from persona analysis ("every persona wants X"), that's a strong signal but also a trap — the temptation is to over-design for all four personas at once. Keeping Actionable Now as a simple toggle (not a smart dashboard or context-aware filter) respects the lightweight principle. The personas validate the *need*; the non-goals protect the *scope*.
