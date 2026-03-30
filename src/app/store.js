import { APP_STORAGE_KEYS, EDITABLE_TODO_STATUSES, TODO_STATUS } from './constants.js';
import {
  addTodo,
  cleanupBlockedBy,
  clearFinished,
  cycleStatus,
  deleteTodo,
  detectUnblockedTodos,
  finalizeBlockedStatus,
  hasDependencies,
  loadBurndownData,
  loadTodos,
  saveBurndownData,
  saveTodos,
  setStatus,
  shouldSampleToday,
  takeBurndownSample,
  toggleBlocker,
  updateTodoText
} from '../todo/model.js';
import {
  selectBlockedStatusChange,
  selectDagViewModel,
  selectSelectionState,
  selectToggleStatusTarget,
  selectVisibleTodos
} from './selectors.js';

const EDITABLE_STATUS_SET = new Set(EDITABLE_TODO_STATUSES);

const defaultStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key)
};

function loadBooleanPreference(storageKey, storage = defaultStorage) {
  try {
    return storage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

function loadReadyFilterPreference(storage = defaultStorage) {
  try {
    const storedPreference = storage.getItem(APP_STORAGE_KEYS.READY_FILTER);
    if (storedPreference !== null) {
      return storedPreference === 'true';
    }

    const legacyPreference = storage.getItem(APP_STORAGE_KEYS.LEGACY_ACTIONABLE_FILTER);
    if (legacyPreference !== null) {
      try {
        storage.setItem(APP_STORAGE_KEYS.READY_FILTER, legacyPreference);
        storage.removeItem?.(APP_STORAGE_KEYS.LEGACY_ACTIONABLE_FILTER);
      } catch {
        // Ignore storage migration failures so the UI stays usable.
      }
    }

    return legacyPreference === 'true';
  } catch {
    return false;
  }
}

function saveBooleanPreference(storageKey, value, storage = defaultStorage) {
  try {
    storage.setItem(storageKey, String(value));
  } catch {
    // Ignore storage write failures so the UI stays usable.
  }
}

function createActionResult(state, meta = {}) {
  return { state, meta };
}

function normalizeActionResult(result, fallbackState) {
  if (!result || typeof result !== 'object' || !('state' in result)) {
    return createActionResult(result ?? fallbackState);
  }

  return {
    state: result.state ?? fallbackState,
    meta: result.meta ?? {}
  };
}

function reconcileSelection(state) {
  const { selectedTaskId } = selectSelectionState(state);
  if (selectedTaskId === state.selectedTaskId) {
    return state;
  }

  return { ...state, selectedTaskId };
}

function buildInitialState({ storage = defaultStorage, isMobileViewport = false } = {}) {
  return {
    todos: loadTodos(storage),
    burndownData: loadBurndownData(storage),
    selectedTaskId: null,
    filterActive: loadReadyFilterPreference(storage),
    burndownExpanded: false,
    dagExpanded: !isMobileViewport,
    dagToggleTouched: false,
    editingId: null,
    isMobileViewport,
    shortcutsTipDismissed: loadBooleanPreference(APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED, storage),
    reorderTipDismissed: loadBooleanPreference(APP_STORAGE_KEYS.REORDER_TIP_DISMISSED, storage)
  };
}

export function createAppStore(options = {}) {
  const storage = options.storage ?? defaultStorage;
  const listeners = new Set();
  let state = options.initialState ?? buildInitialState({
    storage,
    isMobileViewport: options.isMobileViewport ?? false
  });

  const postActionEffects = [
    {
      shouldRun: (previousState, nextState) => previousState.todos !== nextState.todos,
      run: (_previousState, nextState) => saveTodos(nextState.todos, storage, APP_STORAGE_KEYS.TODOS)
    },
    {
      shouldRun: (previousState, nextState) => previousState.burndownData !== nextState.burndownData,
      run: (_previousState, nextState) => saveBurndownData(nextState.burndownData, storage, APP_STORAGE_KEYS.BURNDOWN)
    },
    {
      shouldRun: (previousState, nextState) => previousState.filterActive !== nextState.filterActive,
      run: (_previousState, nextState) => saveBooleanPreference(APP_STORAGE_KEYS.READY_FILTER, nextState.filterActive, storage)
    },
    {
      shouldRun: (previousState, nextState) => previousState.shortcutsTipDismissed !== nextState.shortcutsTipDismissed,
      run: (_previousState, nextState) => saveBooleanPreference(
        APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED,
        nextState.shortcutsTipDismissed,
        storage
      )
    },
    {
      shouldRun: (previousState, nextState) => previousState.reorderTipDismissed !== nextState.reorderTipDismissed,
      run: (_previousState, nextState) => saveBooleanPreference(
        APP_STORAGE_KEYS.REORDER_TIP_DISMISSED,
        nextState.reorderTipDismissed,
        storage
      )
    }
  ];

  function runPostActionEffects(previousState, nextState) {
    postActionEffects.forEach((effect) => {
      if (effect.shouldRun(previousState, nextState)) {
        effect.run(previousState, nextState);
      }
    });
  }

  const actionHandlers = {
    addTask(currentState, payload = {}) {
      const nextTodos = addTodo(currentState.todos, payload.text ?? '');
      if (nextTodos === currentState.todos) {
        return currentState;
      }

      return reconcileSelection({
        ...currentState,
        todos: nextTodos,
        editingId: null
      });
    },
    clearFinished(currentState) {
      const nextTodos = clearFinished(currentState.todos);
      if (nextTodos === currentState.todos) {
        return currentState;
      }

      return createActionResult(
        reconcileSelection({ ...currentState, todos: nextTodos }),
        { unblockedIds: detectUnblockedTodos(currentState.todos, nextTodos) }
      );
    },
    clearSelection(currentState) {
      if (currentState.selectedTaskId === null) {
        return currentState;
      }

      return { ...currentState, selectedTaskId: null };
    },
    deleteTask(currentState, payload = {}) {
      if (!payload.id || !currentState.todos.some((todo) => todo.id === payload.id)) {
        return currentState;
      }

      const visibleTodos = selectVisibleTodos(currentState);
      const currentIndex = visibleTodos.findIndex((todo) => todo.id === payload.id);
      const fallbackId = currentIndex === -1
        ? null
        : visibleTodos[currentIndex + 1]?.id ?? visibleTodos[currentIndex - 1]?.id ?? null;
      const deletingSelectedTask = currentState.selectedTaskId === payload.id;
      const nextTodos = deleteTodo(currentState.todos, payload.id);
      let nextState = { ...currentState, todos: nextTodos };

      if (deletingSelectedTask) {
        nextState = { ...nextState, selectedTaskId: fallbackId };
      }

      nextState = reconcileSelection(nextState);
      return createActionResult(nextState, {
        unblockedIds: detectUnblockedTodos(currentState.todos, nextTodos),
        focusSelection: deletingSelectedTask && nextState.selectedTaskId !== null,
        focusList: deletingSelectedTask && nextState.selectedTaskId === null,
        scrollSelection: deletingSelectedTask && nextState.selectedTaskId !== null
      });
    },
    dismissReorderTip(currentState) {
      if (currentState.reorderTipDismissed) {
        return currentState;
      }

      return { ...currentState, reorderTipDismissed: true };
    },
    dismissShortcutsTip(currentState) {
      if (currentState.shortcutsTipDismissed) {
        return currentState;
      }

      return { ...currentState, shortcutsTipDismissed: true };
    },
    ensureBurndownSample(currentState) {
      if (!shouldSampleToday(currentState.burndownData)) {
        return currentState;
      }

      return {
        ...currentState,
        burndownData: [...currentState.burndownData, takeBurndownSample(currentState.todos)]
      };
    },
    enterEditMode(currentState, payload = {}) {
      const todo = currentState.todos.find((item) => item.id === payload.id);
      if (!todo || !EDITABLE_STATUS_SET.has(todo.status) || currentState.editingId === payload.id) {
        return currentState;
      }

      return { ...currentState, editingId: payload.id };
    },
    finalizeBlockedStatus(currentState, payload = {}) {
      const nextTodos = finalizeBlockedStatus(currentState.todos, payload.todoId);
      if (nextTodos === currentState.todos) {
        return currentState;
      }

      return reconcileSelection({ ...currentState, todos: nextTodos });
    },
    moveSelection(currentState, payload = {}) {
      const visibleTodos = selectVisibleTodos(currentState);
      if (visibleTodos.length === 0) {
        return currentState;
      }

      const step = payload.step ?? 0;
      const currentIndex = visibleTodos.findIndex((todo) => todo.id === currentState.selectedTaskId);
      const nextIndex = currentIndex === -1
        ? (step > 0 ? 0 : visibleTodos.length - 1)
        : Math.max(0, Math.min(visibleTodos.length - 1, currentIndex + step));
      const nextTodo = visibleTodos[nextIndex];
      if (!nextTodo || nextTodo.id === currentState.selectedTaskId) {
        return currentState;
      }

      return createActionResult(
        { ...currentState, selectedTaskId: nextTodo.id },
        { focusSelection: true, scrollSelection: true }
      );
    },
    reorderTasks(currentState, payload = {}) {
      const nextTodos = Array.isArray(payload.todos) ? payload.todos : currentState.todos;
      if (nextTodos === currentState.todos) {
        return currentState;
      }

      return reconcileSelection({ ...currentState, todos: nextTodos });
    },
    saveEditedTask(currentState, payload = {}) {
      if (!currentState.editingId) {
        return currentState;
      }

      const nextTodos = updateTodoText(currentState.todos, currentState.editingId, payload.text ?? '');
      if (nextTodos === currentState.todos) {
        return currentState;
      }

      return reconcileSelection({
        ...currentState,
        todos: nextTodos,
        editingId: null
      });
    },
    cancelEdit(currentState) {
      if (currentState.editingId === null) {
        return currentState;
      }

      return { ...currentState, editingId: null };
    },
    selectTask(currentState, payload = {}) {
      if (!payload.id || !currentState.todos.some((todo) => todo.id === payload.id)) {
        return currentState;
      }

      if (currentState.selectedTaskId === payload.id) {
        return currentState;
      }

      return { ...currentState, selectedTaskId: payload.id };
    },
    setTaskStatus(currentState, payload = {}) {
      const { todo, blockedCompletionAttempt, activeBlockerCount } = selectBlockedStatusChange(
        currentState,
        payload.id,
        payload.nextStatus
      );
      if (!todo) {
        return currentState;
      }

      if (blockedCompletionAttempt) {
        return createActionResult(currentState, {
          blockedCompletionAttempt: true,
          activeBlockerCount,
          returnFocusEl: payload.returnFocusEl ?? null,
          todoId: todo.id
        });
      }

      let nextTodos = setStatus(currentState.todos, todo.id, payload.nextStatus);
      const completedTaskId = payload.nextStatus === TODO_STATUS.DONE ? todo.id : null;
      const unblockedIds = [];

      if (payload.nextStatus === TODO_STATUS.DONE || payload.nextStatus === TODO_STATUS.CANCELLED) {
        nextTodos = cleanupBlockedBy(nextTodos, todo.id);
        unblockedIds.push(...detectUnblockedTodos(currentState.todos, nextTodos));
      }

      return createActionResult(
        reconcileSelection({ ...currentState, todos: nextTodos }),
        {
          completedTaskId,
          unblockedIds,
          returnFocusEl: payload.returnFocusEl ?? null
        }
      );
    },
    setViewport(currentState, payload = {}) {
      const nextValue = Boolean(payload.isMobileViewport);
      if (currentState.isMobileViewport === nextValue) {
        return currentState;
      }

      return { ...currentState, isMobileViewport: nextValue };
    },
    toggleBlocker(currentState, payload = {}) {
      const nextTodos = toggleBlocker(currentState.todos, payload.todoId, payload.blockerId);
      if (nextTodos === currentState.todos) {
        return currentState;
      }

      return reconcileSelection({ ...currentState, todos: nextTodos });
    },
    toggleBurndownExpanded(currentState) {
      return { ...currentState, burndownExpanded: !currentState.burndownExpanded };
    },
    toggleDagExpanded(currentState) {
      if (!hasDependencies(currentState.todos)) {
        return currentState;
      }

      const dagState = selectDagViewModel(currentState);
      return {
        ...currentState,
        dagExpanded: !dagState.expanded,
        dagToggleTouched: true
      };
    },
    toggleReadyFilter(currentState) {
      return reconcileSelection({
        ...currentState,
        filterActive: !currentState.filterActive
      });
    },
    toggleSelectedTaskStatus(currentState) {
      const target = selectToggleStatusTarget(currentState);
      if (!target) {
        return currentState;
      }

      let nextTodos = cycleStatus(currentState.todos, target.todo.id);
      const meta = {
        completedTaskId: target.nextStatus === TODO_STATUS.DONE ? target.todo.id : null,
        unblockedIds: []
      };

      if (target.nextStatus === TODO_STATUS.DONE) {
        nextTodos = cleanupBlockedBy(nextTodos, target.todo.id);
        meta.unblockedIds = detectUnblockedTodos(currentState.todos, nextTodos);
      }

      const nextVisibleTodos = currentState.filterActive
        ? selectVisibleTodos({ ...currentState, todos: nextTodos })
        : nextTodos;
      const currentIndex = target.visibleTodos.findIndex((todo) => todo.id === target.todo.id);
      const stillVisible = nextVisibleTodos.some((todo) => todo.id === target.todo.id);
      const fallbackTodo = currentIndex === -1
        ? null
        : nextVisibleTodos[currentIndex] ?? nextVisibleTodos[currentIndex - 1] ?? null;
      const nextSelectedTaskId = stillVisible ? target.todo.id : (fallbackTodo?.id ?? null);

      return createActionResult(
        { ...currentState, todos: nextTodos, selectedTaskId: nextSelectedTaskId },
        {
          ...meta,
          focusSelection: nextSelectedTaskId !== null,
          focusList: nextSelectedTaskId === null,
          scrollSelection: nextSelectedTaskId !== null
        }
      );
    }
  };

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispatch(actionName, payload) {
    const handler = actionHandlers[actionName];
    if (!handler) {
      throw new Error(`Unknown action: ${actionName}`);
    }

    const previousState = state;
    const { state: nextState, meta } = normalizeActionResult(handler(previousState, payload), previousState);
    const changed = nextState !== previousState;
    state = nextState;

    if (changed) {
      runPostActionEffects(previousState, nextState);
    }

    const event = {
      action: actionName,
      payload,
      previousState,
      state: nextState,
      changed,
      meta
    };

    listeners.forEach((listener) => {
      listener(event);
    });

    return event;
  }

  return Object.assign({
    dispatch,
    getState,
    subscribe
  }, Object.fromEntries(
    Object.keys(actionHandlers).map((actionName) => [actionName, (payload) => dispatch(actionName, payload)])
  ));
}
