import { createDagView } from './dag.js';
import { buildDependencyGraph } from './graph.js';

// OWNERSHIP: app.js is the orchestrator.
// - Owns: todos state, persistence, selectedTaskId, section visibility
// - Owns: #dag-toggle, #dag-summary, #dag-empty-state, #dependency-graph-section
// - dag.js owns only SVG rendering inside #dependency-graph container

// Storage interface - injectable for testing
const defaultStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
};

// Pure logic functions - exported for testing

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function migrateTodos(list) {
  return list.map(t => {
    if ('done' in t && !('status' in t)) {
      const { done, ...rest } = t;
      return { ...rest, status: done ? 'done' : 'active' };
    }
    if (!('status' in t)) {
      return { ...t, status: 'active' };
    }
    if (t.status === 'blocked' && !Array.isArray(t.blockedBy)) {
      return { ...t, blockedBy: [] };
    }
    return t;
  });
}

export function loadTodos(storage = defaultStorage, storageKey = 'todos') {
  try {
    const data = storage.getItem(storageKey);
    const parsed = data ? JSON.parse(data) : [];
    return migrateTodos(parsed);
  } catch {
    return [];
  }
}

export function saveTodos(todosToSave, storage = defaultStorage, storageKey = 'todos') {
  const clean = todosToSave.map(t => {
    const obj = { id: t.id, text: t.text, status: t.status };
    if (t.status === 'blocked' && Array.isArray(t.blockedBy) && t.blockedBy.length > 0) {
      obj.blockedBy = t.blockedBy;
    }
    return obj;
  });
  storage.setItem(storageKey, JSON.stringify(clean));
}

export function addTodo(todos, text) {
  const trimmed = text.trim();
  if (!trimmed) return todos;
  return [...todos, { id: generateId(), text: trimmed, status: 'active' }];
}

export function setStatus(todos, id, newStatus) {
  return todos.map(todo => {
    if (todo.id !== id) return todo;

    const updated = { ...todo, status: newStatus };

    if (newStatus === 'blocked') {
      if (!Array.isArray(updated.blockedBy)) updated.blockedBy = [];
    } else {
      delete updated.blockedBy;
    }

    return updated;
  });
}

export function toggleBlocker(todos, todoId, blockerId) {
  return todos.map(todo => {
    if (todo.id !== todoId || todo.status !== 'blocked') return todo;

    const blockedBy = Array.isArray(todo.blockedBy) ? [...todo.blockedBy] : [];
    const idx = blockedBy.indexOf(blockerId);

    if (idx >= 0) {
      blockedBy.splice(idx, 1);
      if (blockedBy.length === 0) {
        return { ...todo, status: 'active', blockedBy: undefined };
      }
      return { ...todo, blockedBy };
    }

    return { ...todo, blockedBy: [...blockedBy, blockerId] };
  });
}

export function cleanupBlockedBy(todos, removedId) {
  return todos.map(t => {
    if (t.status !== 'blocked' || !Array.isArray(t.blockedBy)) return t;

    const filteredBlockers = t.blockedBy.filter(id => id !== removedId);

    if (filteredBlockers.length === 0) {
      const { blockedBy, ...rest } = t;
      return { ...rest, status: 'active' };
    }

    return { ...t, blockedBy: filteredBlockers };
  });
}

export function deleteTodo(todos, id) {
  const filtered = todos.filter(t => t.id !== id);
  return cleanupBlockedBy(filtered, id);
}

export function clearFinished(todos) {
  const removedIds = todos.filter(t => t.status === 'done' || t.status === 'cancelled').map(t => t.id);
  let filtered = todos.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  removedIds.forEach(id => {
    filtered = cleanupBlockedBy(filtered, id);
  });
  return filtered;
}

function hasDependencies(todos) {
  return todos.some(todo => Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0);
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 479px)').matches;
}

// DOM initialization - runs on load
if (typeof document !== 'undefined') {
  (function init() {
    const STORAGE_KEY = 'todos';
    const todoList = document.getElementById('todo-list');
    const todoInput = document.getElementById('todo-input');
    const addForm = document.getElementById('add-form');
    const emptyState = document.getElementById('empty-state');
    const clearFinishedBtn = document.getElementById('clear-finished-btn');
    const dagSection = document.getElementById('dependency-graph-section');
    const dagContainer = document.getElementById('dependency-graph');
    const dagSummary = document.getElementById('dag-summary');
    const dagEmptyState = document.getElementById('dag-empty-state');
    const dagToggle = document.getElementById('dag-toggle');

    let todos = loadTodos();
    let selectedTaskId = null;
    let dagExpanded = !isMobileViewport() && hasDependencies(todos);
    let dagToggleTouched = false;
    let flashTimeoutId = null;

    const dagView = createDagView({
      container: dagContainer,
      onSelectTask: (id) => {
        selectedTaskId = id;
        syncTaskRowSelection();
        syncDagState();
        scrollTaskIntoView(id, true);
      }
    });

    saveTodos(todos);

    function findTaskElement(id) {
      return [...todoList.querySelectorAll('li[data-id]')].find(item => item.dataset.id === id) ?? null;
    }

    function syncTaskRowSelection() {
      const validSelection = todos.some(todo => todo.id === selectedTaskId);
      if (!validSelection) {
        selectedTaskId = null;
      }

      todoList.querySelectorAll('li[data-id]').forEach((item) => {
        item.classList.toggle('task-row-selected', item.dataset.id === selectedTaskId);
      });
    }

    function flashTaskRow(taskElement) {
      if (!taskElement) return;
      taskElement.classList.remove('task-row-flash');
      void taskElement.offsetWidth;
      taskElement.classList.add('task-row-flash');
      window.clearTimeout(flashTimeoutId);
      flashTimeoutId = window.setTimeout(() => {
        taskElement.classList.remove('task-row-flash');
      }, 1400);
    }

    function scrollTaskIntoView(id, shouldFlash = false) {
      const taskElement = findTaskElement(id);
      if (!taskElement) return;
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (shouldFlash) {
        flashTaskRow(taskElement);
      }
    }

    function syncDagState() {
      const { hasDependencies: dependencyState, stats } = buildDependencyGraph(todos);

      if (!dagToggleTouched) {
        dagExpanded = dependencyState && !isMobileViewport();
      }

      if (!dependencyState) {
        dagExpanded = false;
      }

      dagSection.classList.toggle('is-empty', !dependencyState);
      dagToggle.disabled = !dependencyState;
      dagToggle.textContent = dagExpanded ? 'Hide' : 'Show graph';
      dagToggle.setAttribute('aria-expanded', String(dependencyState && dagExpanded));
      dagContainer.hidden = !dependencyState || !dagExpanded;
      dagSummary.textContent = `${stats.nodeCount} tasks · ${stats.edgeCount} dependencies`;
      dagSummary.hidden = dagExpanded || !dependencyState;
      dagEmptyState.hidden = dependencyState || dagExpanded;

      if (dependencyState && dagExpanded) {
        dagView.update({ todos, selectedTaskId });
      } else {
        dagView.update({ todos: [], selectedTaskId: null });
      }
    }

    function render() {
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      todoList.innerHTML = '';

      const hasFinished = todos.some(t => t.status === 'done' || t.status === 'cancelled');
      clearFinishedBtn.disabled = !hasFinished;
      emptyState.hidden = todos.length > 0;

      todos.forEach(todo => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.id = todo.id;
        if (todo.status !== 'active') li.classList.add('status-' + todo.status);
        if (todo.id === selectedTaskId) li.classList.add('task-row-selected');

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.setAttribute('aria-hidden', 'true');
        handle.textContent = '⠿';

        const select = document.createElement('select');
        select.className = 'todo-status';
        select.setAttribute('aria-label', `Status for "${todo.text}"`);
        const statusOptions = [
          { value: 'active', label: '— None —' },
          { value: 'done', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'blocked', label: 'Blocked' }
        ];
        statusOptions.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.value;
          opt.textContent = s.label;
          if (s.value === todo.status) opt.selected = true;
          select.appendChild(opt);
        });
        select.style.color = todo.status === 'active' ? '#999' : '#1a1a1a';
        select.addEventListener('change', () => {
          todos = setStatus(todos, todo.id, select.value);
          if (select.value === 'done' || select.value === 'cancelled') {
            todos = cleanupBlockedBy(todos, todo.id);
          }
          saveTodos(todos, defaultStorage, STORAGE_KEY);
          render();
        });

        const text = document.createElement('span');
        text.className = 'todo-text';
        text.textContent = todo.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', `Delete "${todo.text}"`);
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
          todos = deleteTodo(todos, todo.id);
          if (selectedTaskId === todo.id) {
            selectedTaskId = null;
          }
          saveTodos(todos, defaultStorage, STORAGE_KEY);
          render();
        });

        li.append(handle, select, text, deleteBtn);

        if (todo.status === 'blocked') {
          if (Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0) {
            const blockerNames = todo.blockedBy
              .map(bid => {
                const blocker = todos.find(t => t.id === bid);
                if (!blocker) return null;
                return blocker.text.length > 30 ? blocker.text.slice(0, 30) + '…' : blocker.text;
              })
              .filter(Boolean);

            if (blockerNames.length > 0) {
              let displayText;
              if (blockerNames.length <= 3) {
                displayText = 'Blocked by: ' + blockerNames.join(', ');
              } else {
                displayText = 'Blocked by: ' + blockerNames.slice(0, 2).join(', ') + ' + ' + (blockerNames.length - 2) + ' more';
              }
              const subtitle = document.createElement('div');
              subtitle.className = 'blocked-by-text';
              subtitle.textContent = displayText;
              li.appendChild(subtitle);
            }
          }

          const picker = document.createElement('div');
          picker.className = 'blocker-picker';

          const pickerTitle = document.createElement('div');
          pickerTitle.className = 'blocker-picker-title';
          pickerTitle.textContent = 'Blocked by:';
          picker.appendChild(pickerTitle);

          const eligible = todos.filter(t => t.id !== todo.id && (t.status === 'active' || t.status === 'blocked'));

          if (eligible.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'no-blockers-msg';
            msg.textContent = 'No other tasks to select.';
            picker.appendChild(msg);
          } else {
            eligible.forEach(t => {
              const label = document.createElement('label');
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = Array.isArray(todo.blockedBy) && todo.blockedBy.includes(t.id);
              cb.addEventListener('change', () => {
                todos = toggleBlocker(todos, todo.id, t.id);
                saveTodos(todos, defaultStorage, STORAGE_KEY);
                render();
              });

              const labelText = document.createElement('span');
              labelText.textContent = t.text.length > 40 ? t.text.slice(0, 40) + '…' : t.text;

              label.append(cb, labelText);
              picker.appendChild(label);
            });
          }

          li.appendChild(picker);
        }

        li.addEventListener('click', () => {
          selectedTaskId = todo.id;
          syncTaskRowSelection();
          syncDagState();
        });

        li.addEventListener('focusin', () => {
          selectedTaskId = todo.id;
          syncTaskRowSelection();
          syncDagState();
        });

        todoList.appendChild(li);
      });

      syncTaskRowSelection();
      syncDagState();
    }

    addForm.addEventListener('submit', e => {
      e.preventDefault();
      todos = addTodo(todos, todoInput.value);
      saveTodos(todos, defaultStorage, STORAGE_KEY);
      render();
      todoInput.value = '';
      todoInput.focus();
    });

    clearFinishedBtn.addEventListener('click', () => {
      todos = clearFinished(todos);
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }
      saveTodos(todos, defaultStorage, STORAGE_KEY);
      render();
    });

    dagToggle.addEventListener('click', () => {
      if (!hasDependencies(todos)) {
        return;
      }
      dagToggleTouched = true;
      dagExpanded = !dagExpanded;
      syncDagState();
    });

    window.addEventListener('resize', () => {
      if (!dagToggleTouched) {
        dagExpanded = hasDependencies(todos) && !isMobileViewport();
      }
      syncDagState();
    });

    let draggedId = null;

    todoList.addEventListener('dragstart', e => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      draggedId = li.dataset.id;
      li.classList.add('dragging');
      document.body.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
    });

    todoList.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const li = e.target.closest('li[data-id]');
      if (!li || li.dataset.id === draggedId) return;

      todoList.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });

      const rect = li.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        li.classList.add('drag-over-above');
      } else {
        li.classList.add('drag-over-below');
      }
    });

    todoList.addEventListener('dragleave', e => {
      const li = e.target.closest('li[data-id]');
      if (li && !li.contains(e.relatedTarget)) {
        li.classList.remove('drag-over-above', 'drag-over-below');
      }
    });

    todoList.addEventListener('drop', e => {
      e.preventDefault();
      const targetLi = e.target.closest('li[data-id]');
      if (!targetLi || !draggedId) return;

      const fromIndex = todos.findIndex(t => t.id === draggedId);
      const targetId = targetLi.dataset.id;
      if (draggedId === targetId) return;

      const rect = targetLi.getBoundingClientRect();
      const insertAfter = e.clientY >= rect.top + rect.height / 2;

      const [moved] = todos.splice(fromIndex, 1);

      let toIndex = todos.findIndex(t => t.id === targetId);
      if (insertAfter) toIndex += 1;

      todos.splice(toIndex, 0, moved);
      saveTodos(todos, defaultStorage, STORAGE_KEY);
      render();
    });

    todoList.addEventListener('dragend', () => {
      draggedId = null;
      document.body.classList.remove('is-dragging');
      todoList.querySelectorAll('.dragging, .drag-over-above, .drag-over-below').forEach(el => {
        el.classList.remove('dragging', 'drag-over-above', 'drag-over-below');
      });
    });

    window.addEventListener('beforeunload', () => {
      dagView.destroy();
    }, { once: true });

    render();
  })();
}
