# 🐝 bumbledo

**A tiny todo app that buzzes through your tasks**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![GitHub stars](https://img.shields.io/github/stars/lygav/bumbledo.svg)](https://github.com/lygav/bumbledo/stargazers) [![GitHub last commit](https://img.shields.io/github/last-commit/lygav/bumbledo.svg)](https://github.com/lygav/bumbledo/commits)

A lightweight, zero-friction browser-based todo app built with vanilla JavaScript. No backend, no framework, no sign-up. Just open it and start organizing your work—your tasks persist instantly in your browser's localStorage.

---

## ✨ Features

- **📝 Quick capture, mouse or keyboard** — Add tasks instantly, then fly with shortcuts
- **🎯 Five-state tracking** — Move tasks through To Do, In Progress, Done, Cancelled, or Blocked
- **✅ Ready filter** — Toggle **Ready** to show only ready work, with a persisted “N of M tasks are ready” summary
- **🔗 Dependency tracking** — Block tasks, pick blockers, and prevent premature completion when dependencies remain
- **🔔 Smart unblock alerts** — Get a notification when finishing one task unlocks others, plus a brief highlight on newly ready rows
- **📈 Burndown progress** — Track To Do, In Progress, blocked, and done counts in a 30-day rolling chart inside the collapsible **Progress** section
- **📊 Dependency graph** — Visualize task dependencies with status-aware colors in an interactive DAG
- **🎉 Delightful feedback** — Done tasks get a green success state and a confetti burst
- **🖥️ Responsive layout** — Desktop shows tasks beside a sidebar; mobile stacks everything cleanly
- **🎚️ Drag, clear, save** — Reorder tasks, clear finished work, and keep everything in localStorage

---

## 🚀 Getting Started

### Try It Now

Open `index.html` directly in your browser. The app loads instantly with no installation required.

```bash
# Clone the repo
git clone https://github.com/lygav/bumbledo.git
cd bumbledo

# Open in your browser
open index.html
# or
start index.html
```

### Development Setup

Bumbledo uses **Vite** for local development and builds:

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# Open http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Watch tests during development
npm test:watch
```

---

## 🎮 Quick Start

- **Add a task:** Type and press Enter
- **Jump to input:** Press **Cmd/Ctrl + Shift + A**
- **Select and move:** Click a todo, then use **↑ / ↓** to move through visible tasks
- **Change status fast:** Press **Enter** to cycle a selected task through **To Do → In Progress → Done**, or use the status dropdown
- **Delete quickly:** Press **Delete** or **Backspace** on a selected todo
- **Block tasks:** Mark as Blocked and check which tasks are blocking it
- **Focus:** Toggle **Ready** to hide work that isn’t ready yet and keep that preference between visits
- **Track momentum:** Open **Progress** to see To Do, In Progress, blocked, and done counts alongside the 30-day burndown chart
- **Visualize:** Click "Dependencies" to see task blocking relationships in a graph
- **Learn shortcuts:** Press **?** for the help modal, and **Escape** to close dialogs or clear selection
- **Reorder:** Drag the ⋮ handle to move tasks up or down
- **Clean up:** Click "Clear finished" to remove Done and Cancelled tasks

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + Shift + A** | Focus the task input and select its text |
| **↑ / ↓** | Move selection to the previous or next visible todo |
| **Enter** | Cycle the selected todo through To Do → In Progress → Done |
| **Delete / Backspace** | Delete the selected todo |
| **?** | Show or hide shortcut help |
| **Escape** | Deselect the current todo and close open dialogs |

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| **Framework** | Vanilla JavaScript (no React, Vue, etc.) |
| **Architecture** | Modular ES modules for todos, DAG rendering, and notifications |
| **Build** | Vite |
| **Testing** | Vitest |
| **Persistence** | Browser localStorage |
| **Visualization** | Dagre + custom SVG rendering |
| **Styling** | Vanilla CSS |

**Zero external runtime dependencies.** The only npm package at runtime is `dagre` for graph layout.

---

## 💾 Persistence

Tasks are stored in your browser's `localStorage`. No backend, no sync across devices, no cloud backup—everything lives locally. Clear your browser data and tasks are gone. It's intentional: simple tools don't need complexity.


## 🌐 Browser & Accessibility

Works in all modern browsers (Chrome, Firefox, Safari). Keyboard navigation, ARIA labels, touch-friendly controls, and a responsive layout that becomes a task-list-plus-sidebar view on desktop.

---

## 📝 License

MIT

---

## 🤝 Contributing

Found a bug? Have an idea? Check the [PRD.md](./PRD.md) for full feature scope, then open an issue or pull request on GitHub.

---

## Known Limitations

No cross-device sync, no undo, no search, no categories, no cloud backup. These are intentional. Bumbledo stays simple.

---

## 💡 Quick Tips

- **Rapid entry:** Press Enter repeatedly to add tasks quickly
- **Shortcut memory:** `?` opens the keyboard cheat sheet anytime
- **Stay focused:** Leave **Ready** on to return to only ready work next time
- **Read progress at a glance:** The **Progress** sidebar shows To Do, In Progress, blocked, and done counts alongside burndown, while smart alerts call out newly unblocked tasks
- **Offline:** Works with no internet—data lives on your device

---

**Made with ❤️ by [Vladi Lyga](https://github.com/lygav)**
