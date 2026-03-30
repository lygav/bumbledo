import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as model from './model.js';
import {
  generateId,
  migrateTodos,
  loadTodos,
  loadBurndownData,
  saveTodos,
  saveBurndownData,
  addTodo,
  setStatus,
  reorderTodos,
  toggleBlocker,
  wouldCreateCycle,
  cleanupBlockedBy,
  deleteTodo,
  clearFinished,
  finalizeBlockedStatus,
  getActionableCount,
  getActionableTodos,
  getActiveBlockerCount,
  hasActiveBlockers,
  updateTodoText,
} from './model.js';

describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('returns unique values on consecutive calls', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('returns non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('migrateTodos', () => {
  it('migrates old done:true format to status:done', () => {
    const old = [{ id: '1', text: 'task', done: true }];
    const result = migrateTodos(old);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'done' });
    expect(result[0]).not.toHaveProperty('done');
  });

  it('migrates old done:false to status:todo', () => {
    const old = [{ id: '1', text: 'task', done: false }];
    const result = migrateTodos(old);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'todo' });
  });

  it('adds status:todo when no status field', () => {
    const todos = [{ id: '1', text: 'task' }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'todo' });
  });

  it('reverts blocked items without blockers back to todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked' }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'todo' });
  });

  it('passes through already-correct items unchanged', () => {
    const todos = [{ id: '1', text: 'task', status: 'done' }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'done' });
  });

  it('handles empty array', () => {
    const result = migrateTodos([]);
    expect(result).toEqual([]);
  });

  it('preserves blockedBy on blocked items that already have it', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({
      id: '1',
      text: 'task',
      status: 'blocked',
      blockedBy: ['2'],
    });
  });

  it('migrates legacy active status values to todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'todo' });
  });
});

describe('loadTodos', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
  });

  it('loads and parses from storage', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    mockStorage.getItem.mockReturnValue(JSON.stringify(todos));

    const result = loadTodos(mockStorage, 'testKey');
    expect(result).toEqual(todos);
    expect(mockStorage.getItem).toHaveBeenCalledWith('testKey');
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns empty array on null storage', () => {
    mockStorage.getItem.mockReturnValue(null);
    const result = loadTodos(mockStorage);
    expect(result).toEqual([]);
  });

  it('returns empty array on invalid JSON', () => {
    mockStorage.getItem.mockReturnValue('not valid json{[');
    const result = loadTodos(mockStorage);
    expect(result).toEqual([]);
  });

  it('applies migration to loaded data', () => {
    const old = [{ id: '1', text: 'task', done: true }];
    mockStorage.getItem.mockReturnValue(JSON.stringify(old));

    const result = loadTodos(mockStorage);
    expect(result[0].status).toBe('done');
    expect(result[0]).not.toHaveProperty('done');
  });

  it('migrates legacy active status values to todo and saves them back', () => {
    const old = [{ id: '1', text: 'task', status: 'active' }];
    mockStorage.getItem.mockReturnValue(JSON.stringify(old));

    const result = loadTodos(mockStorage);

    expect(result).toEqual([{ id: '1', text: 'task', status: 'todo' }]);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'todos',
      JSON.stringify(result),
    );
  });

  it('uses default storage key when not provided', () => {
    mockStorage.getItem.mockReturnValue('[]');
    loadTodos(mockStorage);
    expect(mockStorage.getItem).toHaveBeenCalledWith('todos');
  });
});

describe('saveTodos', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
  });

  it('saves serialized todos to storage', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    saveTodos(todos, mockStorage, 'testKey');

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'testKey',
      JSON.stringify(todos),
    );
  });

  it('strips blockedBy from non-blocked items', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo', blockedBy: ['2'] }];
    saveTodos(todos, mockStorage);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved[0]).not.toHaveProperty('blockedBy');
  });

  it('preserves blockedBy for blocked items', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] },
    ];
    saveTodos(todos, mockStorage);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved[0].blockedBy).toEqual(['2', '3']);
  });

  it('strips blockedBy from blocked items with empty array', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: [] }];
    saveTodos(todos, mockStorage);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved[0]).not.toHaveProperty('blockedBy');
  });

  it('saves blocked items without blockers as todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: [] }];
    saveTodos(todos, mockStorage);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved[0]).toEqual({ id: '1', text: 'task', status: 'todo' });
  });

  it('only saves id, text, status, and blockedBy fields', () => {
    const todos = [
      { id: '1', text: 'task', status: 'done', extraField: 'ignored' },
    ];
    saveTodos(todos, mockStorage);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved[0]).toEqual({ id: '1', text: 'task', status: 'done' });
  });
});

describe('burndown helpers', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
  });

  describe('loadBurndownData', () => {
    it('loads burndown samples from storage', () => {
      mockStorage.getItem.mockReturnValue(
        JSON.stringify([
          { date: '2026-03-29', done: 2, cancelled: 1, todo: 3, total: 6 },
        ]),
      );

      expect(loadBurndownData(mockStorage)).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 1, todo: 3, total: 6 },
      ]);
      expect(mockStorage.getItem).toHaveBeenCalledWith('todos_burndown');
    });

    it('returns empty array for invalid burndown JSON', () => {
      mockStorage.getItem.mockReturnValue('{not valid');
      expect(loadBurndownData(mockStorage)).toEqual([]);
    });

    it('drops invalid samples and keeps valid stored totals', () => {
      mockStorage.getItem.mockReturnValue(
        JSON.stringify([
          { date: 'bad-date', done: 2, cancelled: 0, todo: 1, total: 3 },
          { date: '2026-03-29', done: 2, cancelled: 1, todo: 3, total: 1 },
        ]),
      );

      expect(loadBurndownData(mockStorage)).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 1, todo: 3, total: 1 },
      ]);
    });

    it('migrates legacy active burndown counts to todo', () => {
      mockStorage.getItem.mockReturnValue(
        JSON.stringify([
          { date: '2026-03-29', done: 2, cancelled: 1, active: 3, total: 6 },
        ]),
      );

      expect(loadBurndownData(mockStorage)).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 1, todo: 3, total: 6 },
      ]);
    });
  });

  describe('saveBurndownData', () => {
    it('saves pruned burndown samples', () => {
      const samples = [
        { date: '2026-02-26', done: 1, cancelled: 0, todo: 1, total: 2 },
        { date: '2026-03-01', done: 2, cancelled: 0, todo: 1, total: 3 },
        { date: '2026-03-29', done: 3, cancelled: 1, todo: 1, total: 5 },
      ];

      const result = saveBurndownData(
        samples,
        mockStorage,
        'todos_burndown',
        new Date(2026, 2, 29, 8, 0),
      );

      expect(result).toEqual([
        { date: '2026-03-01', done: 2, cancelled: 0, todo: 1, total: 3 },
        { date: '2026-03-29', done: 3, cancelled: 1, todo: 1, total: 5 },
      ]);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'todos_burndown',
        JSON.stringify(result),
      );
    });

    it('keeps only the latest sample for a duplicate date', () => {
      const result = saveBurndownData(
        [
          { date: '2026-03-29', done: 1, cancelled: 0, todo: 2, total: 3 },
          { date: '2026-03-29', done: 2, cancelled: 0, todo: 2, total: 4 },
        ],
        mockStorage,
        'todos_burndown',
        new Date(2026, 2, 29, 8, 0),
      );

      expect(result).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 0, todo: 2, total: 4 },
      ]);
    });
  });
});

describe('addTodo', () => {
  it('adds todo with correct structure', () => {
    const result = addTodo([], 'New task');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'New task',
      status: 'todo',
    });
    expect(result[0].id).toBeDefined();
  });

  it('trims whitespace from text', () => {
    const result = addTodo([], '  task with spaces  ');
    expect(result[0].text).toBe('task with spaces');
  });

  it('returns unchanged array for empty text', () => {
    const todos = [{ id: '1', text: 'existing', status: 'todo' }];
    const result = addTodo(todos, '');
    expect(result).toEqual(todos);
  });

  it('returns unchanged array for whitespace-only text', () => {
    const todos = [{ id: '1', text: 'existing', status: 'todo' }];
    const result = addTodo(todos, '   \n\t  ');
    expect(result).toEqual(todos);
  });

  it('returns a NEW array (immutability)', () => {
    const todos = [];
    const result = addTodo(todos, 'task');
    expect(result).not.toBe(todos);
  });

  it('preserves existing todos', () => {
    const todos = [{ id: '1', text: 'existing', status: 'done' }];
    const result = addTodo(todos, 'new');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(todos[0]);
  });
});

describe('setStatus', () => {
  it('changes status to done', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, '1', 'done');
    expect(result[0].status).toBe('done');
  });

  it('changes status to cancelled', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, '1', 'cancelled');
    expect(result[0].status).toBe('cancelled');
  });

  it('changes status to inprogress', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, '1', 'inprogress');
    expect(result[0].status).toBe('inprogress');
  });

  it('changes status to blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, '1', 'blocked');
    expect(result[0].status).toBe('blocked');
  });

  it('adds empty blockedBy array when setting to blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, '1', 'blocked');
    expect(result[0].blockedBy).toEqual([]);
  });

  it('removes blockedBy when changing from blocked to todo', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = setStatus(todos, '1', 'todo');
    expect(result[0]).not.toHaveProperty('blockedBy');
    expect(result[0].status).toBe('todo');
  });

  it('removes blockedBy when changing from blocked to done', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = setStatus(todos, '1', 'done');
    expect(result[0]).not.toHaveProperty('blockedBy');
  });

  it('returns NEW array (immutability)', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, '1', 'done');
    expect(result).not.toBe(todos);
  });

  it('leaves other todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = setStatus(todos, '1', 'done');
    expect(result[1]).toEqual(todos[1]);
  });

  it('does nothing when todo id not found', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = setStatus(todos, 'nonexistent', 'done');
    expect(result).toEqual(todos);
  });

  it('preserves existing blockedBy when setting to blocked', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = setStatus(todos, '1', 'blocked');
    expect(result[0].blockedBy).toEqual(['2']);
  });
});

describe('hasActiveBlockers', () => {
  it('returns true when a blocker is still todo', () => {
    const todos = [
      { id: '1', text: 'blocked task', status: 'blocked', blockedBy: ['2'] },
      { id: '2', text: 'upstream task', status: 'todo' },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(true);
  });

  it('returns true when a blocker is itself blocked', () => {
    const todos = [
      { id: '1', text: 'blocked task', status: 'blocked', blockedBy: ['2'] },
      { id: '2', text: 'upstream task', status: 'blocked', blockedBy: ['3'] },
      { id: '3', text: 'another task', status: 'todo' },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(true);
  });

  it('returns true when a blocker is already in progress', () => {
    const todos = [
      { id: '1', text: 'blocked task', status: 'blocked', blockedBy: ['2'] },
      { id: '2', text: 'upstream task', status: 'inprogress' },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(true);
  });

  it('returns false when the only blocker is the todo itself', () => {
    const todos = [
      { id: '1', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(false);
  });

  it('returns false when blockers only loop back to the current todo', () => {
    const todos = [
      { id: '1', text: 'blocked task', status: 'blocked', blockedBy: ['2'] },
      { id: '2', text: 'upstream task', status: 'blocked', blockedBy: ['1'] },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(false);
  });

  it('returns false when blockers are already finished', () => {
    const todos = [
      {
        id: '1',
        text: 'blocked task',
        status: 'blocked',
        blockedBy: ['2', '3'],
      },
      { id: '2', text: 'done task', status: 'done' },
      { id: '3', text: 'cancelled task', status: 'cancelled' },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(false);
  });

  it('returns false when blockers were deleted or missing', () => {
    const todos = [
      { id: '1', text: 'blocked task', status: 'blocked', blockedBy: ['2'] },
    ];

    expect(hasActiveBlockers(todos, '1')).toBe(false);
  });
});

describe('getActiveBlockerCount', () => {
  it('counts todo and blocked direct blockers', () => {
    const todos = [
      {
        id: '1',
        text: 'blocked task',
        status: 'blocked',
        blockedBy: ['2', '3', '4', '6'],
      },
      { id: '2', text: 'todo blocker', status: 'todo' },
      { id: '3', text: 'blocked blocker', status: 'blocked', blockedBy: ['5'] },
      { id: '4', text: 'done blocker', status: 'done' },
      { id: '5', text: 'nested blocker', status: 'todo' },
      { id: '6', text: 'working blocker', status: 'inprogress' },
    ];

    expect(getActiveBlockerCount(todos, '1')).toBe(3);
  });

  it('ignores self references, missing blockers, and finished blockers', () => {
    const todos = [
      {
        id: '1',
        text: 'blocked task',
        status: 'blocked',
        blockedBy: ['1', '2', '3'],
      },
      { id: '2', text: 'done blocker', status: 'done' },
      { id: '3', text: 'cancelled blocker', status: 'cancelled' },
    ];

    expect(getActiveBlockerCount(todos, '1')).toBe(0);
  });
});

describe('cycleStatus', () => {
  it('cycles todo todos to inprogress', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('inprogress');
  });

  it('cycles inprogress todos to done', () => {
    const todos = [{ id: '1', text: 'task', status: 'inprogress' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('done');
  });

  it('cycles done todos back to todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'done' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('todo');
  });

  it('cycles cancelled todos back to todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'cancelled' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('todo');
  });

  it('does not cycle blocked todos with blockers', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = model.cycleStatus(todos, '1');
    expect(result[0]).toEqual({
      id: '1',
      text: 'task',
      status: 'blocked',
      blockedBy: ['2'],
    });
  });
});

describe('getNextTodoId', () => {
  it('returns the next todo id for a middle item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = model.getNextTodoId(todos, '2');
    expect(result).toBe('3');
  });

  it('wraps to the first todo id from the last item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = model.getNextTodoId(todos, '3');
    expect(result).toBe('1');
  });

  it('returns the same todo id for a single-item list', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = model.getNextTodoId(todos, '1');
    expect(result).toBe('1');
  });

  it('returns the first todo id when current id is not found', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = model.getNextTodoId(todos, 'missing');
    expect(result).toBe('1');
  });

  it('returns null for an empty list', () => {
    const result = model.getNextTodoId([], '1');
    expect(result).toBeNull();
  });
});

describe('getPrevTodoId', () => {
  it('returns the previous todo id for a middle item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = model.getPrevTodoId(todos, '2');
    expect(result).toBe('1');
  });

  it('wraps to the last todo id from the first item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = model.getPrevTodoId(todos, '1');
    expect(result).toBe('3');
  });

  it('returns the same todo id for a single-item list', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = model.getPrevTodoId(todos, '1');
    expect(result).toBe('1');
  });

  it('returns the first todo id when current id is not found', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = model.getPrevTodoId(todos, 'missing');
    expect(result).toBe('1');
  });

  it('returns null for an empty list', () => {
    const result = model.getPrevTodoId([], '1');
    expect(result).toBeNull();
  });
});

describe('reorderTodos', () => {
  const makeTodos = () => [
    { id: 'a', text: 'first', status: 'todo' },
    { id: 'b', text: 'second', status: 'todo' },
    { id: 'c', text: 'third', status: 'todo' },
    { id: 'd', text: 'fourth', status: 'todo' },
  ];

  it('moves an item from position 0 to position 2', () => {
    const result = reorderTodos(makeTodos(), 'a', 'c', false);
    expect(result.map((todo) => todo.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('moves an item from position 2 to position 0', () => {
    const result = reorderTodos(makeTodos(), 'c', 'a', false);
    expect(result.map((todo) => todo.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('returns the original array when moving to the same position', () => {
    const todos = makeTodos();
    const result = reorderTodos(todos, 'b', 'b', false);

    expect(result).toBe(todos);
    expect(result.map((todo) => todo.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns the original array for a single-item list', () => {
    const todos = [{ id: 'a', text: 'only', status: 'todo' }];
    const result = reorderTodos(todos, 'a', 'a', true);

    expect(result).toBe(todos);
    expect(result).toEqual(todos);
  });

  it('moves an item to the end of the list', () => {
    const result = reorderTodos(makeTodos(), 'b', 'd', true);
    expect(result.map((todo) => todo.id)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('moves an item to the beginning of the list', () => {
    const result = reorderTodos(makeTodos(), 'd', 'a', false);
    expect(result.map((todo) => todo.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('returns the original array when the dragged id is not found', () => {
    const todos = makeTodos();
    const result = reorderTodos(todos, 'missing', 'b', false);

    expect(result).toBe(todos);
    expect(result).toEqual(todos);
  });
});

describe('toggleBlocker', () => {
  it('adds a blocker to blockedBy', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: [] }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].blockedBy).toEqual(['2']);
  });

  it('removes an existing blocker', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] },
    ];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].blockedBy).toEqual(['3']);
  });

  it('reverts to todo when last blocker is removed', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].status).toBe('todo');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('does nothing if todo is not blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0]).toEqual(todos[0]);
  });

  it('returns NEW array', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = toggleBlocker(todos, '1', '3');
    expect(result).not.toBe(todos);
  });

  it('handles todo with no blockedBy array initially', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked' }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].blockedBy).toEqual(['2']);
  });

  it('leaves other todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked', blockedBy: [] },
      { id: '2', text: 'task2', status: 'todo' },
    ];
    const result = toggleBlocker(todos, '1', '3');
    expect(result[1]).toEqual(todos[1]);
  });
});

describe('wouldCreateCycle', () => {
  it('returns true for a direct cycle', () => {
    const todos = [
      { id: 'a', text: 'Task A', status: 'blocked', blockedBy: ['b'] },
      { id: 'b', text: 'Task B', status: 'blocked', blockedBy: [] },
    ];

    expect(wouldCreateCycle(todos, 'b', 'a')).toBe(true);
  });

  it('returns true for an indirect cycle', () => {
    const todos = [
      { id: 'a', text: 'Task A', status: 'blocked', blockedBy: ['b'] },
      { id: 'b', text: 'Task B', status: 'blocked', blockedBy: ['c'] },
      { id: 'c', text: 'Task C', status: 'blocked', blockedBy: [] },
    ];

    expect(wouldCreateCycle(todos, 'c', 'a')).toBe(true);
  });

  it('returns false when the tasks are unrelated', () => {
    const todos = [
      { id: 'a', text: 'Task A', status: 'blocked', blockedBy: ['b'] },
      { id: 'b', text: 'Task B', status: 'blocked', blockedBy: [] },
      { id: 'c', text: 'Task C', status: 'blocked', blockedBy: [] },
    ];

    expect(wouldCreateCycle(todos, 'c', 'a')).toBe(false);
  });

  it('returns true for a self-reference', () => {
    const todos = [
      { id: 'a', text: 'Task A', status: 'blocked', blockedBy: [] },
    ];

    expect(wouldCreateCycle(todos, 'a', 'a')).toBe(true);
  });

  it('returns false when the blocker has no blockers', () => {
    const todos = [
      { id: 'a', text: 'Task A', status: 'blocked', blockedBy: [] },
      { id: 'b', text: 'Task B', status: 'blocked', blockedBy: [] },
    ];

    expect(wouldCreateCycle(todos, 'b', 'a')).toBe(false);
  });
});

describe('cleanupBlockedBy', () => {
  it('removes specified ID from all blockedBy arrays', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked', blockedBy: ['2', '3'] },
      { id: '2', text: 'task2', status: 'todo' },
      { id: '3', text: 'task3', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = cleanupBlockedBy(todos, '2');
    expect(result[0].blockedBy).toEqual(['3']);
    expect(result[2].status).toBe('todo');
    expect(result[2].blockedBy).toBeUndefined();
  });

  it('reverts blocked todos to todo when their last blocker is removed', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = cleanupBlockedBy(todos, '2');
    expect(result[0].status).toBe('todo');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('handles todos with no blockedBy array', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked' },
      { id: '2', text: 'task2', status: 'todo' },
    ];
    const result = cleanupBlockedBy(todos, '3');
    expect(result).toEqual([
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'todo' },
    ]);
  });

  it('leaves non-blocked todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = cleanupBlockedBy(todos, '3');
    expect(result).toEqual(todos);
  });

  it('does nothing when removed ID is not in any blockedBy array', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = cleanupBlockedBy(todos, '99');
    expect(result).toEqual(todos);
  });

  it('returns NEW array', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = cleanupBlockedBy(todos, '2');
    expect(result).not.toBe(todos);
  });
});

describe('finalizeBlockedStatus', () => {
  it('reverts blocked todos without blockers back to todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: [] }];
    const result = finalizeBlockedStatus(todos, '1');

    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'todo' });
  });

  it('keeps blocked todos with blockers unchanged', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = finalizeBlockedStatus(todos, '1');

    expect(result).toBe(todos);
  });
});

describe('detectUnblockedTodos', () => {
  it('returns the ID when one todo changes from blocked to todo', () => {
    const before = [
      { id: '1', text: 'blocker', status: 'done' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const after = [
      { id: '1', text: 'blocker', status: 'done' },
      { id: '2', text: 'blocked task', status: 'todo' },
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual(['2']);
  });

  it('returns both IDs when multiple todos change from blocked to todo', () => {
    const before = [
      { id: '1', text: 'done blocker', status: 'done' },
      {
        id: '2',
        text: 'first blocked task',
        status: 'blocked',
        blockedBy: ['1'],
      },
      {
        id: '3',
        text: 'second blocked task',
        status: 'blocked',
        blockedBy: ['1'],
      },
    ];
    const after = [
      { id: '1', text: 'done blocker', status: 'done' },
      { id: '2', text: 'first blocked task', status: 'todo' },
      { id: '3', text: 'second blocked task', status: 'todo' },
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual(['2', '3']);
  });

  it('returns an empty array when statuses are unchanged', () => {
    const before = [
      { id: '1', text: 'todo task', status: 'todo' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const after = [
      { id: '1', text: 'todo task', status: 'todo' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include todos that stay todo', () => {
    const before = [{ id: '1', text: 'task', status: 'todo' }];
    const after = [{ id: '1', text: 'task', status: 'todo' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include todos that stay blocked', () => {
    const before = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const after = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include todos that change from blocked to done', () => {
    const before = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const after = [{ id: '1', text: 'task', status: 'done' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('returns an empty array for empty before and after snapshots', () => {
    const result = model.detectUnblockedTodos([], []);
    expect(result).toEqual([]);
  });

  it('does not include todos that are deleted between snapshots', () => {
    const before = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] },
    ];
    const after = [];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include newly added todo todos', () => {
    const before = [];
    const after = [{ id: '1', text: 'new task', status: 'todo' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('detects unblock transitions even when blockedBy was populated before cleanup', () => {
    const before = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] },
    ];
    const after = [{ id: '1', text: 'task', status: 'todo' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual(['1']);
  });

  it('catches unblocks caused by clearFinished', () => {
    const before = [
      { id: 'a', text: 'done blocker', status: 'done' },
      { id: 'b', text: 'blocked task', status: 'blocked', blockedBy: ['a'] },
      { id: 'c', text: 'todo task', status: 'todo' },
    ];

    const cleared = clearFinished(before);
    const after = cleanupBlockedBy(cleared, 'a');

    expect(after).toEqual([
      { id: 'b', text: 'blocked task', status: 'todo' },
      { id: 'c', text: 'todo task', status: 'todo' },
    ]);
    expect(model.detectUnblockedTodos(before, after)).toEqual(['b']);
  });

  it('returns empty when clearFinished removes done todos that were not blockers', () => {
    const before = [
      { id: 'a', text: 'done task', status: 'done' },
      {
        id: 'b',
        text: 'still blocked task',
        status: 'blocked',
        blockedBy: ['c'],
      },
      { id: 'c', text: 'todo blocker', status: 'todo' },
    ];

    const cleared = clearFinished(before);
    const after = cleanupBlockedBy(cleared, 'a');

    expect(after).toEqual([
      {
        id: 'b',
        text: 'still blocked task',
        status: 'blocked',
        blockedBy: ['c'],
      },
      { id: 'c', text: 'todo blocker', status: 'todo' },
    ]);
    expect(model.detectUnblockedTodos(before, after)).toEqual([]);
  });

  it('detects separate unblock events across consecutive snapshots', () => {
    const before = [
      { id: 'a', text: 'A', status: 'todo' },
      { id: 'b', text: 'B', status: 'blocked', blockedBy: ['a'] },
      { id: 'c', text: 'C', status: 'todo' },
      { id: 'd', text: 'D', status: 'blocked', blockedBy: ['c'] },
    ];
    const afterCompletingA = [
      { id: 'a', text: 'A', status: 'done' },
      { id: 'b', text: 'B', status: 'todo' },
      { id: 'c', text: 'C', status: 'todo' },
      { id: 'd', text: 'D', status: 'blocked', blockedBy: ['c'] },
    ];
    const afterCompletingC = [
      { id: 'a', text: 'A', status: 'done' },
      { id: 'b', text: 'B', status: 'todo' },
      { id: 'c', text: 'C', status: 'done' },
      { id: 'd', text: 'D', status: 'todo' },
    ];

    expect(model.detectUnblockedTodos(before, afterCompletingA)).toEqual(['b']);
    expect(
      model.detectUnblockedTodos(afterCompletingA, afterCompletingC),
    ).toEqual(['d']);
  });
});

describe('deleteTodo', () => {
  it('removes the todo from the array', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = deleteTodo(todos, '1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('cleans up blockedBy references in other todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1', '3'] },
    ];
    const result = deleteTodo(todos, '1');
    expect(result[0].blockedBy).toEqual(['3']);
  });

  it('returns empty array when deleting the only todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = deleteTodo(todos, '1');
    expect(result).toEqual([]);
  });

  it('does nothing when todo id not found', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = deleteTodo(todos, 'nonexistent');
    expect(result).toEqual(todos);
  });

  it('reverts blocked todos to todo when deleted todo was their last blocker', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = deleteTodo(todos, '1');
    expect(result[0].status).toBe('todo');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('returns NEW array', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = deleteTodo(todos, '1');
    expect(result).not.toBe(todos);
  });
});

describe('clearFinished', () => {
  it('removes done todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'todo' },
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('removes cancelled todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'cancelled' },
      { id: '2', text: 'task2', status: 'todo' },
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('keeps todo todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('keeps blocked todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked', blockedBy: ['3'] },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toContain('1');
    expect(result.map((t) => t.id)).toContain('3');
  });

  it('cleans up blockedBy references to removed todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1', '3'] },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = clearFinished(todos);
    expect(result[0].blockedBy).toEqual(['3']);
  });

  it('reverts blocked todos to todo when all their blockers are removed', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = clearFinished(todos);
    expect(result[0].status).toBe('todo');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('removes done blockers from blockedBy during clearFinished flow', () => {
    const before = [
      { id: '1', text: 'done blocker', status: 'done' },
      {
        id: '2',
        text: 'still blocked task',
        status: 'blocked',
        blockedBy: ['1', '3'],
      },
      { id: '3', text: 'todo blocker', status: 'todo' },
    ];

    const cleared = clearFinished(before);
    const after = cleanupBlockedBy(cleared, '1');

    expect(after).toEqual([
      {
        id: '2',
        text: 'still blocked task',
        status: 'blocked',
        blockedBy: ['3'],
      },
      { id: '3', text: 'todo blocker', status: 'todo' },
    ]);
  });

  it('handles empty array', () => {
    const result = clearFinished([]);
    expect(result).toEqual([]);
  });

  it('returns unchanged array when no finished todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = clearFinished(todos);
    expect(result).toEqual(todos);
  });

  it('returns NEW array', () => {
    const todos = [{ id: '1', text: 'task', status: 'done' }];
    const result = clearFinished(todos);
    expect(result).not.toBe(todos);
  });

  it('handles multiple done and cancelled todos at once', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'cancelled' },
      { id: '3', text: 'task3', status: 'done' },
      { id: '4', text: 'task4', status: 'todo' },
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });
});

describe('getActionableTodos', () => {
  it('returns todo and inprogress tasks', () => {
    const todos = [
      { id: '1', text: 'todo task', status: 'todo' },
      { id: '2', text: 'working task', status: 'inprogress' },
      { id: '3', text: 'done task', status: 'done' },
      { id: '4', text: 'cancelled task', status: 'cancelled' },
      { id: '5', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual([
      { id: '1', text: 'todo task', status: 'todo' },
      { id: '2', text: 'working task', status: 'inprogress' },
    ]);
  });

  it('returns empty array when no ready tasks exist', () => {
    const todos = [
      { id: '1', text: 'done task', status: 'done' },
      { id: '2', text: 'cancelled task', status: 'cancelled' },
      { id: '3', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual([]);
  });

  it('returns all tasks when all are ready', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'inprogress' },
      { id: '3', text: 'task3', status: 'todo' },
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual(todos);
  });

  it('returns the ready tasks from a mixed-status list', () => {
    const todos = [
      { id: '1', text: 'todo one', status: 'todo' },
      { id: '2', text: 'done task', status: 'done' },
      { id: '3', text: 'todo two', status: 'todo' },
      { id: '4', text: 'working task', status: 'inprogress' },
      { id: '5', text: 'cancelled task', status: 'cancelled' },
      { id: '6', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual([
      { id: '1', text: 'todo one', status: 'todo' },
      { id: '3', text: 'todo two', status: 'todo' },
      { id: '4', text: 'working task', status: 'inprogress' },
    ]);
  });

  it('returns empty array for empty input', () => {
    const result = getActionableTodos([]);
    expect(result).toEqual([]);
  });

  it('includes a newly added todo task in the results', () => {
    const todos = [{ id: '1', text: 'existing done', status: 'done' }];
    const updated = addTodo(todos, 'new actionable task');
    const result = getActionableTodos(updated);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'new actionable task',
      status: 'todo',
    });
  });

  it('includes a task after it auto-unblocks back to todo', () => {
    const todos = [
      { id: '1', text: 'blocker', status: 'todo' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];
    const updated = cleanupBlockedBy(todos, '1');
    const result = getActionableTodos(updated);
    expect(result).toEqual([
      { id: '1', text: 'blocker', status: 'todo' },
      { id: '2', text: 'blocked task', status: 'todo' },
    ]);
  });

  it('excludes blocked todos without blockers until they auto-revert to todo', () => {
    const todos = [
      { id: '1', text: 'todo task', status: 'todo' },
      { id: '2', text: 'needs blockers', status: 'blocked', blockedBy: [] },
      {
        id: '3',
        text: 'actually blocked',
        status: 'blocked',
        blockedBy: ['1'],
      },
    ];

    expect(getActionableTodos(todos)).toEqual([
      { id: '1', text: 'todo task', status: 'todo' },
    ]);
  });
});

describe('getActionableCount', () => {
  it('returns correct actionable and total counts for a mixed list', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'inprogress' },
      { id: '3', text: 'task3', status: 'done' },
      { id: '4', text: 'task4', status: 'todo' },
      { id: '5', text: 'task5', status: 'cancelled' },
    ];
    const result = getActionableCount(todos);
    expect(result).toEqual({ actionable: 3, total: 5 });
  });

  it('returns matching actionable and total counts when all tasks are ready', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'inprogress' },
    ];
    const result = getActionableCount(todos);
    expect(result).toEqual({ actionable: 2, total: 2 });
  });

  it('returns zero actionable when no tasks are ready', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'cancelled' },
      { id: '3', text: 'task3', status: 'blocked', blockedBy: ['1'] },
    ];
    const result = getActionableCount(todos);
    expect(result).toEqual({ actionable: 0, total: 3 });
  });

  it('counts todo and inprogress statuses as actionable while the picker is open', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'inprogress' },
      { id: '3', text: 'task3', status: 'blocked', blockedBy: [] },
    ];

    expect(getActionableCount(todos)).toEqual({ actionable: 2, total: 3 });
  });

  it('returns zero counts for an empty list', () => {
    const result = getActionableCount([]);
    expect(result).toEqual({ actionable: 0, total: 0 });
  });
});

describe('updateTodoText', () => {
  it('updates the text of an existing todo', () => {
    const todos = [
      { id: '1', text: 'Buy milk', status: 'todo' },
      { id: '2', text: 'Walk dog', status: 'done' },
    ];
    const result = updateTodoText(todos, '1', 'Buy oat milk');
    expect(result[0].text).toBe('Buy oat milk');
  });

  it('returns a NEW array (immutability)', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = updateTodoText(todos, '1', 'updated task');
    expect(result).not.toBe(todos);
  });

  it('does not mutate the original todo object', () => {
    const original = { id: '1', text: 'task', status: 'todo' };
    const todos = [original];
    updateTodoText(todos, '1', 'updated task');
    expect(original.text).toBe('task');
  });

  it('persists updated text through saveTodos/loadTodos round-trip', () => {
    const mockStorage = { getItem: vi.fn(), setItem: vi.fn() };
    const todos = [{ id: '1', text: 'old text', status: 'todo' }];
    const updated = updateTodoText(todos, '1', 'new text');

    saveTodos(updated, mockStorage, 'testKey');
    mockStorage.getItem.mockReturnValue(mockStorage.setItem.mock.calls[0][1]);
    const loaded = loadTodos(mockStorage, 'testKey');

    expect(loaded[0].text).toBe('new text');
  });

  it('returns todos unchanged for empty text', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = updateTodoText(todos, '1', '');
    expect(result).toEqual(todos);
  });

  it('returns todos unchanged for whitespace-only text', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = updateTodoText(todos, '1', '   \n\t  ');
    expect(result).toEqual(todos);
  });

  it('is a no-op when the todo id does not exist', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = updateTodoText(todos, 'nonexistent', 'new text');
    expect(result).toEqual(todos);
  });

  it('does not change the todo status', () => {
    const todos = [{ id: '1', text: 'task', status: 'done' }];
    const result = updateTodoText(todos, '1', 'updated task');
    expect(result[0].status).toBe('done');
  });

  it('does not change blockedBy on a blocked todo', () => {
    const todos = [
      { id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] },
    ];
    const result = updateTodoText(todos, '1', 'updated task');
    expect(result[0].status).toBe('blocked');
    expect(result[0].blockedBy).toEqual(['2', '3']);
  });

  it('preserves position of the updated todo in the array', () => {
    const todos = [
      { id: '1', text: 'first', status: 'todo' },
      { id: '2', text: 'second', status: 'todo' },
      { id: '3', text: 'third', status: 'todo' },
    ];
    const result = updateTodoText(todos, '2', 'edited second');
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    expect(result[1].text).toBe('edited second');
    expect(result[2].id).toBe('3');
  });

  it('leaves other todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'todo' },
      { id: '2', text: 'task2', status: 'done' },
    ];
    const result = updateTodoText(todos, '1', 'updated');
    expect(result[1]).toEqual(todos[1]);
  });

  it('trims leading and trailing whitespace from new text', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = updateTodoText(todos, '1', '  trimmed text  ');
    expect(result[0].text).toBe('trimmed text');
  });

  it('preserves the todo id after update', () => {
    const todos = [{ id: '1', text: 'task', status: 'todo' }];
    const result = updateTodoText(todos, '1', 'new text');
    expect(result[0].id).toBe('1');
  });
});

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createStableNow() {
  const anchor = new Date(2026, 1, 15, 12, 0, 0, 0);
  const offsetHours = anchor.getTimezoneOffset() / 60;
  const minHour = Math.ceil(Math.max(0, -offsetHours));
  const maxHour = Math.floor(Math.min(23, 23 - offsetHours));
  const safeHour = Math.floor((minHour + maxHour) / 2);
  return new Date(2026, 1, 15, safeHour, 0, 0, 0);
}

function shiftDays(date, deltaDays) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + deltaDays);
  return shifted;
}

describe('takeBurndownSample', () => {
  const stableNow = createStableNow();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(stableNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns counts for mixed statuses while keeping blocked separate from ready work', () => {
    const todos = [
      { id: '1', text: 'done one', status: 'done' },
      { id: '2', text: 'done two', status: 'done' },
      { id: '3', text: 'cancelled task', status: 'cancelled' },
      { id: '4', text: 'todo one', status: 'todo' },
      { id: '5', text: 'working task', status: 'inprogress' },
      { id: '6', text: 'todo two', status: 'todo' },
      { id: '7', text: 'blocked task', status: 'blocked', blockedBy: ['1'] },
    ];

    expect(model.takeBurndownSample(todos)).toEqual({
      date: formatDate(stableNow),
      done: 2,
      cancelled: 1,
      todo: 3,
      total: 7,
    });
  });

  it('returns zero done and cancelled when all todos are todo', () => {
    const todos = [
      { id: '1', text: 'task one', status: 'todo' },
      { id: '2', text: 'task two', status: 'todo' },
      { id: '3', text: 'task three', status: 'todo' },
    ];

    expect(model.takeBurndownSample(todos)).toEqual({
      date: formatDate(stableNow),
      done: 0,
      cancelled: 0,
      todo: 3,
      total: 3,
    });
  });

  it('returns zero todo when all todos are done', () => {
    const todos = [
      { id: '1', text: 'task one', status: 'done' },
      { id: '2', text: 'task two', status: 'done' },
      { id: '3', text: 'task three', status: 'done' },
    ];

    expect(model.takeBurndownSample(todos)).toEqual({
      date: formatDate(stableNow),
      done: 3,
      cancelled: 0,
      todo: 0,
      total: 3,
    });
  });

  it('returns zero counts for an empty todo list', () => {
    expect(model.takeBurndownSample([])).toEqual({
      date: formatDate(stableNow),
      done: 0,
      cancelled: 0,
      todo: 0,
      total: 0,
    });
  });

  it('returns today as a YYYY-MM-DD date string', () => {
    const result = model.takeBurndownSample([]);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.date).toBe(formatDate(stableNow));
  });
});

describe('shouldSampleToday', () => {
  const stableNow = createStableNow();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(stableNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when no samples exist', () => {
    expect(model.shouldSampleToday([])).toBe(true);
  });

  it('returns false when today already has a sample', () => {
    const data = [
      { date: formatDate(stableNow), done: 2, cancelled: 1, todo: 3, total: 6 },
    ];

    expect(model.shouldSampleToday(data)).toBe(false);
  });

  it('returns true when only yesterday has a sample', () => {
    const data = [
      {
        date: formatDate(shiftDays(stableNow, -1)),
        done: 2,
        cancelled: 1,
        todo: 3,
        total: 6,
      },
    ];

    expect(model.shouldSampleToday(data)).toBe(true);
  });

  it('returns true when multiple samples exist but none are from today', () => {
    const data = [
      {
        date: formatDate(shiftDays(stableNow, -2)),
        done: 1,
        cancelled: 0,
        todo: 4,
        total: 5,
      },
      {
        date: formatDate(shiftDays(stableNow, -7)),
        done: 3,
        cancelled: 1,
        todo: 2,
        total: 6,
      },
      {
        date: formatDate(shiftDays(stableNow, -30)),
        done: 4,
        cancelled: 1,
        todo: 1,
        total: 6,
      },
    ];

    expect(model.shouldSampleToday(data)).toBe(true);
  });
});

describe('pruneBurndownData', () => {
  const stableNow = createStableNow();

  const makeSample = (daysAgo, overrides = {}) => ({
    date: formatDate(shiftDays(stableNow, -daysAgo)),
    done: 1,
    cancelled: 0,
    todo: 2,
    total: 3,
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(stableNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps all entries that are within the last 30 days', () => {
    const data = [makeSample(0), makeSample(5), makeSample(30)];
    expect(model.pruneBurndownData(data)).toEqual(data);
  });

  it('removes only entries older than 30 days', () => {
    const withinWindow = makeSample(0, { done: 3 });
    const boundary = makeSample(30, { done: 4 });
    const oldOne = makeSample(31, { done: 5 });
    const oldTwo = makeSample(45, { done: 6 });
    const data = [oldTwo, withinWindow, oldOne, boundary];

    expect(model.pruneBurndownData(data)).toEqual([withinWindow, boundary]);
  });

  it('returns an empty array when all entries are older than 30 days', () => {
    const data = [makeSample(31), makeSample(60)];
    expect(model.pruneBurndownData(data)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(model.pruneBurndownData([])).toEqual([]);
  });

  it('keeps an entry that is exactly 30 days old', () => {
    const boundaryEntry = makeSample(30, { done: 9, total: 12 });
    expect(model.pruneBurndownData([boundaryEntry])).toEqual([boundaryEntry]);
  });
});
