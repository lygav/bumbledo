# PRD: Burndown View

**Author:** Tess  
**Status:** Draft  
**Date:** 2025-07-18

---

## 1. Overview

A simple, lightweight progress chart that shows how many active tasks remain over time. By sampling the task list daily, bumbledo will track completion velocity and visualize progress as a line chart. This gives users a motivational snapshot of progress and helps them spot patterns in their own work rhythms.

**Why:** Users planning with dependencies need confidence that they're making progress. A simple burndown chart (without the Scrum overhead) motivates completion and makes abstract progress tangible. It's stored in localStorage, so no backend required.

---

## 2. Goals & Non-Goals

### Goals

- Display a line chart showing active task count over time (last 30 days)
- Auto-sample the list once per day (on page load, if new day detected)
- Show current active count prominently at top of chart
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
| U1 | Planner | See a simple chart of my active task count over the past 30 days | I can see if I'm making progress or adding too much |
| U2 | User | Know how many tasks I have "open" right now | I get a quick sense of my workload |
| U3 | User | Have the chart auto-update daily without any action from me | I don't have to manually log progress |
| U4 | User | Collapse the chart if it's not relevant to me | It doesn't clutter my interface |
| U5 | Power user | Understand the trend in my task list | I can spot patterns (e.g., "I add way more than I complete") |

---

## 4. Functional Requirements

### 4.1 Data Collection

- On page load, check if a sample was taken "today" (detect day change via timestamp)
- If not, count all active todos (`status === "active"`) and record a data point: `{ date, count }`
- Store samples in a new localStorage key: `"todos_burndown"` as a JSON array: `[{ date: "2025-07-18", count: 5 }, ...]`
- Keep only the past 30 days of data; prune older entries on each sample

### 4.2 Chart Display

- Show a line chart with date on the x-axis and active count on the y-axis
- Use a simple SVG or Canvas-based chart (no charting library; keep it lightweight)
- Alternatively, use a minimal charting library if already available (check `package.json`)
- Display the **current active count prominently** above or within the chart (e.g., "5 active tasks")
- Include a tooltip on hover showing the date and count for that data point

### 4.3 Chart Section

- Place the chart below the todo list, above the "Clear finished" button (or in a dedicated collapsible section)
- Add a toggle button (e.g., "Burndown") to show/hide the chart (default: hidden on first visit)
- When collapsed, show a summary line: e.g., "5 active · Down 2 from yesterday"
- If fewer than 3 data points, show a message: "Not enough data yet. Come back in a few days!"

### 4.4 Styling & Responsiveness

- Chart adapts to mobile (< 480px): smaller font, fewer x-axis labels
- Use subtle colors: light blue line, light grey grid, no heavy shadows
- Line should be smooth (spline interpolation) or straight segments; either is acceptable
- Avoid clashing with the app's minimal aesthetic

### 4.5 Sample Timing

- Sample is taken once per calendar day (UTC or local time, consistent)
- Sample captures count at time of page load; not a 24-hour average
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
| AC1 | On first page load of a new day, the app samples the active task count and stores it in `"todos_burndown"`. |
| AC2 | Subsequent page loads on the same day do not create new samples (one per calendar day). |
| AC3 | The chart displays a line graph with date on x-axis and count on y-axis for the past 30 days. |
| AC4 | The current active task count is displayed prominently (e.g., "5 active tasks"). |
| AC5 | Hovering over a data point shows a tooltip with the date and count. |
| AC6 | The chart is hidden by default; a toggle button "Burndown" shows/hides it. |
| AC7 | When collapsed, a summary line shows current count and change from yesterday (e.g., "5 active · Down 2"). |
| AC8 | If fewer than 3 samples exist, a message "Not enough data yet..." is shown instead of a chart. |
| AC9 | Data older than 30 days is automatically pruned from localStorage on each sample. |
| AC10 | The chart is responsive and readable on mobile (320px–1440px) without horizontal scroll. |
| AC11 | Refreshing the page does not create a duplicate sample for the same day. |

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

---

## 8. Dependencies

- **Existing features:** Todo list, task states, localStorage persistence
- **New data:** `"todos_burndown"` localStorage key (separate, non-breaking)
- **Does not block:** Other features; purely additive visualization

---

*This lightweight feature taps into the power of visible progress without adding complexity or backend overhead. It's motivational, not prescriptive.*
