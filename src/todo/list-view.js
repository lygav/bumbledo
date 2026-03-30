import {
  BLOCKER_SOURCE_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_OPTIONS,
} from '../app/constants.js';

const BLOCKER_SOURCE_STATUS_SET = new Set(BLOCKER_SOURCE_TODO_STATUSES);
const CYCLE_TOOLTIP_MESSAGE = "Can't add — would create a circular dependency";
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
  onClearHighlight,
}) {
  let currentTodos = [];
  let currentVisibleTodos = [];
  let currentSelectedTaskId = null;
  let currentEditingId = null;
  let flashTimeoutId = null;
  const cycleClearTimeoutIds = new Set();

  function findTaskElement(id) {
    return (
      [...container.querySelectorAll('li[data-id]')].find(
        (item) => item.dataset.id === id,
      ) ?? null
    );
  }

  function findTodo(id) {
    return currentTodos.find((todo) => todo.id === id) ?? null;
  }

  function getTodoIdFromTarget(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    return target.closest('li[data-id]')?.dataset.id ?? null;
  }

  function clearCycleClearTimeouts() {
    cycleClearTimeoutIds.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    cycleClearTimeoutIds.clear();
  }

  function focusList() {
    container.focus();
  }

  function focusTask(id) {
    findTaskElement(id)?.focus();
  }

  function syncSelection(selectedTaskId = currentSelectedTaskId) {
    currentSelectedTaskId = currentVisibleTodos.some(
      (todo) => todo.id === selectedTaskId,
    )
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
        taskElement.style.setProperty(
          '--unblocked-delay',
          `${remainingMs - 3000}ms`,
        );
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
    subtitle.textContent =
      blockerNames.length <= 3
        ? `Blocked by: ${blockerNames.join(', ')}`
        : `Blocked by: ${blockerNames.slice(0, 2).join(', ')} + ${blockerNames.length - 2} more`;
    return subtitle;
  }

  function createBlockerPicker(todo) {
    const picker = document.createElement('div');
    picker.className = 'blocker-picker';

    const pickerTitle = document.createElement('div');
    pickerTitle.className = 'blocker-picker-title';
    pickerTitle.textContent = 'Blocked by:';
    picker.appendChild(pickerTitle);

    const eligibleTodos = currentTodos.filter(
      (item) =>
        item.id !== todo.id && BLOCKER_SOURCE_STATUS_SET.has(item.status),
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

        label.htmlFor = checkboxId;
        checkbox.id = checkboxId;
        checkbox.type = 'checkbox';
        checkbox.dataset.blockerId = item.id;
        checkbox.checked =
          Array.isArray(todo.blockedBy) && todo.blockedBy.includes(item.id);

        const labelText = document.createElement('span');
        labelText.textContent = truncateText(item.text, 40);

        label.append(checkbox, labelText);
        picker.appendChild(label);
      });
    }

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

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`);
    deleteButton.textContent = '×';

    if (currentEditingId === todo.id) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-input';
      input.value = todo.text;
      input.setAttribute('aria-label', `Edit "${todo.text}"`);
      row.append(handle, statusSelect, input, deleteButton);
    } else {
      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;
      row.append(handle, statusSelect, text, deleteButton);
    }

    if (todo.status === TODO_STATUS.BLOCKED && currentEditingId !== todo.id) {
      const blockedSubtitle = createBlockedSubtitle(todo);
      if (blockedSubtitle) {
        row.appendChild(blockedSubtitle);
      }

      row.appendChild(createBlockerPicker(todo));
    }

    return row;
  }

  function handleContainerClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const todoId = getTodoIdFromTarget(event.target);
    if (!todoId) {
      return;
    }

    if (event.target.closest('.blocker-picker')) {
      return;
    }

    if (event.target.closest('.delete-btn')) {
      onDeleteTask(todoId);
      return;
    }

    if (event.target.closest('.edit-input')) {
      return;
    }

    const remainingMs = getHighlightRemainingMs(todoId);
    if (remainingMs !== null && remainingMs > 0) {
      onClearHighlight(todoId);
    }
    onSelectTask(todoId);
  }

  function handleContainerChange(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const todoId = getTodoIdFromTarget(event.target);
    if (!todoId) {
      return;
    }

    if (
      event.target instanceof HTMLSelectElement &&
      event.target.classList.contains('todo-status')
    ) {
      onStatusChange(todoId, event.target.value, {
        returnFocusEl: event.target,
      });
      return;
    }

    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === 'checkbox' &&
      event.target.closest('.blocker-picker')
    ) {
      const blockerId = event.target.dataset.blockerId;
      if (!blockerId) {
        return;
      }

      event.target.setCustomValidity('');
      if (
        event.target.checked &&
        wouldCreateCycle(currentTodos, todoId, blockerId)
      ) {
        event.target.checked = false;
        event.target.setCustomValidity(CYCLE_TOOLTIP_MESSAGE);
        event.target.reportValidity();

        const timeoutId = window.setTimeout(() => {
          cycleClearTimeoutIds.delete(timeoutId);
          event.target.setCustomValidity('');
        }, CYCLE_TOOLTIP_CLEAR_MS);
        cycleClearTimeoutIds.add(timeoutId);
        return;
      }

      onToggleBlocker(todoId, blockerId);
    }
  }

  function handleContainerDblClick(event) {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest('.todo-text')
    ) {
      return;
    }

    const todoId = getTodoIdFromTarget(event.target);
    const todo = todoId ? findTodo(todoId) : null;
    if (todo && canEditTodoStatus(todo.status)) {
      onEnterEditMode(todo.id);
    }
  }

  function handleContainerFocusIn(event) {
    const todoId = getTodoIdFromTarget(event.target);
    if (todoId) {
      onSelectTask(todoId);
    }
  }

  function handleContainerFocusOut(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const row = event.target.closest('li[data-id]');
    const todoId = row?.dataset.id ?? null;
    if (!row || !todoId) {
      return;
    }

    if (
      event.target instanceof HTMLInputElement &&
      event.target.classList.contains('edit-input')
    ) {
      if (currentEditingId === todoId) {
        onSaveEdit(event.target.value);
      }
      return;
    }

    if (
      event.relatedTarget instanceof Node &&
      row.contains(event.relatedTarget)
    ) {
      return;
    }

    if (!row.querySelector('.blocker-picker')) {
      return;
    }

    queueMicrotask(() => {
      const nextRow = findTaskElement(todoId);
      if (nextRow?.contains(document.activeElement)) {
        return;
      }

      const todo = findTodo(todoId);
      if (todo?.status === TODO_STATUS.BLOCKED && currentEditingId !== todoId) {
        onFinalizeBlockedStatus(todoId);
      }
    });
  }

  function handleContainerKeyDown(event) {
    if (
      !(event.target instanceof HTMLInputElement) ||
      !event.target.classList.contains('edit-input')
    ) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onSaveEdit(event.target.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelEdit();
    }
  }

  container.addEventListener('click', handleContainerClick);
  container.addEventListener('change', handleContainerChange);
  container.addEventListener('dblclick', handleContainerDblClick);
  container.addEventListener('focusin', handleContainerFocusIn);
  container.addEventListener('focusout', handleContainerFocusOut);
  container.addEventListener('keydown', handleContainerKeyDown);

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
      const input = container.querySelector(
        `li[data-id="${currentEditingId}"] .edit-input`,
      );
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }
  }

  return {
    destroy() {
      window.clearTimeout(flashTimeoutId);
      clearCycleClearTimeouts();
      container.removeEventListener('click', handleContainerClick);
      container.removeEventListener('change', handleContainerChange);
      container.removeEventListener('dblclick', handleContainerDblClick);
      container.removeEventListener('focusin', handleContainerFocusIn);
      container.removeEventListener('focusout', handleContainerFocusOut);
      container.removeEventListener('keydown', handleContainerKeyDown);
      container.innerHTML = '';
    },
    focusList,
    focusTask,
    scrollTaskIntoView,
    syncSelection,
    syncUnblockedHighlights,
    update,
  };
}
