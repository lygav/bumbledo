// OWNERSHIP: model.js owns pure todo logic.
// - Owns: storage helpers, todo mutations, dependency-related status utilities
// - Does NOT own: DOM setup, event listeners, rendering, DAG section visibility

// Storage interface - injectable for testing
const defaultStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
};

const BURNDOWN_STORAGE_KEY = 'todos_burndown';
const BURNDOWN_RETENTION_DAYS = 30;

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
  const active = Number.isFinite(entry.active) ? Math.max(0, Math.floor(entry.active)) : 0;
  const fallbackTotal = done + cancelled + active;
  const total = Number.isFinite(entry.total) ? Math.max(0, Math.floor(entry.total)) : fallbackTotal;

  return {
    date: getLocalDateKey(parsedDate),
    done,
    cancelled,
    active,
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
  if (todo.status !== 'blocked' || hasBlockers(todo)) {
    return todo;
  }

  const { blockedBy, ...rest } = todo;
  return { ...rest, status: 'active' };
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
    if (t.status === 'blocked') {
      const blockedTodo = {
        ...t,
        blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy : []
      };

      return normalizeBlockedTodo(blockedTodo);
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
    const normalized = normalizeBlockedTodo(t);
    const obj = { id: normalized.id, text: normalized.text, status: normalized.status };

    if (normalized.status === 'blocked' && hasBlockers(normalized)) {
      obj.blockedBy = normalized.blockedBy;
    }

    return obj;
  });
  storage.setItem(storageKey, JSON.stringify(clean));
}

export function takeBurndownSample(todos, now = new Date()) {
  const done = todos.filter(todo => todo.status === 'done').length;
  const cancelled = todos.filter(todo => todo.status === 'cancelled').length;
  const active = todos.filter(todo => todo.status === 'active' || todo.status === 'blocked').length;

  return {
    date: getLocalDateKey(now),
    done,
    cancelled,
    active,
    total: done + cancelled + active
  };
}

export function loadBurndownData(storage = defaultStorage, storageKey = BURNDOWN_STORAGE_KEY) {
  try {
    const data = storage.getItem(storageKey);
    const parsed = data ? JSON.parse(data) : [];
    return pruneBurndownData(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

export function saveBurndownData(data, storage = defaultStorage, storageKey = BURNDOWN_STORAGE_KEY, now = new Date()) {
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

export function cycleStatus(todos, id) {
  return todos.map(todo => {
    if (todo.id !== id) return todo;

    if (todo.status === 'active') {
      return { ...todo, status: 'done' };
    }

    if (todo.status === 'done' || todo.status === 'cancelled') {
      return { ...todo, status: 'active' };
    }

    if (todo.status === 'blocked' && Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0) {
      return todo;
    }

    if (todo.status === 'blocked') {
      const { blockedBy, ...rest } = todo;
      return { ...rest, status: 'active' };
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
    if (t.status !== 'blocked') return t;

    if (!Array.isArray(t.blockedBy)) {
      return normalizeBlockedTodo(t);
    }

    const filteredBlockers = t.blockedBy.filter(id => id !== removedId);

    if (filteredBlockers.length === 0) {
      const { blockedBy, ...rest } = t;
      return { ...rest, status: 'active' };
    }

    return { ...t, blockedBy: filteredBlockers };
  });
}

export function detectUnblockedTodos(todosBefore, todosAfter) {
  const beforeById = new Map(todosBefore.map(todo => [todo.id, todo]));

  return todosAfter
    .filter(todo => beforeById.get(todo.id)?.status === 'blocked' && todo.status === 'active')
    .map(todo => todo.id);
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

    if (blocker.status === 'active') {
      return true;
    }

    if (blocker.status !== 'blocked') {
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
    actionable: todos.filter(todo => todo.status === 'active' || (todo.status === 'blocked' && !hasBlockers(todo))).length,
    total: todos.length
  };
}

export function getActionableTodos(todos) {
  return todos.filter(todo => todo.status === 'active' || (todo.status === 'blocked' && !hasBlockers(todo)));
}

export function updateTodoText(todos, id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return todos;

  return todos.map(todo => {
    if (todo.id !== id) return todo;
    return { ...todo, text: trimmed };
  });
}
