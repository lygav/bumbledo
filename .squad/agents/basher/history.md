# Basher — History

## Project Context
- **Project:** bumbledo — A single-page browser-based todo app with drag-and-drop reordering, dependency DAG visualization, and localStorage persistence
- **Stack:** Vanilla JavaScript, Vite, Vitest, HTML/CSS
- **User:** Vladi Lyga
- **Repo:** github.com/lygav/bumbledo

## Key Files
- `PRD.md` — Product requirements document
- `index.html` — Single-page app entry
- `src/main.js` — App orchestrator
- `src/todo/model.js` — Todo data model
- `src/dag/` — Dependency graph visualization

## Sessions

### 2025-03-29: README Documentation

**Deliverable:** `README.md` written and committed.

**Approach:**
- Read PRD.md, index.html, package.json, and src/main.js to understand feature set and architecture
- Structured README with playful tone matching "bumbledo" branding
- Included: features, getting started, how-to guides, tech stack, project structure, persistence, accessibility, browser support
- Added tips & tricks and known limitations for transparency

**Key Decisions:**
- Emoji sparingly (section headers only, not every bullet)
- Feature list prioritizes user value over technical detail
- "How It Works" explains each major feature through user perspective
- Tech Stack section de-emphasizes framework-less nature (it's an advantage, not a limitation)
- Accessibility section signals quality without being preachy
- Tips & Tricks add practical value for power users

**Notes:**
- Package.json still has generic "description" — may want to update later for SEO
- Project name "bumbledo" is awesome; tone should stay light and playful
- DAG visualization is advanced but explained simply in Dependencies section
- localStorage persistence is a feature, not a limitation for this use case

## Learnings

**Architecture patterns:**
- main.js owns state & section visibility (dag-toggle, selectedTaskId)
- dag/view.js owns only SVG rendering (clean separation of concerns)
- localStorage with automatic backward-compatible migrations (smart pattern)
- Status field + blockedBy optional field (data model is elegant)

**Documentation approach for this project:**
- Keep explanations brief and task-focused
- Use tables for state/options (easier to scan than prose)
- Provide code examples for developers (JSON data format)
- Emphasize "zero setup" as a key value prop
- Accessibility matters even for simple apps

**bumbledo brand voice:**
- Playful (bee theme, task = "buzz")
- Minimal (no unnecessary features)
- Honest (lists limitations explicitly)
- Practical (tips & tricks that actually help)

**README simplification (2025-03-29):**
- User preference: app is simple and mostly self-explanatory
- Removed state coloring table (appearance descriptions are obvious from UI)
- Collapsed "How It Works" into "Quick Start" (bullet points vs long explanations)
- Removed Project Structure section (developers can explore code)
- Condensed Data Persistence from 20 lines to 2 sentences
- Merged Accessibility + Browser Support into single compact section
- Trimmed Tips & Tricks—only essential keyboard/offline hints remain
- Final README: 130 lines (was 235), ~40% reduction
- Focus: scannability first, let UI teach the rest
