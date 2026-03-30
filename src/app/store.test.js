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
    burndownData: [],
    selectedTaskId: null,
    filterActive: false,
    burndownExpanded: false,
    dagExpanded: false,
    dagToggleTouched: false,
    editingId: null,
    isMobileViewport: false,
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

  it('loads tip dismissal preferences into store state', () => {
    const store = createAppStore({
      storage: createStorage({
        [APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED]: 'true',
        [APP_STORAGE_KEYS.REORDER_TIP_DISMISSED]: 'true',
      }),
    });

    expect(store.getState()).toMatchObject({
      shortcutsTipDismissed: true,
      reorderTipDismissed: true,
    });
  });

  it('persists tip dismissal changes through the action layer', () => {
    const storage = createStorage();
    const store = createAppStore({ storage, initialState: createState() });

    store.dismissShortcutsTip();
    store.dismissReorderTip();

    expect(storage.data.get(APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED)).toBe(
      'true',
    );
    expect(storage.data.get(APP_STORAGE_KEYS.REORDER_TIP_DISMISSED)).toBe(
      'true',
    );
  });

  it('samples burndown data through a named action', () => {
    const storage = createStorage();
    const store = createAppStore({
      storage,
      initialState: createState({
        todos: [{ id: 'a', text: 'Todo', status: TODO_STATUS.TODO }],
      }),
    });

    const event = store.ensureBurndownSample();

    expect(event.changed).toBe(true);
    expect(store.getState().burndownData).toHaveLength(1);
    expect(store.getState().burndownData[0]).toMatchObject({
      todo: 1,
      total: 1,
    });
    expect(
      JSON.parse(storage.data.get(APP_STORAGE_KEYS.BURNDOWN)),
    ).toHaveLength(1);
  });
});
