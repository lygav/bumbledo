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

function createTodo(id, status, overrides = {}) {
  return {
    id,
    text: `Task ${id}`,
    status,
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
      blockedStatusTransitionDenied: true,
      blockedCompletionAttempt: true,
      activeBlockerCount: 1,
    });
    expect(store.getState()).toEqual(initialState);
  });

  it('rejects blocked-task transitions back to todo or in progress while active blockers exist', () => {
    const blockedTransitions = [TODO_STATUS.TODO, TODO_STATUS.IN_PROGRESS];

    for (const nextStatus of blockedTransitions) {
      const initialState = createState({
        todos: [
          createTodo('a', TODO_STATUS.TODO),
          createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a'] }),
        ],
      });
      const store = createAppStore({ storage: createStorage(), initialState });

        const event = store.setTaskStatus({ id: 'b', nextStatus });

        expect(event.changed).toBe(false);
        expect(event.meta).toMatchObject({
          blockedStatusTransitionDenied: true,
          blockedCompletionAttempt: false,
          activeBlockerCount: 1,
        });
        expect(store.getState()).toEqual(initialState);
      }
  });

  it('allows every listed non-blocked transition from the PRD table', () => {
    const cases = [
      [TODO_STATUS.TODO, TODO_STATUS.IN_PROGRESS],
      [TODO_STATUS.TODO, TODO_STATUS.DONE],
      [TODO_STATUS.TODO, TODO_STATUS.CANCELLED],
      [TODO_STATUS.IN_PROGRESS, TODO_STATUS.TODO],
      [TODO_STATUS.IN_PROGRESS, TODO_STATUS.DONE],
      [TODO_STATUS.IN_PROGRESS, TODO_STATUS.CANCELLED],
      [TODO_STATUS.DONE, TODO_STATUS.TODO],
      [TODO_STATUS.DONE, TODO_STATUS.IN_PROGRESS],
      [TODO_STATUS.DONE, TODO_STATUS.CANCELLED],
      [TODO_STATUS.CANCELLED, TODO_STATUS.TODO],
      [TODO_STATUS.CANCELLED, TODO_STATUS.IN_PROGRESS],
      [TODO_STATUS.CANCELLED, TODO_STATUS.DONE],
    ];

    for (const [from, to] of cases) {
      const store = createAppStore({
        storage: createStorage(),
        initialState: createState({
          todos: [createTodo('a', from)],
        }),
      });

      const event = store.setTaskStatus({ id: 'a', nextStatus: to });

      expect(event.changed).toBe(true);
      expect(store.getState().todos).toEqual([createTodo('a', to)]);
    }
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

  it('unblocks dependents when a blocker is deleted', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        todos: [
          createTodo('a', TODO_STATUS.TODO),
          createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a'] }),
        ],
      }),
    });

    const event = store.deleteTask({ id: 'a' });

    expect(event.changed).toBe(true);
    expect(event.meta).toMatchObject({ unblockedIds: ['b'] });
    expect(store.getState().todos).toEqual([createTodo('b', TODO_STATUS.TODO)]);
  });

  it('waits until all blockers resolve before auto-transitioning back to todo', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        todos: [
          createTodo('a', TODO_STATUS.TODO),
          createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a', 'c'] }),
          createTodo('c', TODO_STATUS.IN_PROGRESS),
        ],
      }),
    });

    const completedA = store.setTaskStatus({
      id: 'a',
      nextStatus: TODO_STATUS.DONE,
    });

    expect(completedA.meta).toMatchObject({ unblockedIds: [] });
    expect(store.getState().todos).toEqual([
      createTodo('a', TODO_STATUS.DONE),
      createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['c'] }),
      createTodo('c', TODO_STATUS.IN_PROGRESS),
    ]);

    const cancelledC = store.setTaskStatus({
      id: 'c',
      nextStatus: TODO_STATUS.CANCELLED,
    });

    expect(cancelledC.meta).toMatchObject({ unblockedIds: ['b'] });
    expect(store.getState().todos).toEqual([
      createTodo('a', TODO_STATUS.DONE),
      createTodo('b', TODO_STATUS.TODO),
      createTodo('c', TODO_STATUS.CANCELLED),
    ]);
  });

  it('does not re-block dependents when a completed blocker is reopened', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        todos: [
          createTodo('a', TODO_STATUS.TODO),
          createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a'] }),
        ],
      }),
    });

    store.setTaskStatus({ id: 'a', nextStatus: TODO_STATUS.DONE });
    store.setTaskStatus({ id: 'a', nextStatus: TODO_STATUS.TODO });

    expect(store.getState().todos).toEqual([
      createTodo('a', TODO_STATUS.TODO),
      createTodo('b', TODO_STATUS.TODO),
    ]);
  });

  it('does not re-block dependents when a cancelled blocker is reopened', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        todos: [
          createTodo('a', TODO_STATUS.TODO),
          createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a'] }),
        ],
      }),
    });

    store.setTaskStatus({ id: 'a', nextStatus: TODO_STATUS.CANCELLED });
    store.setTaskStatus({ id: 'a', nextStatus: TODO_STATUS.TODO });

    expect(store.getState().todos).toEqual([
      createTodo('a', TODO_STATUS.TODO),
      createTodo('b', TODO_STATUS.TODO),
    ]);
  });

  it('auto-reverts blocked tasks with no selected blockers back to todo on finalization', () => {
    const storage = createStorage();
    const store = createAppStore({
      storage,
      initialState: createState({
        todos: [createTodo('a', TODO_STATUS.TODO)],
      }),
    });

    store.setTaskStatus({ id: 'a', nextStatus: TODO_STATUS.BLOCKED });
    const event = store.finalizeBlockedStatus({ todoId: 'a' });

    expect(event.changed).toBe(true);
    expect(store.getState().todos).toEqual([createTodo('a', TODO_STATUS.TODO)]);
    expect(store.getState().todos[0]).not.toHaveProperty('blockedBy');
    expect(JSON.parse(storage.data.get(APP_STORAGE_KEYS.TODOS))).toEqual([
      createTodo('a', TODO_STATUS.TODO),
    ]);
  });

  it('auto-reverts blocked tasks to todo when the last blocker is manually removed', () => {
    const storage = createStorage();
    const store = createAppStore({
      storage,
      initialState: createState({
        todos: [
          createTodo('a', TODO_STATUS.TODO),
          createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a'] }),
        ],
      }),
    });

    const event = store.toggleBlocker({ todoId: 'b', blockerId: 'a' });

    expect(event.changed).toBe(true);
    expect(store.getState().todos).toEqual([
      createTodo('a', TODO_STATUS.TODO),
      createTodo('b', TODO_STATUS.TODO),
    ]);
    expect(store.getState().todos[1]).not.toHaveProperty('blockedBy');
    expect(JSON.parse(storage.data.get(APP_STORAGE_KEYS.TODOS))).toEqual([
      createTodo('a', TODO_STATUS.TODO),
      createTodo('b', TODO_STATUS.TODO),
    ]);
  });

  it('treats keyboard cycling on blocked tasks as a no-op', () => {
    const initialState = createState({
      selectedTaskId: 'b',
      todos: [
        createTodo('a', TODO_STATUS.TODO),
        createTodo('b', TODO_STATUS.BLOCKED, { blockedBy: ['a'] }),
      ],
    });
    const store = createAppStore({ storage: createStorage(), initialState });

    const event = store.toggleSelectedTaskStatus();

    expect(event.changed).toBe(false);
    expect(store.getState()).toEqual(initialState);
  });

  it('keeps cancelled tasks outside keyboard cycling', () => {
    const initialState = createState({
      selectedTaskId: 'a',
      todos: [createTodo('a', TODO_STATUS.CANCELLED)],
    });
    const store = createAppStore({ storage: createStorage(), initialState });

    const event = store.toggleSelectedTaskStatus();

    expect(event.changed).toBe(false);
    expect(store.getState()).toEqual(initialState);
  });

  it('cycles selected task statuses through todo, in progress, done, and back to todo', () => {
    const store = createAppStore({
      storage: createStorage(),
      initialState: createState({
        selectedTaskId: 'a',
        todos: [createTodo('a', TODO_STATUS.TODO)],
      }),
    });

    store.toggleSelectedTaskStatus();
    expect(store.getState().todos).toEqual([
      createTodo('a', TODO_STATUS.IN_PROGRESS),
    ]);

    store.toggleSelectedTaskStatus();
    expect(store.getState().todos).toEqual([createTodo('a', TODO_STATUS.DONE)]);

    store.toggleSelectedTaskStatus();
    expect(store.getState().todos).toEqual([createTodo('a', TODO_STATUS.TODO)]);
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
