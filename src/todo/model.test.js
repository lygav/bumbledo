import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateId,
  migrateTodos,
  loadTodos,
  saveTodos,
  addTodo,
  setStatus,
  toggleBlocker,
  cleanupBlockedBy,
  deleteTodo,
  clearFinished
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
