import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from './graph.js';

describe('buildDependencyGraph — Node mapping', () => {
  it('returns no nodes, no edges, and hasDependencies false for an empty array', () => {
    const result = buildDependencyGraph([]);

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.hasDependencies).toBe(false);
    expect(result.cycleEdges).toEqual([]);
    expect(result.stats).toEqual({
      nodeCount: 0,
      edgeCount: 0,
      cycleCount: 0,
    });
  });

  it('creates one node and no edges for a single todo without blockers', () => {
    const todos = [{ id: 'todo-1', text: 'Write tests', status: 'todo' }];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toEqual([
      { id: 'todo-1', label: 'Write tests', status: 'todo', orderIndex: 0 },
    ]);
    expect(result.edges).toEqual([]);
    expect(result.hasDependencies).toBe(false);
  });

  it('preserves id, maps text to label, keeps status, and sets orderIndex from array position', () => {
    const todos = [
      { id: 'a', text: 'First task', status: 'done' },
      { id: 'b', text: 'Second task', status: 'blocked' },
      { id: 'c', text: 'Third task', status: 'todo' },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toEqual([
      { id: 'a', label: 'First task', status: 'done', orderIndex: 0 },
      { id: 'b', label: 'Second task', status: 'blocked', orderIndex: 1 },
      { id: 'c', label: 'Third task', status: 'todo', orderIndex: 2 },
    ]);
  });

  it('represents all supported status types correctly', () => {
    const todos = [
      { id: 'todo-1', text: 'Todo task', status: 'todo' },
      { id: 'done-1', text: 'Done task', status: 'done' },
      { id: 'cancelled-1', text: 'Cancelled task', status: 'cancelled' },
      {
        id: 'blocked-1',
        text: 'Blocked task',
        status: 'blocked',
        blockedBy: ['todo-1'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toEqual([
      { id: 'todo-1', label: 'Todo task', status: 'todo', orderIndex: 0 },
      { id: 'done-1', label: 'Done task', status: 'done', orderIndex: 1 },
      {
        id: 'cancelled-1',
        label: 'Cancelled task',
        status: 'cancelled',
        orderIndex: 2,
      },
      {
        id: 'blocked-1',
        label: 'Blocked task',
        status: 'blocked',
        orderIndex: 3,
      },
    ]);
  });
});

describe('buildDependencyGraph — Edge mapping', () => {
  it('creates one edge from blocker to blocked todo', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: 'task-a',
      to: 'task-b',
    });
    expect(result.edges[0].id).toBeDefined();
  });

  it('creates multiple edges when one todo has multiple blockers', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      { id: 'task-b', text: 'Task B', status: 'todo' },
      {
        id: 'task-c',
        text: 'Task C',
        status: 'blocked',
        blockedBy: ['task-a', 'task-b'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges).toHaveLength(2);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'task-a', to: 'task-c' }),
        expect.objectContaining({ from: 'task-b', to: 'task-c' }),
      ]),
    );
  });

  it('creates correct edges for multiple blocked todos', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      { id: 'task-b', text: 'Task B', status: 'todo' },
      {
        id: 'task-c',
        text: 'Task C',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
      {
        id: 'task-d',
        text: 'Task D',
        status: 'blocked',
        blockedBy: ['task-a', 'task-b'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges).toHaveLength(3);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'task-a', to: 'task-c' }),
        expect.objectContaining({ from: 'task-a', to: 'task-d' }),
        expect.objectContaining({ from: 'task-b', to: 'task-d' }),
      ]),
    );
  });

  it('creates edges from in-progress blockers the same as todo blockers', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'inprogress' },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges).toEqual([
      expect.objectContaining({ from: 'task-a', to: 'task-b' }),
    ]);
    expect(result.nodes).toEqual([
      {
        id: 'task-a',
        label: 'Task A',
        status: 'inprogress',
        orderIndex: 0,
      },
      {
        id: 'task-b',
        label: 'Task B',
        status: 'blocked',
        orderIndex: 1,
      },
    ]);
  });

  it('handles non-existent blocker ids without crashing', () => {
    const todos = [
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['missing-task'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toEqual([
      { id: 'task-b', label: 'Task B', status: 'blocked', orderIndex: 0 },
    ]);
    expect([0, 1]).toContain(result.edges.length);

    if (result.edges.length === 1) {
      expect(result.edges[0]).toMatchObject({
        from: 'missing-task',
        to: 'task-b',
      });
    }

    expect(result.hasDependencies).toBe(result.edges.length > 0);
    expect(result.stats.edgeCount).toBe(result.edges.length);
  });

  it('handles self-referencing blockers gracefully', () => {
    const todos = [
      {
        id: 'task-a',
        text: 'Task A',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toEqual([
      { id: 'task-a', label: 'Task A', status: 'blocked', orderIndex: 0 },
    ]);
    expect(result.edges).toEqual([
      expect.objectContaining({ from: 'task-a', to: 'task-a' }),
    ]);
  });
});

describe('buildDependencyGraph — hasDependencies', () => {
  it('is false when no todo has blockers', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      { id: 'task-b', text: 'Task B', status: 'done' },
      { id: 'task-c', text: 'Task C', status: 'cancelled' },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges).toEqual([]);
    expect(result.hasDependencies).toBe(false);
  });

  it('is true when at least one edge exists', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.hasDependencies).toBe(true);
  });

  it('is false when a blocked todo has an empty blockedBy array', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'blocked', blockedBy: [] },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.edges).toEqual([]);
    expect(result.hasDependencies).toBe(false);
  });
});

describe('buildDependencyGraph — Cycle detection', () => {
  it('detects a simple two-node cycle and reports both edges', () => {
    const todos = [
      {
        id: 'task-a',
        text: 'Task A',
        status: 'blocked',
        blockedBy: ['task-b'],
      },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.cycleEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'task-a', to: 'task-b' }),
        expect.objectContaining({ from: 'task-b', to: 'task-a' }),
      ]),
    );
    expect(result.cycleEdges).toHaveLength(2);
  });

  it('detects a three-node cycle and reports all edges in the cycle', () => {
    const todos = [
      {
        id: 'task-a',
        text: 'Task A',
        status: 'blocked',
        blockedBy: ['task-c'],
      },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
      {
        id: 'task-c',
        text: 'Task C',
        status: 'blocked',
        blockedBy: ['task-b'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.cycleEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'task-c', to: 'task-a' }),
        expect.objectContaining({ from: 'task-a', to: 'task-b' }),
        expect.objectContaining({ from: 'task-b', to: 'task-c' }),
      ]),
    );
    expect(result.cycleEdges).toHaveLength(3);
  });

  it('detects only the cyclic edges in a partial cycle', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a', 'task-c'],
      },
      {
        id: 'task-c',
        text: 'Task C',
        status: 'blocked',
        blockedBy: ['task-b'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.cycleEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'task-c', to: 'task-b' }),
        expect.objectContaining({ from: 'task-b', to: 'task-c' }),
      ]),
    );
    expect(result.cycleEdges).toHaveLength(2);
    expect(result.cycleEdges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'task-a', to: 'task-b' }),
      ]),
    );
  });

  it('returns an empty cycleEdges array when no cycle exists', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
      {
        id: 'task-c',
        text: 'Task C',
        status: 'blocked',
        blockedBy: ['task-b'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.cycleEdges).toEqual([]);
  });

  it('treats a self-reference as a cycle edge', () => {
    const todos = [
      {
        id: 'task-a',
        text: 'Task A',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.cycleEdges).toEqual([
      expect.objectContaining({ from: 'task-a', to: 'task-a' }),
    ]);
  });
});

describe('buildDependencyGraph — Stats', () => {
  it('reports nodeCount equal to the number of todos', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      { id: 'task-b', text: 'Task B', status: 'done' },
      { id: 'task-c', text: 'Task C', status: 'cancelled' },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.stats.nodeCount).toBe(3);
  });

  it('reports edgeCount equal to the total number of edges', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      { id: 'task-b', text: 'Task B', status: 'todo' },
      {
        id: 'task-c',
        text: 'Task C',
        status: 'blocked',
        blockedBy: ['task-a', 'task-b'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.stats.edgeCount).toBe(result.edges.length);
    expect(result.stats.edgeCount).toBe(2);
  });

  it('reports cycleCount equal to the number of cycle edges', () => {
    const todos = [
      {
        id: 'task-a',
        text: 'Task A',
        status: 'blocked',
        blockedBy: ['task-b'],
      },
      {
        id: 'task-b',
        text: 'Task B',
        status: 'blocked',
        blockedBy: ['task-a'],
      },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.stats.cycleCount).toBe(result.cycleEdges.length);
    expect(result.stats.cycleCount).toBe(2);
  });
});

describe('buildDependencyGraph — Larger graphs', () => {
  it('builds the correct structure for a larger mixed dependency graph', () => {
    const todos = [
      { id: 't1', text: 'Task 1', status: 'todo' },
      { id: 't2', text: 'Task 2', status: 'blocked', blockedBy: ['t1'] },
      { id: 't3', text: 'Task 3', status: 'blocked', blockedBy: ['t1', 't2'] },
      { id: 't4', text: 'Task 4', status: 'done' },
      { id: 't5', text: 'Task 5', status: 'blocked', blockedBy: ['t2'] },
      { id: 't6', text: 'Task 6', status: 'cancelled' },
      { id: 't7', text: 'Task 7', status: 'todo' },
      { id: 't8', text: 'Task 8', status: 'blocked', blockedBy: ['t3', 't7'] },
      { id: 't9', text: 'Task 9', status: 'todo' },
      {
        id: 't10',
        text: 'Task 10',
        status: 'blocked',
        blockedBy: ['t8', 't9'],
      },
      { id: 't11', text: 'Task 11', status: 'todo' },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toHaveLength(11);
    expect(result.edges).toHaveLength(8);
    expect(result.hasDependencies).toBe(true);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 't1', to: 't2' }),
        expect.objectContaining({ from: 't1', to: 't3' }),
        expect.objectContaining({ from: 't2', to: 't3' }),
        expect.objectContaining({ from: 't2', to: 't5' }),
        expect.objectContaining({ from: 't3', to: 't8' }),
        expect.objectContaining({ from: 't7', to: 't8' }),
        expect.objectContaining({ from: 't8', to: 't10' }),
        expect.objectContaining({ from: 't9', to: 't10' }),
      ]),
    );
    expect(result.stats).toEqual({
      nodeCount: 11,
      edgeCount: 8,
      cycleCount: 0,
    });
  });

  it('creates no edges for todos without a blockedBy field', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'blocked' },
      { id: 'task-b', text: 'Task B', status: 'todo' },
      { id: 'task-c', text: 'Task C', status: 'done' },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toEqual([]);
    expect(result.hasDependencies).toBe(false);
  });

  it('returns only nodes when all todos are isolated', () => {
    const todos = [
      { id: 'task-a', text: 'Task A', status: 'todo' },
      { id: 'task-b', text: 'Task B', status: 'blocked', blockedBy: [] },
      { id: 'task-c', text: 'Task C', status: 'done' },
      { id: 'task-d', text: 'Task D', status: 'cancelled' },
    ];

    const result = buildDependencyGraph(todos);

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toEqual([]);
    expect(result.cycleEdges).toEqual([]);
    expect(result.hasDependencies).toBe(false);
    expect(result.stats).toEqual({
      nodeCount: 4,
      edgeCount: 0,
      cycleCount: 0,
    });
  });
});
