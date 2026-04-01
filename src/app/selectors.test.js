import { describe, expect, it } from 'vitest';
import { TODO_STATUS } from './constants.js';
import {
  selectBlockedStatusChange,
  selectDagViewModel,
  selectProgress,
  selectShowReadyEmptyState,
  selectToggleStatusTarget,
  selectVisibleTodos,
} from './selectors.js';

function createState(overrides = {}) {
  return {
    todos: [],
    selectedTaskId: null,
    filterActive: false,
    dagExpanded: false,
    dagToggleTouched: false,
    editingId: null,
    isMobileViewport: false,
    ...overrides,
  };
}

describe('selectors', () => {
  it('calculates progress totals from todo state', () => {
    const state = createState({
      todos: [
        { id: 'a', text: 'Todo', status: TODO_STATUS.TODO },
        { id: 'b', text: 'Doing', status: TODO_STATUS.IN_PROGRESS },
        { id: 'c', text: 'Done', status: TODO_STATUS.DONE },
        {
          id: 'd',
          text: 'Blocked',
          status: TODO_STATUS.BLOCKED,
          blockedBy: ['a'],
        },
      ],
    });

    expect(selectProgress(state)).toMatchObject({
      total: 4,
      todo: 1,
      inProgress: 1,
      actionable: 2,
      blocked: 1,
      done: 1,
      completionPercentRounded: 25,
    });
  });

  it('returns actionable todos when ready filter is active', () => {
    const todos = [
      { id: 'a', text: 'Todo', status: TODO_STATUS.TODO },
      { id: 'b', text: 'Done', status: TODO_STATUS.DONE },
    ];

    expect(
      selectVisibleTodos(createState({ todos, filterActive: true })),
    ).toEqual([todos[0]]);
  });

  it('flags ready empty state when all work is finished or blocked', () => {
    const state = createState({
      filterActive: true,
      todos: [
        { id: 'a', text: 'Done', status: TODO_STATUS.DONE },
        {
          id: 'b',
          text: 'Blocked',
          status: TODO_STATUS.BLOCKED,
          blockedBy: ['c'],
        },
      ],
    });

    expect(selectShowReadyEmptyState(state)).toBe(true);
  });

  it('derives dag expansion from dependency state and viewport until user toggles it', () => {
    const state = createState({
      todos: [
        { id: 'a', text: 'Todo', status: TODO_STATUS.TODO },
        {
          id: 'b',
          text: 'Blocked',
          status: TODO_STATUS.BLOCKED,
          blockedBy: ['a'],
        },
      ],
      dagExpanded: false,
      dagToggleTouched: false,
      isMobileViewport: false,
    });

    expect(selectDagViewModel(state)).toMatchObject({
      hasDependencies: true,
      expanded: true,
    });
    expect(
      selectDagViewModel({
        ...state,
        dagToggleTouched: true,
        dagExpanded: false,
      }),
    ).toMatchObject({ expanded: false });
  });

  it('surfaces blocked completion attempts for blocked tasks with active blockers', () => {
    const state = createState({
      todos: [
        { id: 'a', text: 'Todo', status: TODO_STATUS.TODO },
        {
          id: 'b',
          text: 'Blocked',
          status: TODO_STATUS.BLOCKED,
          blockedBy: ['a'],
        },
      ],
    });

    expect(
      selectBlockedStatusChange(state, 'b', TODO_STATUS.DONE),
    ).toMatchObject({
      blockedCompletionAttempt: true,
      activeBlockerCount: 1,
    });
  });

  it('allows blocked tasks with active blockers to be cancelled', () => {
    const state = createState({
      todos: [
        { id: 'a', text: 'Todo', status: TODO_STATUS.TODO },
        {
          id: 'b',
          text: 'Blocked',
          status: TODO_STATUS.BLOCKED,
          blockedBy: ['a'],
        },
      ],
    });

    expect(
      selectBlockedStatusChange(state, 'b', TODO_STATUS.CANCELLED),
    ).toMatchObject({
      blockedCompletionAttempt: false,
      activeBlockerCount: 0,
    });
  });

  it('returns selected toggle target details when selection is actionable', () => {
    const state = createState({
      selectedTaskId: 'a',
      todos: [{ id: 'a', text: 'Todo', status: TODO_STATUS.TODO }],
    });

    expect(selectToggleStatusTarget(state)).toMatchObject({
      nextStatus: TODO_STATUS.IN_PROGRESS,
    });
  });
});
