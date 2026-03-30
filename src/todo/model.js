import {
  ACTIONABLE_TODO_STATUSES,
  APP_STORAGE_KEYS,
  TERMINAL_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_CYCLE,
  TODO_STATUS_VALUES
} from '../app/constants.js';

// OWNERSHIP: model.js owns pure todo logic.
// - Owns: storage helpers, todo mutations, dependency-related status utilities
// - Does NOT own: DOM setup, event listeners, rendering, DAG section visibility

// Storage interface - injectable for testing
const defaultStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
};

const BURNDOWN_RETENTION_DAYS = 30;
const VALID_STATUSES = new Set(TODO_STATUS_VALUES);
const ACTIONABLE_STATUSES = new Set(ACTIONABLE_TODO_STATUSES);
const TERMINAL_STATUSES = new Set(TERMINAL_TODO_STATUSES);

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function getBurndownCutoffDate(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - BURNDOWN_RETENTION_DAYS);
}

function normalizeBurndownEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const parsedDate = parseDateKey(entry.date);
  if (!parsedDate) {
    return null;
  }

  const done = Number.isFinite(entry.done) ? Math.max(0, Math.floor(entry.done)) : 0;
  const cancelled = Number.isFinite(entry.cancelled) ? Math.max(0, Math.floor(entry.cancelled)) : 0;
  const todo = Number.isFinite(entry.todo)
    ? Math.max(0, Math.floor(entry.todo))
    : (Number.isFinite(entry.active) ? Math.max(0, Math.floor(entry.active)) : 0);
  const fallbackTotal = done + cancelled + todo;
  const total = Number.isFinite(entry.total) ? Math.max(0, Math.floor(entry.total)) : fallbackTotal;

  return {
    date: getLocalDateKey(parsedDate),
    done,
    cancelled,
    todo,
    total
  };
}

export function pruneBurndownData(data, now = new Date()) {
  const cutoff = getBurndownCutoffDate(now);
  const seenDates = new Set();
  const normalized = data.map(normalizeBurndownEntry);
  const pruned = [];

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const entry = normalized[index];
    if (!entry || seenDates.has(entry.date)) {
      continue;
    }

    const parsedDate = parseDateKey(entry.date);
    if (!parsedDate || parsedDate < cutoff) {
      continue;
    }

    seenDates.add(entry.date);
    pruned.unshift(entry);
  }

  return pruned;
}

// Pure logic functions - exported for testing

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hasBlockers(todo) {
  return Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0;
}

function normalizeBlockedTodo(todo) {
  if (todo.status !== TODO_STATUS.BLOCKED || hasBlockers(todo)) {
    return todo;
  }

  const { blockedBy, ...rest } = todo;
  return { ...rest, status: TODO_STATUS.TODO };
}

export function migrateTodos(list) {
  return list.map(t => {
    if ('done' in t && !('status' in t)) {
      const { done, ...rest } = t;
      return { ...rest, status: done ? TODO_STATUS.DONE : TODO_STATUS.TODO };
    }
    if (!('status' in t)) {
      return { ...t, status: TODO_STATUS.TODO };
    }
    if (t.status === 'active') {
      return { ...t, status: TODO_STATUS.TODO };
    }
    if (t.status === TODO_STATUS.BLOCKED) {
      const blockedTodo = {
        ...t,
        blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy : []
      };

      return normalizeBlockedTodo(blockedTodo);
    }
    return t;
  });
}

export function loadTodos(storage = defaultStorage, storageKey = APP_STORAGE_KEYS.TODOS) {
  try {
    const data = storage.getItem(storageKey);
    const parsed = data ? JSON.parse(data) : [];
    const migrated = migrateTodos(parsed);

    if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
      saveTodos(migrated, storage, storageKey);
    }

    return migrated;
  } catch {
    return [];
  }
}

export function saveTodos(todosToSave, storage = defaultStorage, storageKey = APP_STORAGE_KEYS.TODOS) {
  const clean = todosToSave.map(t => {
    const normalized = normalizeBlockedTodo(t);
    const obj = { id: normalized.id, text: normalized.text, status: normalized.status };

    if (normalized.status === TODO_STATUS.BLOCKED && hasBlockers(normalized)) {
      obj.blockedBy = normalized.blockedBy;
    }

    return obj;
  });
  storage.setItem(storageKey, JSON.stringify(clean));
}

export function takeBurndownSample(todos, now = new Date()) {
  const done = todos.filter(todo => todo.status === TODO_STATUS.DONE).length;
  const cancelled = todos.filter(todo => todo.status === TODO_STATUS.CANCELLED).length;
  const todo = todos.filter(todo => ACTIONABLE_STATUSES.has(todo.status)).length;
  const blocked = todos.filter(todo => todo.status === TODO_STATUS.BLOCKED).length;

  return {
    date: getLocalDateKey(now),
    done,
    cancelled,
    todo,
    total: done + cancelled + todo + blocked
  };
}

export function loadBurndownData(storage = defaultStorage, storageKey = APP_STORAGE_KEYS.BURNDOWN) {
  try {
    const data = storage.getItem(storageKey);
    const parsed = data ? JSON.parse(data) : [];
    return pruneBurndownData(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

export function saveBurndownData(data, storage = defaultStorage, storageKey = APP_STORAGE_KEYS.BURNDOWN, now = new Date()) {
  const clean = pruneBurndownData(Array.isArray(data) ? data : [], now);
  storage.setItem(storageKey, JSON.stringify(clean));
  return clean;
}

export function shouldSampleToday(data, now = new Date()) {
  const today = getLocalDateKey(now);
  return !pruneBurndownData(Array.isArray(data) ? data : [], now).some(entry => entry.date === today);
}

export function addTodo(todos, text) {
  const trimmed = text.trim();
  if (!trimmed) return todos;
  return [...todos, { id: generateId(), text: trimmed, status: TODO_STATUS.TODO }];
}

export function setStatus(todos, id, newStatus) {
  if (!VALID_STATUSES.has(newStatus)) {
    return todos;
  }

  return todos.map(todo => {
    if (todo.id !== id) return todo;

    const updated = { ...todo, status: newStatus };

    if (newStatus === TODO_STATUS.BLOCKED) {
      if (!Array.isArray(updated.blockedBy)) updated.blockedBy = [];
    } else {
      delete updated.blockedBy;
    }

    return updated;
  });
}

export function cycleStatus(todos, id) {
  return todos.map(todo => {
    if (todo.id !== id) return todo;

    if (todo.status === TODO_STATUS.TODO || todo.status === TODO_STATUS.IN_PROGRESS) {
      return { ...todo, status: TODO_STATUS_CYCLE[todo.status] };
    }

    if (TERMINAL_STATUSES.has(todo.status)) {
      return { ...todo, status: TODO_STATUS_CYCLE[todo.status] ?? TODO_STATUS.TODO };
    }

    if (todo.status === TODO_STATUS.BLOCKED && Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0) {
      return todo;
    }

    if (todo.status === TODO_STATUS.BLOCKED) {
      const { blockedBy, ...rest } = todo;
      return { ...rest, status: TODO_STATUS.TODO };
    }

    return todo;
  });
}

export function getNextTodoId(todos, currentId) {
  if (todos.length === 0) return null;

  const currentIndex = todos.findIndex(todo => todo.id === currentId);
  if (currentIndex === -1) return todos[0].id;

  return todos[(currentIndex + 1) % todos.length].id;
}

export function getPrevTodoId(todos, currentId) {
  if (todos.length === 0) return null;

  const currentIndex = todos.findIndex(todo => todo.id === currentId);
  if (currentIndex === -1) return todos[0].id;

  return todos[(currentIndex - 1 + todos.length) % todos.length].id;
}

export function reorderTodos(todos, draggedId, targetId, insertAfter = false) {
  if (todos.length < 2 || draggedId === targetId) {
    return todos;
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

export function toggleBlocker(todos, todoId, blockerId) {
  return todos.map(todo => {
    if (todo.id !== todoId || todo.status !== TODO_STATUS.BLOCKED) return todo;

    const blockedBy = Array.isArray(todo.blockedBy) ? [...todo.blockedBy] : [];
    const idx = blockedBy.indexOf(blockerId);

    if (idx >= 0) {
      blockedBy.splice(idx, 1);
      if (blockedBy.length === 0) {
        return { ...todo, status: TODO_STATUS.TODO, blockedBy: undefined };
      }
      return { ...todo, blockedBy };
    }

    return { ...todo, blockedBy: [...blockedBy, blockerId] };
  });
}

export function wouldCreateCycle(todos, taskId, blockerId) {
  if (taskId === blockerId) {
    return true;
  }

  const todosById = new Map(todos.map(todo => [todo.id, todo]));
  const queue = [blockerId];
  const visited = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === taskId) {
      return true;
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    const currentTodo = todosById.get(currentId);
    if (!Array.isArray(currentTodo?.blockedBy) || currentTodo.blockedBy.length === 0) {
      continue;
    }

    currentTodo.blockedBy.forEach((nextId) => {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    });
  }

  return false;
}

export function cleanupBlockedBy(todos, removedId) {
  return todos.map(t => {
    if (t.status !== TODO_STATUS.BLOCKED) return t;

    if (!Array.isArray(t.blockedBy)) {
      return normalizeBlockedTodo(t);
    }

    const filteredBlockers = t.blockedBy.filter(id => id !== removedId);

    if (filteredBlockers.length === 0) {
      const { blockedBy, ...rest } = t;
      return { ...rest, status: TODO_STATUS.TODO };
    }

    return { ...t, blockedBy: filteredBlockers };
  });
}

export function detectUnblockedTodos(todosBefore, todosAfter) {
  const beforeById = new Map(todosBefore.map(todo => [todo.id, todo]));

  return todosAfter
    .filter(todo => beforeById.get(todo.id)?.status === TODO_STATUS.BLOCKED && todo.status === TODO_STATUS.TODO)
    .map(todo => todo.id);
}

export function deleteTodo(todos, id) {
  const filtered = todos.filter(t => t.id !== id);
  return cleanupBlockedBy(filtered, id);
}

export function clearFinished(todos) {
  const removedIds = todos.filter(t => TERMINAL_STATUSES.has(t.status)).map(t => t.id);
  let filtered = todos.filter(t => !TERMINAL_STATUSES.has(t.status));
  removedIds.forEach(id => {
    filtered = cleanupBlockedBy(filtered, id);
  });
  return filtered;
}

export function hasActiveBlockers(todos, todoId) {
  const todo = todos.find(item => item.id === todoId);
  const blockerIds = Array.isArray(todo?.blockedBy)
    ? todo.blockedBy.filter(blockerId => blockerId !== todoId)
    : [];

  if (!todo || blockerIds.length === 0) {
    return false;
  }

  const todosById = new Map(todos.map(item => [item.id, item]));

  function keepsTodoBlocked(blockerId, visiting = new Set()) {
    if (blockerId === todoId) {
      return false;
    }

    if (visiting.has(blockerId)) {
      return true;
    }

    const blocker = todosById.get(blockerId);
    if (!blocker) {
      return false;
    }

    if (ACTIONABLE_STATUSES.has(blocker.status)) {
      return true;
    }

    if (blocker.status !== TODO_STATUS.BLOCKED) {
      return false;
    }

    const nestedBlockers = Array.isArray(blocker.blockedBy)
      ? blocker.blockedBy.filter(nestedBlockerId => nestedBlockerId !== blockerId)
      : [];

    if (nestedBlockers.length === 0) {
      return false;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(blockerId);

    return nestedBlockers.some(nestedBlockerId => keepsTodoBlocked(nestedBlockerId, nextVisiting));
  }

  return blockerIds.some(blockerId => keepsTodoBlocked(blockerId));
}

export function getActiveBlockerCount(todos, todoId) {
  const todo = todos.find(item => item.id === todoId);
  const blockerIds = Array.isArray(todo?.blockedBy)
    ? todo.blockedBy.filter(blockerId => blockerId !== todoId)
    : [];

  if (!todo || blockerIds.length === 0) {
    return 0;
  }

  const todosById = new Map(todos.map(item => [item.id, item]));

  return blockerIds.reduce((count, blockerId) => {
    const blocker = todosById.get(blockerId);
    if (!blocker) {
      return count;
    }

    if (ACTIONABLE_STATUSES.has(blocker.status) || blocker.status === TODO_STATUS.BLOCKED) {
      return count + 1;
    }

    return count;
  }, 0);
}

export function hasDependencies(todos) {
  return todos.some(todo => Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0);
}

export function finalizeBlockedStatus(todos, id) {
  let changed = false;

  const updatedTodos = todos.map(todo => {
    if (todo.id !== id) return todo;

    const normalized = normalizeBlockedTodo(todo);
    if (normalized !== todo) {
      changed = true;
    }

    return normalized;
  });

  return changed ? updatedTodos : todos;
}

export function getActionableCount(todos) {
  return {
    actionable: todos.filter(todo => ACTIONABLE_STATUSES.has(todo.status)).length,
    total: todos.length
  };
}

export function getActionableTodos(todos) {
  return todos.filter(todo => ACTIONABLE_STATUSES.has(todo.status));
}

export function updateTodoText(todos, id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return todos;

  return todos.map(todo => {
    if (todo.id !== id) return todo;
    return { ...todo, text: trimmed };
  });
}
