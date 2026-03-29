# PRD: Burndown View

**Author:** Tess  
**Status:** Draft (Revised)  
**Date:** 2025-07-18  
**Revised:** 2025-07-18 — Metric corrected (see §9 for rationale)

---

## 1. Overview

A simple, lightweight progress chart that shows cumulative work done alongside scope growth over time. By sampling the task list daily, bumbledo tracks two lines — **tasks completed** and **total tasks created** — so users always see their output rising, even when new work comes in. The gap between the lines shows remaining work at a glance.

**Why:** Users planning with dependencies need confidence that they're making progress. A single "active task count" line fails this — if you complete 10 tasks but add 20, the chart goes *up* and hides your real output. A dual-line chart separates *output* (what you finished) from *scope* (what you took on), so progress is always visible and scope changes are honest, not punishing. Stored in localStorage; no backend required.

---

## 2. Goals & Non-Goals

### Goals

- Display a dual-line chart: **cumulative completed** (done + cancelled) vs. **cumulative created** (total tasks ever added), over the past 30 days
- Auto-sample the list once per day (on page load, if new day detected)
- Show a prominent summary: current done count, active count, and completion percentage
- Make the chart optional/collapsible (not required viewing)
- Work entirely with localStorage; no backend

### Non-Goals

- Export chart data
- Project completion date (no estimation)
- Per-task burndown or sprint tracking
- Predictive analytics or ML
- Comparison across multiple lists
- Customizable time ranges (fixed 30-day window)
- Integration with external project management tools

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| U1 | Planner | See how many tasks I've completed over time on a chart | I feel motivated by visible progress, even when I keep adding new work |
| U2 | User | See my completion count vs. total created on the same chart | I can tell whether I'm keeping up with scope or falling behind |
| U3 | User | Know my current done count, active count, and completion % at a glance | I get a quick sense of where I stand |
| U4 | User | Have the chart auto-update daily without any action from me | I don't have to manually log progress |
| U5 | User | Collapse the chart if it's not relevant to me | It doesn't clutter my interface |
| U6 | Power user | See when scope grew vs. when I was completing work | I can spot patterns (e.g., "Mondays I add a lot, Fridays I close a lot") |

---

## 4. Functional Requirements

### 4.1 Data Collection

- On page load, check if a sample was taken "today" (detect day change via timestamp)
- If not, compute and record a snapshot: `{ date, done, cancelled, active, total }`
  - `done` = count of todos with `status === "done"`
  - `cancelled` = count of todos with `status === "cancelled"`
  - `active` = count of todos with `status === "active"` or `status === "blocked"`
  - `total` = `done + cancelled + active` (all tasks that exist, regardless of state)
- Store samples in localStorage key: `"todos_burndown"` as a JSON array:
  ```json
  [{ "date": "2025-07-18", "done": 8, "cancelled": 2, "active": 5, "total": 15 }, ...]
  ```
- Keep only the past 30 days of data; prune older entries on each sample

### 4.2 Chart Display

- Show a **dual-line chart** with date on the x-axis:
  - **"Completed" line** (done + cancelled count) — represents cumulative output; always non-decreasing
  - **"Total" line** (total task count) — represents cumulative scope; always non-decreasing
- The **gap** between the two lines = remaining active work
- Use a simple SVG or Canvas-based chart (no charting library; keep it lightweight). Alternatively, use a minimal charting library if already in `package.json`
- Display a **prominent summary** above the chart:
  - Example: **"10 of 15 done (67%)"** — with active count below: *"5 remaining"*
- Include a tooltip on hover showing the date, completed count, and total count for that data point
- Use **distinct, accessible colors** for each line (e.g., green for completed, blue for total)
- Optionally shade the area between the two lines to make the "remaining" gap visually obvious

### 4.3 Chart Section

- Place the chart below the todo list, above the "Clear finished" button (or in a dedicated collapsible section)
- Add a toggle button (e.g., "Progress") to show/hide the chart (default: hidden on first visit)
- When collapsed, show a summary line: e.g., **"10 done · 5 remaining · +3 done today"**
- If fewer than 3 data points, show a message: "Not enough data yet. Come back in a few days!"

### 4.4 Styling & Responsiveness

- Chart adapts to mobile (< 480px): smaller font, fewer x-axis labels
- Use subtle, accessible colors: green line for completed, blue line for total, light grey grid
- Line should be smooth (spline interpolation) or straight segments; either is acceptable
- Avoid clashing with the app's minimal aesthetic

### 4.5 Sample Timing

- Sample is taken once per calendar day (UTC or local time, consistent)
- Sample captures counts at time of page load; not a 24-hour average
- If user loads the app multiple times in one day, only the first sample counts

---

## 5. Technical Constraints

- Use only vanilla JavaScript, SVG, or Canvas for the chart (no D3, Chart.js, etc., unless already in `package.json`)
- localStorage key: `"todos_burndown"` (separate from `"todos"`)
- No backend or API calls
- No additional npm dependencies

---

## 6. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | On first page load of a new day, the app samples `done`, `cancelled`, `active`, and `total` counts and stores them in `"todos_burndown"`. |
| AC2 | Subsequent page loads on the same day do not create new samples (one per calendar day). |
| AC3 | The chart displays two lines: "Completed" (done + cancelled) and "Total" (all tasks), with date on x-axis and count on y-axis, for the past 30 days. |
| AC4 | A summary is displayed prominently: done count, total count, completion percentage, and remaining count (e.g., "10 of 15 done (67%) · 5 remaining"). |
| AC5 | Hovering over a data point shows a tooltip with date, completed count, and total count. |
| AC6 | The chart is hidden by default; a toggle button "Progress" shows/hides it. |
| AC7 | When collapsed, a summary line shows done count, remaining count, and change from yesterday (e.g., "10 done · 5 remaining · +3 done today"). |
| AC8 | If fewer than 3 samples exist, a message "Not enough data yet..." is shown instead of a chart. |
| AC9 | Data older than 30 days is automatically pruned from localStorage on each sample. |
| AC10 | The chart is responsive and readable on mobile (320px–1440px) without horizontal scroll. |
| AC11 | Refreshing the page does not create a duplicate sample for the same day. |
| AC12 | The "Completed" line is always ≤ the "Total" line (visual sanity check). |
| AC13 | Both lines are non-decreasing over time (cumulative counts never go down). |

---

## 7. Out of Scope (v1)

- Historical burndown for individual projects or task categories
- Projection of completion date
- Moving average or trend lines
- Comparative charts (e.g., this week vs. last week)
- Integration with sprint or project management concepts
- Customizable date range
- Export as image or CSV
- Real-time chart updates during a session (sample once per day only)
- Separate tracking of "done" vs. "cancelled" on the chart (both count as completed in v1)

---

## 8. Dependencies

- **Existing features:** Todo list, task states, localStorage persistence
- **New data:** `"todos_burndown"` localStorage key (separate, non-breaking)
- **Does not block:** Other features; purely additive visualization

---

## 9. Design Note: Why "Active Task Count" Is the Wrong Metric

> **For Danny and the dev team — context on why the metric changed.**

The original draft tracked a single line: **number of active tasks per day**. This is a *net* metric — it conflates scope changes with progress. Here's why it fails:

**Scenario:** On Monday you have 20 active tasks. During the week you complete 10 tasks (great work!), but you also identify and add 15 new tasks. On Friday you have 25 active tasks. The old chart would show the line going *up* from 20 → 25. That looks like you fell behind — but you actually completed 10 tasks. The chart punishes you for being thorough about capturing new work.

**The fix:** Track two cumulative lines instead:
- **Completed (done + cancelled):** This line only goes up. Every task you finish raises it. It directly shows your output.
- **Total created:** This line also only goes up. Every task you add raises it. It shows scope growth.

**Why this works:**
1. **Progress is always visible.** Completing tasks always moves the "Completed" line up, regardless of what else happens.
2. **Scope growth is honest, not punishing.** When you add tasks, the "Total" line goes up — but your completed line stays where it is. You can see scope grew without feeling like you lost progress.
3. **The gap tells you what's left.** The distance between the lines = remaining work. If the lines converge, you're getting close to done.
4. **It's motivational.** A line that only goes up rewards effort. A line that goes up *and* down based on external factors (new tasks) is demoralizing.

**In short:** The old metric measured *state* (how many items are open). The new metric measures *output* (how much you got done) and *input* (how much you took on) — separately.

---

*This lightweight feature taps into the power of visible progress without adding complexity or backend overhead. It shows your output honestly, even when scope changes — motivational, not punishing.*
