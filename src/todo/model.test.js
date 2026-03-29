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
  toggleBlocker,
  cleanupBlockedBy,
  deleteTodo,
  clearFinished,
  getActionableCount,
  getActionableTodos,
  updateTodoText
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

  it('migrates old done:false to status:active', () => {
    const old = [{ id: '1', text: 'task', done: false }];
    const result = migrateTodos(old);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'active' });
  });

  it('adds status:active when no status field', () => {
    const todos = [{ id: '1', text: 'task' }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'active' });
  });

  it('adds blockedBy:[] for blocked items without it', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked' }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'blocked', blockedBy: [] });
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
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = migrateTodos(todos);
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] });
  });
});

describe('loadTodos', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };
  });

  it('loads and parses from storage', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    mockStorage.getItem.mockReturnValue(JSON.stringify(todos));
    
    const result = loadTodos(mockStorage, 'testKey');
    expect(result).toEqual(todos);
    expect(mockStorage.getItem).toHaveBeenCalledWith('testKey');
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
      setItem: vi.fn()
    };
  });

  it('saves serialized todos to storage', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    saveTodos(todos, mockStorage, 'testKey');
    
    expect(mockStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(todos));
  });

  it('strips blockedBy from non-blocked items', () => {
    const todos = [{ id: '1', text: 'task', status: 'active', blockedBy: ['2'] }];
    saveTodos(todos, mockStorage);
    
    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved[0]).not.toHaveProperty('blockedBy');
  });

  it('preserves blockedBy for blocked items', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] }];
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

  it('only saves id, text, status, and blockedBy fields', () => {
    const todos = [{ id: '1', text: 'task', status: 'done', extraField: 'ignored' }];
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
      setItem: vi.fn()
    };
  });

  describe('loadBurndownData', () => {
    it('loads burndown samples from storage', () => {
      mockStorage.getItem.mockReturnValue(JSON.stringify([
        { date: '2026-03-29', done: 2, cancelled: 1, active: 3, total: 6 }
      ]));

      expect(loadBurndownData(mockStorage)).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 1, active: 3, total: 6 }
      ]);
      expect(mockStorage.getItem).toHaveBeenCalledWith('todos_burndown');
    });

    it('returns empty array for invalid burndown JSON', () => {
      mockStorage.getItem.mockReturnValue('{not valid');
      expect(loadBurndownData(mockStorage)).toEqual([]);
    });

    it('drops invalid samples and keeps valid stored totals', () => {
      mockStorage.getItem.mockReturnValue(JSON.stringify([
        { date: 'bad-date', done: 2, cancelled: 0, active: 1, total: 3 },
        { date: '2026-03-29', done: 2, cancelled: 1, active: 3, total: 1 }
      ]));

      expect(loadBurndownData(mockStorage)).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 1, active: 3, total: 1 }
      ]);
    });
  });

  describe('saveBurndownData', () => {
    it('saves pruned burndown samples', () => {
      const samples = [
        { date: '2026-02-26', done: 1, cancelled: 0, active: 1, total: 2 },
        { date: '2026-03-01', done: 2, cancelled: 0, active: 1, total: 3 },
        { date: '2026-03-29', done: 3, cancelled: 1, active: 1, total: 5 }
      ];

      const result = saveBurndownData(samples, mockStorage, 'todos_burndown', new Date(2026, 2, 29, 8, 0));

      expect(result).toEqual([
        { date: '2026-03-01', done: 2, cancelled: 0, active: 1, total: 3 },
        { date: '2026-03-29', done: 3, cancelled: 1, active: 1, total: 5 }
      ]);
      expect(mockStorage.setItem).toHaveBeenCalledWith('todos_burndown', JSON.stringify(result));
    });

    it('keeps only the latest sample for a duplicate date', () => {
      const result = saveBurndownData([
        { date: '2026-03-29', done: 1, cancelled: 0, active: 2, total: 3 },
        { date: '2026-03-29', done: 2, cancelled: 0, active: 2, total: 4 }
      ], mockStorage, 'todos_burndown', new Date(2026, 2, 29, 8, 0));

      expect(result).toEqual([
        { date: '2026-03-29', done: 2, cancelled: 0, active: 2, total: 4 }
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
      status: 'active'
    });
    expect(result[0].id).toBeDefined();
  });

  it('trims whitespace from text', () => {
    const result = addTodo([], '  task with spaces  ');
    expect(result[0].text).toBe('task with spaces');
  });

  it('returns unchanged array for empty text', () => {
    const todos = [{ id: '1', text: 'existing', status: 'active' }];
    const result = addTodo(todos, '');
    expect(result).toEqual(todos);
  });

  it('returns unchanged array for whitespace-only text', () => {
    const todos = [{ id: '1', text: 'existing', status: 'active' }];
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
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = setStatus(todos, '1', 'done');
    expect(result[0].status).toBe('done');
  });

  it('changes status to cancelled', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = setStatus(todos, '1', 'cancelled');
    expect(result[0].status).toBe('cancelled');
  });

  it('changes status to blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = setStatus(todos, '1', 'blocked');
    expect(result[0].status).toBe('blocked');
  });

  it('adds empty blockedBy array when setting to blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = setStatus(todos, '1', 'blocked');
    expect(result[0].blockedBy).toEqual([]);
  });

  it('removes blockedBy when changing from blocked to active', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = setStatus(todos, '1', 'active');
    expect(result[0]).not.toHaveProperty('blockedBy');
    expect(result[0].status).toBe('active');
  });

  it('removes blockedBy when changing from blocked to done', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = setStatus(todos, '1', 'done');
    expect(result[0]).not.toHaveProperty('blockedBy');
  });

  it('returns NEW array (immutability)', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = setStatus(todos, '1', 'done');
    expect(result).not.toBe(todos);
  });

  it('leaves other todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
    ];
    const result = setStatus(todos, '1', 'done');
    expect(result[1]).toEqual(todos[1]);
  });

  it('does nothing when todo id not found', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = setStatus(todos, 'nonexistent', 'done');
    expect(result).toEqual(todos);
  });

  it('preserves existing blockedBy when setting to blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = setStatus(todos, '1', 'blocked');
    expect(result[0].blockedBy).toEqual(['2']);
  });
});

describe('cycleStatus', () => {
  it('cycles active todos to done', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('done');
  });

  it('cycles done todos back to active', () => {
    const todos = [{ id: '1', text: 'task', status: 'done' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('active');
  });

  it('cycles cancelled todos back to active', () => {
    const todos = [{ id: '1', text: 'task', status: 'cancelled' }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0].status).toBe('active');
  });

  it('does not cycle blocked todos with blockers', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = model.cycleStatus(todos, '1');
    expect(result[0]).toEqual({ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] });
  });
});

describe('getNextTodoId', () => {
  it('returns the next todo id for a middle item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = model.getNextTodoId(todos, '2');
    expect(result).toBe('3');
  });

  it('wraps to the first todo id from the last item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = model.getNextTodoId(todos, '3');
    expect(result).toBe('1');
  });

  it('returns the same todo id for a single-item list', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = model.getNextTodoId(todos, '1');
    expect(result).toBe('1');
  });

  it('returns the first todo id when current id is not found', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
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
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = model.getPrevTodoId(todos, '2');
    expect(result).toBe('1');
  });

  it('wraps to the last todo id from the first item', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = model.getPrevTodoId(todos, '1');
    expect(result).toBe('3');
  });

  it('returns the same todo id for a single-item list', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = model.getPrevTodoId(todos, '1');
    expect(result).toBe('1');
  });

  it('returns the first todo id when current id is not found', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
    ];
    const result = model.getPrevTodoId(todos, 'missing');
    expect(result).toBe('1');
  });

  it('returns null for an empty list', () => {
    const result = model.getPrevTodoId([], '1');
    expect(result).toBeNull();
  });
});

describe('toggleBlocker', () => {
  it('adds a blocker to blockedBy', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: [] }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].blockedBy).toEqual(['2']);
  });

  it('removes an existing blocker', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].blockedBy).toEqual(['3']);
  });

  it('reverts to active when last blocker is removed', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0].status).toBe('active');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('does nothing if todo is not blocked', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = toggleBlocker(todos, '1', '2');
    expect(result[0]).toEqual(todos[0]);
  });

  it('returns NEW array', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
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
      { id: '2', text: 'task2', status: 'active' }
    ];
    const result = toggleBlocker(todos, '1', '3');
    expect(result[1]).toEqual(todos[1]);
  });
});

describe('cleanupBlockedBy', () => {
  it('removes specified ID from all blockedBy arrays', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked', blockedBy: ['2', '3'] },
      { id: '2', text: 'task2', status: 'active' },
      { id: '3', text: 'task3', status: 'blocked', blockedBy: ['2'] }
    ];
    const result = cleanupBlockedBy(todos, '2');
    expect(result[0].blockedBy).toEqual(['3']);
    expect(result[2].status).toBe('active');
    expect(result[2].blockedBy).toBeUndefined();
  });

  it('reverts blocked todos to active when their last blocker is removed', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = cleanupBlockedBy(todos, '2');
    expect(result[0].status).toBe('active');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('handles todos with no blockedBy array', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked' },
      { id: '2', text: 'task2', status: 'active' }
    ];
    const result = cleanupBlockedBy(todos, '3');
    expect(result).toEqual(todos);
  });

  it('leaves non-blocked todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
    ];
    const result = cleanupBlockedBy(todos, '3');
    expect(result).toEqual(todos);
  });

  it('does nothing when removed ID is not in any blockedBy array', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = cleanupBlockedBy(todos, '99');
    expect(result).toEqual(todos);
  });

  it('returns NEW array', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = cleanupBlockedBy(todos, '2');
    expect(result).not.toBe(todos);
  });
});

describe('detectUnblockedTodos', () => {
  it('returns the ID when one todo changes from blocked to active', () => {
    const before = [
      { id: '1', text: 'blocker', status: 'done' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const after = [
      { id: '1', text: 'blocker', status: 'done' },
      { id: '2', text: 'blocked task', status: 'active' }
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual(['2']);
  });

  it('returns both IDs when multiple todos change from blocked to active', () => {
    const before = [
      { id: '1', text: 'done blocker', status: 'done' },
      { id: '2', text: 'first blocked task', status: 'blocked', blockedBy: ['1'] },
      { id: '3', text: 'second blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const after = [
      { id: '1', text: 'done blocker', status: 'done' },
      { id: '2', text: 'first blocked task', status: 'active' },
      { id: '3', text: 'second blocked task', status: 'active' }
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual(['2', '3']);
  });

  it('returns an empty array when statuses are unchanged', () => {
    const before = [
      { id: '1', text: 'active task', status: 'active' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const after = [
      { id: '1', text: 'active task', status: 'active' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include todos that stay active', () => {
    const before = [{ id: '1', text: 'task', status: 'active' }];
    const after = [{ id: '1', text: 'task', status: 'active' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include todos that stay blocked', () => {
    const before = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const after = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include todos that change from blocked to done', () => {
    const before = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const after = [{ id: '1', text: 'task', status: 'done' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('returns an empty array for empty before and after snapshots', () => {
    const result = model.detectUnblockedTodos([], []);
    expect(result).toEqual([]);
  });

  it('does not include todos that are deleted between snapshots', () => {
    const before = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2'] }];
    const after = [];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('does not include newly added active todos', () => {
    const before = [];
    const after = [{ id: '1', text: 'new task', status: 'active' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual([]);
  });

  it('detects unblock transitions even when blockedBy was populated before cleanup', () => {
    const before = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] }];
    const after = [{ id: '1', text: 'task', status: 'active' }];
    const result = model.detectUnblockedTodos(before, after);
    expect(result).toEqual(['1']);
  });

  it('catches unblocks caused by clearFinished', () => {
    const before = [
      { id: 'a', text: 'done blocker', status: 'done' },
      { id: 'b', text: 'blocked task', status: 'blocked', blockedBy: ['a'] },
      { id: 'c', text: 'active task', status: 'active' }
    ];

    const cleared = clearFinished(before);
    const after = cleanupBlockedBy(cleared, 'a');

    expect(after).toEqual([
      { id: 'b', text: 'blocked task', status: 'active' },
      { id: 'c', text: 'active task', status: 'active' }
    ]);
    expect(model.detectUnblockedTodos(before, after)).toEqual(['b']);
  });

  it('returns empty when clearFinished removes done todos that were not blockers', () => {
    const before = [
      { id: 'a', text: 'done task', status: 'done' },
      { id: 'b', text: 'still blocked task', status: 'blocked', blockedBy: ['c'] },
      { id: 'c', text: 'active blocker', status: 'active' }
    ];

    const cleared = clearFinished(before);
    const after = cleanupBlockedBy(cleared, 'a');

    expect(after).toEqual([
      { id: 'b', text: 'still blocked task', status: 'blocked', blockedBy: ['c'] },
      { id: 'c', text: 'active blocker', status: 'active' }
    ]);
    expect(model.detectUnblockedTodos(before, after)).toEqual([]);
  });

  it('detects separate unblock events across consecutive snapshots', () => {
    const before = [
      { id: 'a', text: 'A', status: 'active' },
      { id: 'b', text: 'B', status: 'blocked', blockedBy: ['a'] },
      { id: 'c', text: 'C', status: 'active' },
      { id: 'd', text: 'D', status: 'blocked', blockedBy: ['c'] }
    ];
    const afterCompletingA = [
      { id: 'a', text: 'A', status: 'done' },
      { id: 'b', text: 'B', status: 'active' },
      { id: 'c', text: 'C', status: 'active' },
      { id: 'd', text: 'D', status: 'blocked', blockedBy: ['c'] }
    ];
    const afterCompletingC = [
      { id: 'a', text: 'A', status: 'done' },
      { id: 'b', text: 'B', status: 'active' },
      { id: 'c', text: 'C', status: 'done' },
      { id: 'd', text: 'D', status: 'active' }
    ];

    expect(model.detectUnblockedTodos(before, afterCompletingA)).toEqual(['b']);
    expect(model.detectUnblockedTodos(afterCompletingA, afterCompletingC)).toEqual(['d']);
  });
});

describe('deleteTodo', () => {
  it('removes the todo from the array', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
    ];
    const result = deleteTodo(todos, '1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('cleans up blockedBy references in other todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1', '3'] }
    ];
    const result = deleteTodo(todos, '1');
    expect(result[0].blockedBy).toEqual(['3']);
  });

  it('returns empty array when deleting the only todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = deleteTodo(todos, '1');
    expect(result).toEqual([]);
  });

  it('does nothing when todo id not found', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = deleteTodo(todos, 'nonexistent');
    expect(result).toEqual(todos);
  });

  it('reverts blocked todos to active when deleted todo was their last blocker', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = deleteTodo(todos, '1');
    expect(result[0].status).toBe('active');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('returns NEW array', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = deleteTodo(todos, '1');
    expect(result).not.toBe(todos);
  });
});

describe('clearFinished', () => {
  it('removes done todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'active' }
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('removes cancelled todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'cancelled' },
      { id: '2', text: 'task2', status: 'active' }
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('keeps active todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('keeps blocked todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'blocked', blockedBy: ['3'] },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toContain('1');
    expect(result.map(t => t.id)).toContain('3');
  });

  it('cleans up blockedBy references to removed todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1', '3'] },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = clearFinished(todos);
    expect(result[0].blockedBy).toEqual(['3']);
  });

  it('reverts blocked todos to active when all their blockers are removed', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = clearFinished(todos);
    expect(result[0].status).toBe('active');
    expect(result[0].blockedBy).toBeUndefined();
  });

  it('removes done blockers from blockedBy during clearFinished flow', () => {
    const before = [
      { id: '1', text: 'done blocker', status: 'done' },
      { id: '2', text: 'still blocked task', status: 'blocked', blockedBy: ['1', '3'] },
      { id: '3', text: 'active blocker', status: 'active' }
    ];

    const cleared = clearFinished(before);
    const after = cleanupBlockedBy(cleared, '1');

    expect(after).toEqual([
      { id: '2', text: 'still blocked task', status: 'blocked', blockedBy: ['3'] },
      { id: '3', text: 'active blocker', status: 'active' }
    ]);
  });

  it('handles empty array', () => {
    const result = clearFinished([]);
    expect(result).toEqual([]);
  });

  it('returns unchanged array when no finished todos', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'blocked', blockedBy: ['1'] }
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
      { id: '4', text: 'task4', status: 'active' }
    ];
    const result = clearFinished(todos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });
});

describe('getActionableTodos', () => {
  it('returns only active tasks', () => {
    const todos = [
      { id: '1', text: 'active task', status: 'active' },
      { id: '2', text: 'done task', status: 'done' },
      { id: '3', text: 'cancelled task', status: 'cancelled' },
      { id: '4', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual([{ id: '1', text: 'active task', status: 'active' }]);
  });

  it('returns empty array when no active tasks exist', () => {
    const todos = [
      { id: '1', text: 'done task', status: 'done' },
      { id: '2', text: 'cancelled task', status: 'cancelled' },
      { id: '3', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual([]);
  });

  it('returns all tasks when all are active', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'active' },
      { id: '3', text: 'task3', status: 'active' }
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual(todos);
  });

  it('returns the two active tasks from a mixed-status list', () => {
    const todos = [
      { id: '1', text: 'active one', status: 'active' },
      { id: '2', text: 'done task', status: 'done' },
      { id: '3', text: 'active two', status: 'active' },
      { id: '4', text: 'cancelled task', status: 'cancelled' },
      { id: '5', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = getActionableTodos(todos);
    expect(result).toEqual([
      { id: '1', text: 'active one', status: 'active' },
      { id: '3', text: 'active two', status: 'active' }
    ]);
  });

  it('returns empty array for empty input', () => {
    const result = getActionableTodos([]);
    expect(result).toEqual([]);
  });

  it('includes a newly added active task in the results', () => {
    const todos = [{ id: '1', text: 'existing done', status: 'done' }];
    const updated = addTodo(todos, 'new actionable task');
    const result = getActionableTodos(updated);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'new actionable task',
      status: 'active'
    });
  });

  it('includes a task after it auto-unblocks back to active', () => {
    const todos = [
      { id: '1', text: 'blocker', status: 'active' },
      { id: '2', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];
    const updated = cleanupBlockedBy(todos, '1');
    const result = getActionableTodos(updated);
    expect(result).toEqual([
      { id: '1', text: 'blocker', status: 'active' },
      { id: '2', text: 'blocked task', status: 'active' }
    ]);
  });
});

describe('getActionableCount', () => {
  it('returns correct actionable and total counts for a mixed list', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' },
      { id: '3', text: 'task3', status: 'active' },
      { id: '4', text: 'task4', status: 'cancelled' },
      { id: '5', text: 'task5', status: 'active' }
    ];
    const result = getActionableCount(todos);
    expect(result).toEqual({ actionable: 3, total: 5 });
  });

  it('returns matching actionable and total counts when all tasks are active', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'active' }
    ];
    const result = getActionableCount(todos);
    expect(result).toEqual({ actionable: 2, total: 2 });
  });

  it('returns zero actionable when no tasks are active', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'done' },
      { id: '2', text: 'task2', status: 'cancelled' },
      { id: '3', text: 'task3', status: 'blocked', blockedBy: ['1'] }
    ];
    const result = getActionableCount(todos);
    expect(result).toEqual({ actionable: 0, total: 3 });
  });

  it('returns zero counts for an empty list', () => {
    const result = getActionableCount([]);
    expect(result).toEqual({ actionable: 0, total: 0 });
  });
});

describe('updateTodoText', () => {
  it('updates the text of an existing todo', () => {
    const todos = [
      { id: '1', text: 'Buy milk', status: 'active' },
      { id: '2', text: 'Walk dog', status: 'done' }
    ];
    const result = updateTodoText(todos, '1', 'Buy oat milk');
    expect(result[0].text).toBe('Buy oat milk');
  });

  it('returns a NEW array (immutability)', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = updateTodoText(todos, '1', 'updated task');
    expect(result).not.toBe(todos);
  });

  it('does not mutate the original todo object', () => {
    const original = { id: '1', text: 'task', status: 'active' };
    const todos = [original];
    updateTodoText(todos, '1', 'updated task');
    expect(original.text).toBe('task');
  });

  it('persists updated text through saveTodos/loadTodos round-trip', () => {
    const mockStorage = { getItem: vi.fn(), setItem: vi.fn() };
    const todos = [{ id: '1', text: 'old text', status: 'active' }];
    const updated = updateTodoText(todos, '1', 'new text');

    saveTodos(updated, mockStorage, 'testKey');
    mockStorage.getItem.mockReturnValue(mockStorage.setItem.mock.calls[0][1]);
    const loaded = loadTodos(mockStorage, 'testKey');

    expect(loaded[0].text).toBe('new text');
  });

  it('returns todos unchanged for empty text', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = updateTodoText(todos, '1', '');
    expect(result).toEqual(todos);
  });

  it('returns todos unchanged for whitespace-only text', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = updateTodoText(todos, '1', '   \n\t  ');
    expect(result).toEqual(todos);
  });

  it('is a no-op when the todo id does not exist', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = updateTodoText(todos, 'nonexistent', 'new text');
    expect(result).toEqual(todos);
  });

  it('does not change the todo status', () => {
    const todos = [{ id: '1', text: 'task', status: 'done' }];
    const result = updateTodoText(todos, '1', 'updated task');
    expect(result[0].status).toBe('done');
  });

  it('does not change blockedBy on a blocked todo', () => {
    const todos = [{ id: '1', text: 'task', status: 'blocked', blockedBy: ['2', '3'] }];
    const result = updateTodoText(todos, '1', 'updated task');
    expect(result[0].status).toBe('blocked');
    expect(result[0].blockedBy).toEqual(['2', '3']);
  });

  it('preserves position of the updated todo in the array', () => {
    const todos = [
      { id: '1', text: 'first', status: 'active' },
      { id: '2', text: 'second', status: 'active' },
      { id: '3', text: 'third', status: 'active' }
    ];
    const result = updateTodoText(todos, '2', 'edited second');
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    expect(result[1].text).toBe('edited second');
    expect(result[2].id).toBe('3');
  });

  it('leaves other todos unchanged', () => {
    const todos = [
      { id: '1', text: 'task1', status: 'active' },
      { id: '2', text: 'task2', status: 'done' }
    ];
    const result = updateTodoText(todos, '1', 'updated');
    expect(result[1]).toEqual(todos[1]);
  });

  it('trims leading and trailing whitespace from new text', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
    const result = updateTodoText(todos, '1', '  trimmed text  ');
    expect(result[0].text).toBe('trimmed text');
  });

  it('preserves the todo id after update', () => {
    const todos = [{ id: '1', text: 'task', status: 'active' }];
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

  it('returns counts for mixed statuses with blocked included as active', () => {
    const todos = [
      { id: '1', text: 'done one', status: 'done' },
      { id: '2', text: 'done two', status: 'done' },
      { id: '3', text: 'cancelled task', status: 'cancelled' },
      { id: '4', text: 'active one', status: 'active' },
      { id: '5', text: 'active two', status: 'active' },
      { id: '6', text: 'active three', status: 'active' },
      { id: '7', text: 'blocked task', status: 'blocked', blockedBy: ['1'] }
    ];

    expect(model.takeBurndownSample(todos)).toEqual({
      date: formatDate(stableNow),
      done: 2,
      cancelled: 1,
      active: 4,
      total: 7
    });
  });

  it('returns zero done and cancelled when all todos are active', () => {
    const todos = [
      { id: '1', text: 'task one', status: 'active' },
      { id: '2', text: 'task two', status: 'active' },
      { id: '3', text: 'task three', status: 'active' }
    ];

    expect(model.takeBurndownSample(todos)).toEqual({
      date: formatDate(stableNow),
      done: 0,
      cancelled: 0,
      active: 3,
      total: 3
    });
  });

  it('returns zero active when all todos are done', () => {
    const todos = [
      { id: '1', text: 'task one', status: 'done' },
      { id: '2', text: 'task two', status: 'done' },
      { id: '3', text: 'task three', status: 'done' }
    ];

    expect(model.takeBurndownSample(todos)).toEqual({
      date: formatDate(stableNow),
      done: 3,
      cancelled: 0,
      active: 0,
      total: 3
    });
  });

  it('returns zero counts for an empty todo list', () => {
    expect(model.takeBurndownSample([])).toEqual({
      date: formatDate(stableNow),
      done: 0,
      cancelled: 0,
      active: 0,
      total: 0
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
      { date: formatDate(stableNow), done: 2, cancelled: 1, active: 3, total: 6 }
    ];

    expect(model.shouldSampleToday(data)).toBe(false);
  });

  it('returns true when only yesterday has a sample', () => {
    const data = [
      { date: formatDate(shiftDays(stableNow, -1)), done: 2, cancelled: 1, active: 3, total: 6 }
    ];

    expect(model.shouldSampleToday(data)).toBe(true);
  });

  it('returns true when multiple samples exist but none are from today', () => {
    const data = [
      { date: formatDate(shiftDays(stableNow, -2)), done: 1, cancelled: 0, active: 4, total: 5 },
      { date: formatDate(shiftDays(stableNow, -7)), done: 3, cancelled: 1, active: 2, total: 6 },
      { date: formatDate(shiftDays(stableNow, -30)), done: 4, cancelled: 1, active: 1, total: 6 }
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
    active: 2,
    total: 3,
    ...overrides
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
