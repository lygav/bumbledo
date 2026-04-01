import {
  ACTIONABLE_TODO_STATUSES,
  APP_STORAGE_KEYS,
  TOGGLEABLE_TODO_STATUSES,
  TERMINAL_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_CYCLE,
  TODO_STATUS_VALUES,
} from '../app/constants.js';

// OWNERSHIP: model.js owns pure todo logic.
// - Owns: storage helpers, todo mutations, dependency-related status utilities
// - Does NOT own: DOM setup, event listeners, rendering, DAG section visibility

// Storage interface - injectable for testing
const defaultStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

const VALID_STATUSES = new Set(TODO_STATUS_VALUES);
const ACTIONABLE_STATUSES = new Set(ACTIONABLE_TODO_STATUSES);
const TOGGLEABLE_STATUSES = new Set(TOGGLEABLE_TODO_STATUSES);
const TERMINAL_STATUSES = new Set(TERMINAL_TODO_STATUSES);
// PRD §4.1: while a task is structurally blocked by active blockers,
// manual status changes are limited to blocked → cancelled.
const STRICT_BLOCKED_MANUAL_STATUSES = new Set([TODO_STATUS.CANCELLED]);

// Pure logic functions - exported for testing

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hasBlockers(todo) {
  return Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0;
}

function stripBlockedBy(todo) {
  const nextTodo = { ...todo };
  delete nextTodo.blockedBy;
  return nextTodo;
}

function normalizeBlockedTodo(todo) {
  if (todo.status !== TODO_STATUS.BLOCKED || hasBlockers(todo)) {
    return todo;
  }

  return { ...stripBlockedBy(todo), status: TODO_STATUS.TODO };
}

export function migrateTodos(list) {
  return list.map((t) => {
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
        blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy : [],
      };

      return normalizeBlockedTodo(blockedTodo);
    }
    return t;
  });
}

export function loadTodos(
  storage = defaultStorage,
  storageKey = APP_STORAGE_KEYS.TODOS,
) {
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

export function saveTodos(
  todosToSave,
  storage = defaultStorage,
  storageKey = APP_STORAGE_KEYS.TODOS,
) {
  const clean = todosToSave.map((t) => {
    const normalized = normalizeBlockedTodo(t);
    const obj = {
      id: normalized.id,
      text: normalized.text,
      status: normalized.status,
    };

    if (normalized.status === TODO_STATUS.BLOCKED && hasBlockers(normalized)) {
      obj.blockedBy = normalized.blockedBy;
    }

    return obj;
  });
  storage.setItem(storageKey, JSON.stringify(clean));
}

export function addTodo(todos, text) {
  const trimmed = text.trim();
  if (!trimmed) return todos;
  return [
    ...todos,
    { id: generateId(), text: trimmed, status: TODO_STATUS.TODO },
  ];
}

export function setStatus(todos, id, newStatus) {
  if (!VALID_STATUSES.has(newStatus)) {
    return todos;
  }

  const transitionGuard = getManualStatusTransitionGuard(todos, id, newStatus);
  if (transitionGuard.isDenied) {
    return todos;
  }

  return todos.map((todo) => {
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
  return todos.map((todo) => {
    if (todo.id !== id) return todo;

    if (TOGGLEABLE_STATUSES.has(todo.status)) {
      return { ...todo, status: TODO_STATUS_CYCLE[todo.status] };
    }

    return todo;
  });
}

export function getNextTodoId(todos, currentId) {
  if (todos.length === 0) return null;

  const currentIndex = todos.findIndex((todo) => todo.id === currentId);
  if (currentIndex === -1) return todos[0].id;

  return todos[(currentIndex + 1) % todos.length].id;
}

export function getPrevTodoId(todos, currentId) {
  if (todos.length === 0) return null;

  const currentIndex = todos.findIndex((todo) => todo.id === currentId);
  if (currentIndex === -1) return todos[0].id;

  return todos[(currentIndex - 1 + todos.length) % todos.length].id;
}

export function reorderTodos(todos, draggedId, targetId, insertAfter = false) {
  if (todos.length < 2 || draggedId === targetId) {
    return todos;
  }

  const reorderedTodos = [...todos];
  const fromIndex = reorderedTodos.findIndex((todo) => todo.id === draggedId);
  if (fromIndex === -1) return todos;

  const [movedTodo] = reorderedTodos.splice(fromIndex, 1);
  let toIndex = reorderedTodos.findIndex((todo) => todo.id === targetId);

  if (!movedTodo || toIndex === -1) return todos;
  if (insertAfter) toIndex += 1;

  reorderedTodos.splice(toIndex, 0, movedTodo);
  return reorderedTodos;
}

export function toggleBlocker(todos, todoId, blockerId) {
  return todos.map((todo) => {
    if (todo.id !== todoId || todo.status !== TODO_STATUS.BLOCKED) return todo;

    const blockedBy = Array.isArray(todo.blockedBy) ? [...todo.blockedBy] : [];
    const idx = blockedBy.indexOf(blockerId);

    if (idx >= 0) {
      blockedBy.splice(idx, 1);
      if (blockedBy.length === 0) {
        return { ...stripBlockedBy(todo), status: TODO_STATUS.TODO };
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

  const todosById = new Map(todos.map((todo) => [todo.id, todo]));
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
    if (
      !Array.isArray(currentTodo?.blockedBy) ||
      currentTodo.blockedBy.length === 0
    ) {
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
  return todos.map((t) => {
    if (t.status !== TODO_STATUS.BLOCKED) return t;

    if (!Array.isArray(t.blockedBy)) {
      return normalizeBlockedTodo(t);
    }

    const filteredBlockers = t.blockedBy.filter((id) => id !== removedId);

    if (filteredBlockers.length === 0) {
      return { ...stripBlockedBy(t), status: TODO_STATUS.TODO };
    }

    return { ...t, blockedBy: filteredBlockers };
  });
}

export function detectUnblockedTodos(todosBefore, todosAfter) {
  const beforeById = new Map(todosBefore.map((todo) => [todo.id, todo]));

  return todosAfter
    .filter(
      (todo) =>
        beforeById.get(todo.id)?.status === TODO_STATUS.BLOCKED &&
        todo.status === TODO_STATUS.TODO,
    )
    .map((todo) => todo.id);
}

export function deleteTodo(todos, id) {
  const filtered = todos.filter((t) => t.id !== id);
  return cleanupBlockedBy(filtered, id);
}

export function clearFinished(todos) {
  const removedIds = todos
    .filter((t) => TERMINAL_STATUSES.has(t.status))
    .map((t) => t.id);
  let filtered = todos.filter((t) => !TERMINAL_STATUSES.has(t.status));
  removedIds.forEach((id) => {
    filtered = cleanupBlockedBy(filtered, id);
  });
  return filtered;
}

export function hasActiveBlockers(todos, todoId) {
  const todo = todos.find((item) => item.id === todoId);
  const blockerIds = Array.isArray(todo?.blockedBy)
    ? todo.blockedBy.filter((blockerId) => blockerId !== todoId)
    : [];

  if (!todo || blockerIds.length === 0) {
    return false;
  }

  const todosById = new Map(todos.map((item) => [item.id, item]));

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
      ? blocker.blockedBy.filter(
          (nestedBlockerId) => nestedBlockerId !== blockerId,
        )
      : [];

    if (nestedBlockers.length === 0) {
      return false;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(blockerId);

    return nestedBlockers.some((nestedBlockerId) =>
      keepsTodoBlocked(nestedBlockerId, nextVisiting),
    );
  }

  return blockerIds.some((blockerId) => keepsTodoBlocked(blockerId));
}

export function getActiveBlockerCount(todos, todoId) {
  const todo = todos.find((item) => item.id === todoId);
  const blockerIds = Array.isArray(todo?.blockedBy)
    ? todo.blockedBy.filter((blockerId) => blockerId !== todoId)
    : [];

  if (!todo || blockerIds.length === 0) {
    return 0;
  }

  const todosById = new Map(todos.map((item) => [item.id, item]));

  return blockerIds.reduce((count, blockerId) => {
    const blocker = todosById.get(blockerId);
    if (!blocker) {
      return count;
    }

    if (
      ACTIONABLE_STATUSES.has(blocker.status) ||
      blocker.status === TODO_STATUS.BLOCKED
    ) {
      return count + 1;
    }

    return count;
  }, 0);
}

export function getManualStatusTransitionGuard(todos, todoId, nextStatus) {
  const todo = todos.find((item) => item.id === todoId) ?? null;
  const hasStrictBlockedRule =
    todo?.status === TODO_STATUS.BLOCKED && hasActiveBlockers(todos, todoId);
  const isAllowed =
    !hasStrictBlockedRule || STRICT_BLOCKED_MANUAL_STATUSES.has(nextStatus);

  return {
    todo,
    hasStrictBlockedRule,
    isAllowed,
    isDenied: Boolean(todo && hasStrictBlockedRule && !isAllowed),
    activeBlockerCount:
      hasStrictBlockedRule && todo
        ? getActiveBlockerCount(todos, todoId)
        : 0,
  };
}

export function hasDependencies(todos) {
  return todos.some(
    (todo) => Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0,
  );
}

export function finalizeBlockedStatus(todos, id) {
  let changed = false;

  const updatedTodos = todos.map((todo) => {
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
    actionable: todos.filter((todo) => ACTIONABLE_STATUSES.has(todo.status))
      .length,
    total: todos.length,
  };
}

export function getActionableTodos(todos) {
  return todos.filter((todo) => ACTIONABLE_STATUSES.has(todo.status));
}

export function updateTodoText(todos, id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return todos;

  return todos.map((todo) => {
    if (todo.id !== id) return todo;
    return { ...todo, text: trimmed };
  });
}
