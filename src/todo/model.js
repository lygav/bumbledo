// OWNERSHIP: model.js owns pure todo logic.
// - Owns: storage helpers, todo mutations, dependency-related status utilities
// - Does NOT own: DOM setup, event listeners, rendering, DAG section visibility

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

export function hasDependencies(todos) {
  return todos.some(todo => Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0);
}

export function getActionableCount(todos) {
  return {
    actionable: todos.filter(todo => todo.status === 'active').length,
    total: todos.length
  };
}

export function getActionableTodos(todos) {
  return todos.filter(todo => todo.status === 'active');
}

export function updateTodoText(todos, id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return todos;

  return todos.map(todo => {
    if (todo.id !== id) return todo;
    return { ...todo, text: trimmed };
  });
}
