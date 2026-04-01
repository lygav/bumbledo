import {
  TERMINAL_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_META,
  TODO_STATUS_CYCLE,
  TOGGLEABLE_TODO_STATUSES,
} from './constants.js';
import { buildDependencyGraph } from '../dag/graph.js';
import {
  getManualStatusTransitionGuard,
  getActionableTodos,
} from '../todo/model.js';

const TERMINAL_STATUS_SET = new Set(TERMINAL_TODO_STATUSES);
const TOGGLEABLE_STATUS_SET = new Set(TOGGLEABLE_TODO_STATUSES);

export function selectProgress(state) {
  const total = state.todos.length;
  const todo = state.todos.filter(
    (item) => item.status === TODO_STATUS.TODO,
  ).length;
  const inProgress = state.todos.filter(
    (item) => item.status === TODO_STATUS.IN_PROGRESS,
  ).length;
  const blocked = state.todos.filter(
    (item) => item.status === TODO_STATUS.BLOCKED,
  ).length;
  const done = state.todos.filter(
    (item) =>
      item.status === TODO_STATUS.DONE || item.status === TODO_STATUS.CANCELLED,
  ).length;
  const actionable = todo + inProgress;
  const completionPercent = total > 0 ? (done / total) * 100 : 0;
  const blockedPercent = total > 0 ? (blocked / total) * 100 : 0;

  return {
    total,
    todo,
    inProgress,
    actionable,
    blocked,
    done,
    completionPercent,
    completionPercentRounded: Math.round(completionPercent),
    blockedPercent,
  };
}

export function selectVisibleTodos(state) {
  return state.filterActive ? getActionableTodos(state.todos) : state.todos;
}

export function selectSelectedTodo(state) {
  return state.todos.find((todo) => todo.id === state.selectedTaskId) ?? null;
}

export function selectVisibleSelectedTaskId(
  state,
  visibleTodos = selectVisibleTodos(state),
) {
  return visibleTodos.some((todo) => todo.id === state.selectedTaskId)
    ? state.selectedTaskId
    : null;
}

export function selectSelectionState(state) {
  const visibleTodos = selectVisibleTodos(state);
  return {
    visibleTodos,
    selectedTaskId: selectVisibleSelectedTaskId(state, visibleTodos),
  };
}

export function selectShowReadyEmptyState(
  state,
  progress = selectProgress(state),
) {
  return state.filterActive && progress.total > 0 && progress.actionable === 0;
}

export function selectHasFinishedTodos(state) {
  return state.todos.some((todo) => TERMINAL_STATUS_SET.has(todo.status));
}

export function selectDagViewModel(state) {
  const { hasDependencies, stats } = buildDependencyGraph(state.todos);
  const expanded = !hasDependencies
    ? false
    : state.dagToggleTouched
      ? state.dagExpanded
      : !state.isMobileViewport;

  return {
    hasDependencies,
    stats,
    expanded,
  };
}

export function selectBlockedStatusChange(state, todoId, nextStatus) {
  const transitionGuard = getManualStatusTransitionGuard(
    state.todos,
    todoId,
    nextStatus,
  );
  const blockedCompletionAttempt =
    transitionGuard.isDenied && nextStatus === TODO_STATUS.DONE;

  return {
    todo: transitionGuard.todo,
    blockedStatusTransitionDenied: transitionGuard.isDenied,
    blockedCompletionAttempt,
    activeBlockerCount: transitionGuard.isDenied
      ? transitionGuard.activeBlockerCount
      : 0,
  };
}

export function selectDependentCount(state, taskId) {
  return state.todos.reduce((count, todo) => {
    if (!Array.isArray(todo.blockedBy) || !todo.blockedBy.includes(taskId)) {
      return count;
    }

    return count + 1;
  }, 0);
}

export function selectToggleStatusTarget(state) {
  const todo = selectSelectedTodo(state);
  if (!todo || !TOGGLEABLE_STATUS_SET.has(todo.status)) {
    return null;
  }

  return {
    todo,
    nextStatus: TODO_STATUS_CYCLE[todo.status],
    visibleTodos: selectVisibleTodos(state),
  };
}

export function getStatusValueLabel(status) {
  return TODO_STATUS_META[status]?.label ?? status;
}
