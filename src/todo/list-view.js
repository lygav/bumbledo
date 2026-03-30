import {
  BLOCKER_SOURCE_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_OPTIONS
} from '../app/constants.js';

const BLOCKER_SOURCE_STATUS_SET = new Set(BLOCKER_SOURCE_TODO_STATUSES);
const CYCLE_TOOLTIP_MESSAGE = 'Can\'t add — would create a circular dependency';
const CYCLE_TOOLTIP_CLEAR_MS = 2000;

function truncateText(text, limit) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function createTodoListView({
  container,
  getHighlightRemainingMs,
  canEditTodoStatus,
  wouldCreateCycle,
  onSelectTask,
  onEnterEditMode,
  onSaveEdit,
  onCancelEdit,
  onDeleteTask,
  onStatusChange,
  onToggleBlocker,
  onFinalizeBlockedStatus,
  onClearHighlight
}) {
  let currentTodos = [];
  let currentVisibleTodos = [];
  let currentSelectedTaskId = null;
  let currentEditingId = null;
  let flashTimeoutId = null;

  function findTaskElement(id) {
    return [...container.querySelectorAll('li[data-id]')].find((item) => item.dataset.id === id) ?? null;
  }

  function focusList() {
    container.focus();
  }

  function focusTask(id) {
    findTaskElement(id)?.focus();
  }

  function syncSelection(selectedTaskId = currentSelectedTaskId) {
    currentSelectedTaskId = currentVisibleTodos.some((todo) => todo.id === selectedTaskId)
      ? selectedTaskId
      : null;

    container.querySelectorAll('li[data-id]').forEach((item) => {
      const isSelected = item.dataset.id === currentSelectedTaskId;
      item.classList.toggle('task-row-selected', isSelected);
      item.setAttribute('aria-selected', String(isSelected));
    });
  }

  function syncUnblockedHighlights() {
    [...container.querySelectorAll('li[data-id]')].forEach((taskElement) => {
      const remainingMs = getHighlightRemainingMs(taskElement.dataset.id);
      if (remainingMs !== null && remainingMs > 0) {
        taskElement.classList.add('task-row-unblocked');
        taskElement.style.setProperty('--unblocked-delay', `${remainingMs - 3000}ms`);
        return;
      }

      taskElement.classList.remove('task-row-unblocked');
      taskElement.style.removeProperty('--unblocked-delay');
    });
  }

  function flashTaskRow(taskElement) {
    if (!taskElement) {
      return;
    }

    taskElement.classList.remove('task-row-flash');
    void taskElement.offsetWidth;
    taskElement.classList.add('task-row-flash');
    window.clearTimeout(flashTimeoutId);
    flashTimeoutId = window.setTimeout(() => {
      taskElement.classList.remove('task-row-flash');
    }, 1400);
  }

  function scrollTaskIntoView(id, { flash = false } = {}) {
    const taskElement = findTaskElement(id);
    if (!taskElement) {
      return;
    }

    taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (flash) {
      flashTaskRow(taskElement);
    }
  }

  function createBlockedSubtitle(todo) {
    if (!Array.isArray(todo.blockedBy) || todo.blockedBy.length === 0) {
      return null;
    }

    const blockerNames = todo.blockedBy
      .map((blockerId) => {
        const blocker = currentTodos.find((item) => item.id === blockerId);
        if (!blocker) {
          return null;
        }

        return truncateText(blocker.text, 30);
      })
      .filter(Boolean);

    if (blockerNames.length === 0) {
      return null;
    }

    const subtitle = document.createElement('div');
    subtitle.className = 'blocked-by-text';
    subtitle.textContent = blockerNames.length <= 3
      ? `Blocked by: ${blockerNames.join(', ')}`
      : `Blocked by: ${blockerNames.slice(0, 2).join(', ')} + ${blockerNames.length - 2} more`;
    return subtitle;
  }

  function createBlockerPicker(todo, row) {
    const picker = document.createElement('div');
    picker.className = 'blocker-picker';
    picker.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const pickerTitle = document.createElement('div');
    pickerTitle.className = 'blocker-picker-title';
    pickerTitle.textContent = 'Blocked by:';
    picker.appendChild(pickerTitle);

    const eligibleTodos = currentTodos.filter(
      (item) => item.id !== todo.id && BLOCKER_SOURCE_STATUS_SET.has(item.status)
    );

    if (eligibleTodos.length === 0) {
      const message = document.createElement('div');
      message.className = 'no-blockers-msg';
      message.textContent = 'No other tasks to select.';
      picker.appendChild(message);
    } else {
      eligibleTodos.forEach((item) => {
        const label = document.createElement('label');
        const checkboxId = `blocker-${todo.id}-${item.id}`;
        const checkbox = document.createElement('input');
        let clearCycleMessageTimeoutId = null;

        label.htmlFor = checkboxId;
        checkbox.id = checkboxId;
        checkbox.type = 'checkbox';
        checkbox.checked = Array.isArray(todo.blockedBy) && todo.blockedBy.includes(item.id);
        checkbox.addEventListener('change', () => {
          checkbox.setCustomValidity('');

          if (checkbox.checked && wouldCreateCycle(currentTodos, todo.id, item.id)) {
            checkbox.checked = false;
            checkbox.setCustomValidity(CYCLE_TOOLTIP_MESSAGE);
            checkbox.reportValidity();

            if (clearCycleMessageTimeoutId !== null) {
              window.clearTimeout(clearCycleMessageTimeoutId);
            }

            clearCycleMessageTimeoutId = window.setTimeout(() => {
              checkbox.setCustomValidity('');
              clearCycleMessageTimeoutId = null;
            }, CYCLE_TOOLTIP_CLEAR_MS);
            return;
          }

          onToggleBlocker(todo.id, item.id);
        });

        const labelText = document.createElement('span');
        labelText.textContent = truncateText(item.text, 40);

        label.append(checkbox, labelText);
        picker.appendChild(label);
      });
    }

    row.addEventListener('focusout', () => {
      queueMicrotask(() => {
        if (row.contains(document.activeElement)) {
          return;
        }

        onFinalizeBlockedStatus(todo.id);
      });
    });

    return picker;
  }

  function createTodoRow(todo) {
    const row = document.createElement('li');
    row.draggable = true;
    row.tabIndex = 0;
    row.dataset.id = todo.id;

    if (todo.status !== TODO_STATUS.TODO) {
      row.classList.add(`status-${todo.status}`);
    }

    const remainingMs = getHighlightRemainingMs(todo.id);
    if (remainingMs !== null && remainingMs > 0) {
      row.classList.add('task-row-unblocked');
      row.style.setProperty('--unblocked-delay', `${remainingMs - 3000}ms`);
    }

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.setAttribute('role', 'button');
    handle.textContent = '⠿';

    const statusSelect = document.createElement('select');
    statusSelect.className = 'todo-status';
    statusSelect.setAttribute('aria-label', `Status for "${todo.text}"`);
    TODO_STATUS_OPTIONS.forEach((statusOption) => {
      const option = document.createElement('option');
      option.value = statusOption.value;
      option.textContent = statusOption.label;
      if (statusOption.value === todo.status) {
        option.selected = true;
      }
      statusSelect.appendChild(option);
    });
    statusSelect.style.color = '#1a1a1a';
    statusSelect.addEventListener('change', () => {
      onStatusChange(todo.id, statusSelect.value, { returnFocusEl: statusSelect });
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`);
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => {
      onDeleteTask(todo.id);
    });

    if (currentEditingId === todo.id) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-input';
      input.value = todo.text;
      input.setAttribute('aria-label', `Edit "${todo.text}"`);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSaveEdit(input.value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancelEdit();
        }
      });
      input.addEventListener('blur', () => {
        if (currentEditingId === todo.id) {
          onSaveEdit(input.value);
        }
      });
      row.append(handle, statusSelect, input, deleteButton);
    } else {
      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;
      text.addEventListener('dblclick', () => {
        if (canEditTodoStatus(todo.status)) {
          onEnterEditMode(todo.id);
        }
      });
      row.append(handle, statusSelect, text, deleteButton);
    }

    if (todo.status === TODO_STATUS.BLOCKED && currentEditingId !== todo.id) {
      const blockedSubtitle = createBlockedSubtitle(todo);
      if (blockedSubtitle) {
        row.appendChild(blockedSubtitle);
      }

      row.appendChild(createBlockerPicker(todo, row));
    }

    row.addEventListener('click', () => {
      if (remainingMs !== null && remainingMs > 0) {
        onClearHighlight(todo.id);
      }
      onSelectTask(todo.id);
    });

    row.addEventListener('focusin', () => {
      onSelectTask(todo.id);
    });

    return row;
  }

  function update({ todos, visibleTodos, selectedTaskId, editingId }) {
    currentTodos = todos;
    currentVisibleTodos = visibleTodos;
    currentSelectedTaskId = selectedTaskId;
    currentEditingId = editingId;

    container.innerHTML = '';
    currentVisibleTodos.forEach((todo) => {
      container.appendChild(createTodoRow(todo));
    });

    syncSelection(selectedTaskId);

    if (currentEditingId) {
      const input = container.querySelector(`li[data-id="${currentEditingId}"] .edit-input`);
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }
  }

  return {
    destroy() {
      window.clearTimeout(flashTimeoutId);
      container.innerHTML = '';
    },
    focusList,
    focusTask,
    scrollTaskIntoView,
    syncSelection,
    syncUnblockedHighlights,
    update
  };
}
