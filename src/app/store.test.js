import { describe, expect, it } from 'vitest';
import { APP_STORAGE_KEYS, TODO_STATUS } from './constants.js';
import { createAppStore } from './store.js';

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function createState(overrides = {}) {
  return {
    todos: [],
    selectedTaskId: null,
    filterActive: false,
    dagExpanded: false,
    dagToggleTouched: false,
    editingId: null,
    isMobileViewport: false,
    welcomeTipDismissed: false,
    shortcutsTipDismissed: false,
    reorderTipDismissed: false,
    ...overrides,
  };
}

describe('createAppStore', () => {
  it('persists todos after addTask', () => {
    const storage = createStorage();
    const store = createAppStore({ storage, initialState: createState() });

    const event = store.addTask({ text: 'Ship store' });

    expect(event.changed).toBe(true);
    expect(store.getState().todos).toHaveLength(1);
    expect(JSON.parse(storage.data.get(APP_STORAGE_KEYS.TODOS))).toMatchObject([
      { text: 'Ship store', status: TODO_STATUS.TODO },
    ]);
  });

  it('reports blocked completion attempts without mutating state', () => {
    const initialState = createState({
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
    const store = createAppStore({ storage: createStorage(), initialState });

    const event = store.setTaskStatus({
      id: 'b',
      nextStatus: TODO_STATUS.DONE,
    });

    expect(event.changed).toBe(false);
    expect(event.meta).toMatchObject({
      blockedCompletionAttempt: true,
      activeBlockerCount: 1,
    });
    expect(store.getState()).toEqual(initialState);
  });

  it('cancels blocked tasks with active blockers and releases their dependents', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        todos: [
          { id: 'a', text: 'Upstream blocker', status: TODO_STATUS.TODO },
          {
            id: 'b',
            text: 'Blocked task',
            status: TODO_STATUS.BLOCKED,
            blockedBy: ['a'],
          },
          {
            id: 'c',
            text: 'Dependent task',
            status: TODO_STATUS.BLOCKED,
            blockedBy: ['b'],
          },
        ],
      }),
    });

    const event = store.setTaskStatus({
      id: 'b',
      nextStatus: TODO_STATUS.CANCELLED,
    });

    expect(event.changed).toBe(true);
    expect(event.meta.blockedCompletionAttempt).toBeFalsy();
    expect(event.meta).toMatchObject({
      completedTaskId: null,
      unblockedIds: ['c'],
    });
    expect(store.getState().todos).toEqual([
      { id: 'a', text: 'Upstream blocker', status: TODO_STATUS.TODO },
      { id: 'b', text: 'Blocked task', status: TODO_STATUS.CANCELLED },
      { id: 'c', text: 'Dependent task', status: TODO_STATUS.TODO },
    ]);
  });

  it('keeps selection in sync when toggling a selected task out of the filtered view', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        filterActive: true,
        selectedTaskId: 'a',
        todos: [
          { id: 'a', text: 'Todo A', status: TODO_STATUS.IN_PROGRESS },
          { id: 'b', text: 'Todo B', status: TODO_STATUS.TODO },
        ],
      }),
    });

    const event = store.toggleSelectedTaskStatus();

    expect(event.meta).toMatchObject({
      focusSelection: true,
      scrollSelection: true,
    });
    expect(store.getState().selectedTaskId).toBe('b');
    expect(store.getState().todos[0].status).toBe(TODO_STATUS.DONE);
  });

  it('persists ready filter changes through the action layer', () => {
    const storage = createStorage();
    const store = createAppStore({ storage, initialState: createState() });

    store.toggleReadyFilter();

    expect(storage.data.get(APP_STORAGE_KEYS.READY_FILTER)).toBe('true');
  });

  it('unblocks dependent tasks when an in-progress blocker is completed', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        todos: [
          { id: 'a', text: 'Working blocker', status: TODO_STATUS.IN_PROGRESS },
          {
            id: 'b',
            text: 'Blocked task',
            status: TODO_STATUS.BLOCKED,
            blockedBy: ['a'],
          },
        ],
      }),
    });

    const event = store.setTaskStatus({
      id: 'a',
      nextStatus: TODO_STATUS.DONE,
    });

    expect(event.changed).toBe(true);
    expect(event.meta).toMatchObject({
      completedTaskId: 'a',
      unblockedIds: ['b'],
    });
    expect(store.getState().todos).toEqual([
      { id: 'a', text: 'Working blocker', status: TODO_STATUS.DONE },
      { id: 'b', text: 'Blocked task', status: TODO_STATUS.TODO },
    ]);
  });

  it('loads tip dismissal preferences into store state', () => {
    const store = createAppStore({
      storage: createStorage({
        [APP_STORAGE_KEYS.WELCOME_TIP_DISMISSED]: 'true',
        [APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED]: 'true',
        [APP_STORAGE_KEYS.REORDER_TIP_DISMISSED]: 'true',
      }),
    });

    expect(store.getState()).toMatchObject({
      welcomeTipDismissed: true,
      shortcutsTipDismissed: true,
      reorderTipDismissed: true,
    });
  });

  it('persists tip dismissal changes through the action layer', () => {
    const storage = createStorage();
    const store = createAppStore({ storage, initialState: createState() });

    store.dismissWelcomeTip();
    store.dismissShortcutsTip();
    store.dismissReorderTip();

    expect(storage.data.get(APP_STORAGE_KEYS.WELCOME_TIP_DISMISSED)).toBe('true');
    expect(storage.data.get(APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED)).toBe(
      'true',
    );
    expect(storage.data.get(APP_STORAGE_KEYS.REORDER_TIP_DISMISSED)).toBe(
      'true',
    );
  });

  it('treats the welcome hint as one-shot once a task already exists', () => {
    const storage = createStorage({
      [APP_STORAGE_KEYS.TODOS]: JSON.stringify([
        { id: 'task-1', text: 'Existing task', status: TODO_STATUS.TODO },
      ]),
    });

    const store = createAppStore({ storage });

    expect(store.getState().welcomeTipDismissed).toBe(true);
    expect(storage.data.get(APP_STORAGE_KEYS.WELCOME_TIP_DISMISSED)).toBe('true');
  });

});
