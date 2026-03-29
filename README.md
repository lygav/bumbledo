# 🐝 bumbledo

**A tiny todo app that buzzes through your tasks**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![GitHub stars](https://img.shields.io/github/stars/lygav/bumbledo.svg)](https://github.com/lygav/bumbledo/stargazers) [![GitHub last commit](https://img.shields.io/github/last-commit/lygav/bumbledo.svg)](https://github.com/lygav/bumbledo/commits)

A lightweight, zero-friction browser-based todo app built with vanilla JavaScript. No backend, no framework, no sign-up. Just open it and start organizing your work—your tasks persist instantly in your browser's localStorage.

---

## ✨ Features

- **📝 Quick task capture** — Type and press Enter to add a new todo instantly
- **🎯 Four-state tracking** — Mark tasks as Active, Done, Cancelled, or Blocked
- **🔗 Dependency tracking** — Flag blocked tasks and specify what's holding them up
- **✅ Actionable Now filter** — Focus on only the tasks you can work on right now
- **📊 Dependency graph** — Visualize task dependencies with an interactive DAG
- **🎚️ Drag-to-reorder** — Grab any task and drag it to your preferred position
- **📋 Clear clutter** — Remove all completed and cancelled tasks with one click
- **💾 Auto-save** — Your tasks persist across browser sessions with localStorage
- **⚡ Zero overhead** — No server, no accounts, no setup. Just works.

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
- **Change status:** Click the status dropdown (Active, Done, Cancelled, Blocked)
- **Block tasks:** Mark as Blocked and check which tasks are blocking it
- **Reorder:** Drag the ⋮ handle to move tasks up or down
- **Focus:** Toggle "Actionable" to hide done, cancelled, and blocked tasks
- **Visualize:** Click "Dependencies" to see task blocking relationships in a graph
- **Clean up:** Click "Clear finished" to remove Done and Cancelled tasks

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| **Framework** | Vanilla JavaScript (no React, Vue, etc.) |
| **Build** | Vite |
| **Testing** | Vitest |
| **Persistence** | Browser localStorage |
| **Visualization** | D3 + Dagre (DAG layout) |
| **Styling** | Vanilla CSS |

**Zero external runtime dependencies.** The only npm package at runtime is `dagre` for graph layout.

---

## 💾 Persistence

Tasks are stored in your browser's `localStorage`. No backend, no sync across devices, no cloud backup—everything lives locally. Clear your browser data and tasks are gone. It's intentional: simple tools don't need complexity.


## 🌐 Browser & Accessibility

Works in all modern browsers (Chrome, Firefox, Safari). Keyboard navigation, ARIA labels, touch-friendly, and responsive from mobile to desktop.

---

## 📝 License

ISC

---

## 🤝 Contributing

Found a bug? Have an idea? Check the [PRD.md](./PRD.md) for full feature scope, then open an issue or pull request on GitHub.

---

## Known Limitations

No cross-device sync, no undo, no search, no categories, no cloud backup. These are intentional. Bumbledo stays simple.

---

## 💡 Quick Tips

- **Rapid entry:** Press Enter repeatedly to add tasks quickly
- **Keyboard workflow:** Tab through tasks, press Space to toggle state, Shift+Tab to go backward
- **Offline:** Works with no internet—data lives on your device

---

**Made with ❤️ by [Vladi Lyga](https://github.com/lygav)**
