import { createDagView } from './dag/view.js';
import { buildDependencyGraph } from './dag/graph.js';
import {
  addTodo,
  cleanupBlockedBy,
  clearFinished,
  deleteTodo,
  getActionableCount,
  getActionableTodos,
  hasDependencies,
  loadTodos,
  saveTodos,
  setStatus,
  toggleBlocker,
  updateTodoText
} from './todo/model.js';

// OWNERSHIP: main.js is the orchestrator.
// - Owns: todos state, persistence, selectedTaskId, section visibility
// - Owns: #dag-toggle, #dag-summary, #dag-empty-state, #dependency-graph-section
// - dag/view.js owns only SVG rendering inside #dependency-graph container

const ACTIONABLE_FILTER_STORAGE_KEY = 'bumbledo_filter_actionable';

function isMobileViewport() {
  return window.matchMedia('(max-width: 479px)').matches;
}

function loadActionableFilterPreference() {
  try {
    return localStorage.getItem(ACTIONABLE_FILTER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveActionableFilterPreference(isActive) {
  try {
    localStorage.setItem(ACTIONABLE_FILTER_STORAGE_KEY, String(isActive));
  } catch {
    // Ignore storage write failures so the UI stays usable.
  }
}

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
      || target.isContentEditable
  );
}

// DOM initialization - runs on load
if (typeof document !== 'undefined') {
  (function init() {
    const todoList = document.getElementById('todo-list');
    const todoInput = document.getElementById('todo-input');
    const addForm = document.getElementById('add-form');
    const actionableFilterToggle = document.getElementById('actionable-filter-toggle');
    const actionableSummary = document.getElementById('actionable-summary');
    const emptyState = document.getElementById('empty-state');
    const clearFinishedBtn = document.getElementById('clear-finished-btn');
    const dagSection = document.getElementById('dependency-graph-section');
    const dagContainer = document.getElementById('dependency-graph');
    const dagSummary = document.getElementById('dag-summary');
    const dagEmptyState = document.getElementById('dag-empty-state');
    const dagToggle = document.getElementById('dag-toggle');
    const shortcutsHelpBtn = document.getElementById('shortcuts-help-btn');
    const shortcutsHelpModal = document.getElementById('shortcuts-help-modal');
    const shortcutsHelpClose = document.getElementById('shortcuts-help-close');
    const focusInputShortcut = document.getElementById('focus-input-shortcut');

    let todos = loadTodos();
    let selectedTaskId = null;
    let filterActive = loadActionableFilterPreference();
    let dagExpanded = !isMobileViewport() && hasDependencies(todos);
    let dagToggleTouched = false;
    let flashTimeoutId = null;
    let editingId = null;
    let helpModalOpen = false;

    const prefersMacKeys = isMacPlatform();

    if (focusInputShortcut) {
      focusInputShortcut.innerHTML = prefersMacKeys
        ? '<kbd>Cmd</kbd> <span>+</span> <kbd>Shift</kbd> <span>+</span> <kbd>A</kbd>'
        : '<kbd>Ctrl</kbd> <span>+</span> <kbd>Shift</kbd> <span>+</span> <kbd>A</kbd>';
    }

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

    function getVisibleTodos() {
      return filterActive ? getActionableTodos(todos) : todos;
    }

    function findTaskElement(id) {
      return [...todoList.querySelectorAll('li[data-id]')].find(item => item.dataset.id === id) ?? null;
    }

    function focusTaskList() {
      todoList.focus();
    }

    function focusTaskRow(id) {
      const taskElement = findTaskElement(id);
      if (taskElement) {
        taskElement.focus();
      }
    }

    function syncTaskRowSelection() {
      const validSelection = todos.some(todo => todo.id === selectedTaskId);
      if (!validSelection) {
        selectedTaskId = null;
      }

      todoList.querySelectorAll('li[data-id]').forEach((item) => {
        const isSelected = item.dataset.id === selectedTaskId;
        item.classList.toggle('task-row-selected', isSelected);
        item.setAttribute('aria-selected', String(isSelected));
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

    function enterEditMode(id) {
      editingId = id;
      render();
      const input = document.querySelector(`li[data-id="${id}"] .edit-input`);
      if (input) {
        input.focus();
        input.select();
      }
    }

    function saveEdit(newText) {
      if (!editingId) return;
      const trimmed = newText.trim();
      if (!trimmed) return; // Reject empty: keep input focused
      todos = updateTodoText(todos, editingId, newText);
      saveTodos(todos);
      editingId = null;
      render();
    }

    function cancelEdit() {
      editingId = null;
      render();
    }

    function openHelpModal() {
      if (helpModalOpen) return;
      helpModalOpen = true;
      shortcutsHelpModal.hidden = false;
      shortcutsHelpBtn.setAttribute('aria-expanded', 'true');
      shortcutsHelpClose.focus();
    }

    function closeHelpModal() {
      if (!helpModalOpen) return;
      helpModalOpen = false;
      shortcutsHelpModal.hidden = true;
      shortcutsHelpBtn.setAttribute('aria-expanded', 'false');
    }

    function clearSelection({ focusList = false } = {}) {
      selectedTaskId = null;
      syncTaskRowSelection();
      syncDagState();
      if (focusList) {
        focusTaskList();
      }
    }

    function selectTask(id, { focus = false, scroll = false, flash = false } = {}) {
      selectedTaskId = id;
      syncTaskRowSelection();
      syncDagState();

      if (scroll) {
        scrollTaskIntoView(id, flash);
      }

      if (focus) {
        focusTaskRow(id);
      }
    }

    function moveSelection(step) {
      const visibleTodos = getVisibleTodos();
      if (visibleTodos.length === 0) return;

      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTaskId);
      const nextIndex = currentIndex === -1
        ? (step > 0 ? 0 : visibleTodos.length - 1)
        : Math.max(0, Math.min(visibleTodos.length - 1, currentIndex + step));

      const nextTodo = visibleTodos[nextIndex];
      if (!nextTodo) return;

      selectTask(nextTodo.id, { focus: true, scroll: true });
    }

    function toggleSelectedTodoStatus() {
      const selectedTodo = todos.find(todo => todo.id === selectedTaskId);
      if (!selectedTodo) return;
      if (selectedTodo.status !== 'active' && selectedTodo.status !== 'done') return;

      const nextStatus = selectedTodo.status === 'done' ? 'active' : 'done';
      todos = setStatus(todos, selectedTodo.id, nextStatus);
      if (nextStatus === 'done') {
        todos = cleanupBlockedBy(todos, selectedTodo.id);
      }
      saveTodos(todos);
      render();
      selectTask(selectedTodo.id, { focus: true, scroll: true });
    }

    function deleteSelectedTodo() {
      const visibleTodos = getVisibleTodos();
      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTaskId);
      const fallbackId = currentIndex === -1
        ? null
        : visibleTodos[currentIndex + 1]?.id ?? visibleTodos[currentIndex - 1]?.id ?? null;

      todos = deleteTodo(todos, selectedTaskId);
      saveTodos(todos);
      render();

      if (fallbackId && todos.some(todo => todo.id === fallbackId)) {
        selectTask(fallbackId, { focus: true, scroll: true });
      } else {
        clearSelection({ focusList: true });
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

    function reorderVisibleTodos(draggedId, targetId, insertAfter) {
      if (filterActive) {
        const visibleTodos = getActionableTodos(todos);
        const draggedIndex = visibleTodos.findIndex(todo => todo.id === draggedId);
        if (draggedIndex === -1) return todos;

        const reorderedVisible = [...visibleTodos];
        const [movedTodo] = reorderedVisible.splice(draggedIndex, 1);
        let targetIndex = reorderedVisible.findIndex(todo => todo.id === targetId);

        if (!movedTodo || targetIndex === -1) return todos;
        if (insertAfter) targetIndex += 1;

        reorderedVisible.splice(targetIndex, 0, movedTodo);

        let visibleIndex = 0;
        return todos.map(todo => {
          if (todo.status !== 'active') {
            return todo;
          }

          const replacement = reorderedVisible[visibleIndex];
          visibleIndex += 1;
          return replacement ?? todo;
        });
      }

      const reorderedTodos = [...todos];
      const fromIndex = reorderedTodos.findIndex(todo => todo.id === draggedId);
      if (fromIndex === -1) return todos;

      const [movedTodo] = reorderedTodos.splice(fromIndex, 1);
      let toIndex = reorderedTodos.findIndex(todo => todo.id === targetId);

      if (!movedTodo || toIndex === -1) return todos;
      if (insertAfter) toIndex += 1;

      reorderedTodos.splice(toIndex, 0, movedTodo);
      return reorderedTodos;
    }

    function render() {
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      const { actionable, total } = getActionableCount(todos);
      const visibleTodos = getVisibleTodos();
      const showActionableEmptyState = filterActive && total > 0 && actionable === 0;

      if (!visibleTodos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      todoList.innerHTML = '';

      const hasFinished = todos.some(t => t.status === 'done' || t.status === 'cancelled');
      clearFinishedBtn.disabled = !hasFinished;
      actionableFilterToggle.classList.toggle('is-active', filterActive);
      actionableFilterToggle.setAttribute('aria-pressed', String(filterActive));
      actionableSummary.textContent = `${actionable} of ${total} tasks are actionable`;
      emptyState.hidden = total > 0 ? !showActionableEmptyState : false;
      emptyState.textContent = total === 0
        ? 'No todos yet. Add one above!'
        : 'Nothing actionable right now. All your tasks are either done or waiting on something.';

      visibleTodos.forEach(todo => {
        const li = document.createElement('li');
        li.draggable = true;
        li.tabIndex = 0;
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
          saveTodos(todos);
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
          saveTodos(todos);
          render();
        });

        if (editingId === todo.id) {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'edit-input';
          input.value = todo.text;
          input.setAttribute('aria-label', `Edit "${todo.text}"`);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit(input.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          });
          input.addEventListener('blur', () => {
            if (editingId === todo.id) {
              saveEdit(input.value);
            }
          });
          li.append(handle, select, input, deleteBtn);
        } else {
          text.addEventListener('dblclick', () => {
            enterEditMode(todo.id);
          });
          li.append(handle, select, text, deleteBtn);
        }

        if (todo.status === 'blocked' && editingId !== todo.id) {
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
                saveTodos(todos);
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
          selectTask(todo.id);
        });

        li.addEventListener('focusin', () => {
          selectTask(todo.id);
        });

        todoList.appendChild(li);
      });

      syncTaskRowSelection();
      syncDagState();
    }

    addForm.addEventListener('submit', e => {
      e.preventDefault();
      todos = addTodo(todos, todoInput.value);
      saveTodos(todos);
      render();
      todoInput.value = '';
      todoInput.focus();
    });

    actionableFilterToggle.addEventListener('click', () => {
      filterActive = !filterActive;
      saveActionableFilterPreference(filterActive);
      render();
    });

    clearFinishedBtn.addEventListener('click', () => {
      todos = clearFinished(todos);
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }
      saveTodos(todos);
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

    shortcutsHelpBtn.addEventListener('click', () => {
      if (helpModalOpen) {
        closeHelpModal();
        return;
      }
      openHelpModal();
    });

    shortcutsHelpClose.addEventListener('click', () => {
      closeHelpModal();
      focusTaskList();
    });

    shortcutsHelpModal.addEventListener('click', (event) => {
      if (event.target === shortcutsHelpModal) {
        closeHelpModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      const modifierPressed = prefersMacKeys ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      const isTyping = isEditableTarget(event.target);

      if (modifierPressed && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        todoInput.focus();
        todoInput.select();
        return;
      }

      if (event.key === 'Escape') {
        const shouldHandleEscape = helpModalOpen || selectedTaskId !== null;
        if (!shouldHandleEscape) return;
        event.preventDefault();
        closeHelpModal();
        clearSelection({ focusList: true });
        return;
      }

      if (isTyping) {
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        if (helpModalOpen) {
          closeHelpModal();
        } else {
          openHelpModal();
        }
        return;
      }

      if (helpModalOpen) {
        return;
      }

      const canNavigate = selectedTaskId !== null || document.activeElement === todoList || todoList.contains(document.activeElement);

      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && canNavigate) {
        event.preventDefault();
        moveSelection(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }

      if (!selectedTaskId) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        toggleSelectedTodoStatus();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedTodo();
      }
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

      const targetId = targetLi.dataset.id;
      if (draggedId === targetId) return;

      const rect = targetLi.getBoundingClientRect();
      const insertAfter = e.clientY >= rect.top + rect.height / 2;

      todos = reorderVisibleTodos(draggedId, targetId, insertAfter);
      saveTodos(todos);
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
