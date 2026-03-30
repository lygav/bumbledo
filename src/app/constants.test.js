import { describe, expect, it, vi } from 'vitest';
import * as constants from './constants.js';
import {
  cycleStatus,
  loadBurndownData,
  loadTodos,
  saveBurndownData,
  saveTodos,
  setStatus,
  takeBurndownSample,
} from '../todo/model.js';

const EXPECTED_STATUS_VALUES = [
  'todo',
  'inprogress',
  'done',
  'cancelled',
  'blocked',
];

const EXPECTED_STATUS_LABELS = {
  todo: 'To Do',
  inprogress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
};

const EXPECTED_STATUS_PALETTE = {
  todo: {
    fill: '#ffffff',
    border: '#e0e0e0',
    accent: null,
    text: '#1a1a1a',
    opacity: '1',
    strike: null,
  },
  inprogress: {
    fill: 'rgba(33, 150, 243, 0.08)',
    border: '#90caf9',
    accent: '#2196f3',
    text: '#1a1a1a',
    opacity: '1',
    strike: null,
  },
  done: {
    fill: 'rgba(76, 175, 80, 0.08)',
    border: '#4caf50',
    accent: '#4caf50',
    text: '#5f6f62',
    opacity: '1',
    strike: 'rgba(95, 111, 98, 0.7)',
  },
  cancelled: {
    fill: 'rgba(192, 57, 43, 0.08)',
    border: '#d7a8a3',
    accent: '#c0392b',
    text: '#c0392b',
    opacity: '0.8',
    strike: '#c0392b',
  },
  blocked: {
    fill: '#fffbf0',
    border: '#e6d5b8',
    accent: '#e67e22',
    text: '#1a1a1a',
    opacity: '1',
    strike: null,
  },
};

const EXPECTED_STORAGE_KEYS = {
  TODOS: 'todos',
  READY_FILTER: 'bumbledo_filter_ready',
  LEGACY_ACTIONABLE_FILTER: 'bumbledo_filter_actionable',
  BURNDOWN: 'todos_burndown',
  SHORTCUTS_TIP_DISMISSED: 'bumbledo_tip_shortcuts_dismissed',
  REORDER_TIP_DISMISSED: 'bumbledo_tip_reorder_dismissed',
};

function resolveExport(candidateNames, description) {
  for (const name of candidateNames) {
    if (name in constants) {
      return constants[name];
    }
  }

  throw new Error(
    `constants.js must export ${description} (${candidateNames.join(' or ')})`,
  );
}

function getStatusValues() {
  const exported = resolveExport(
    [
      'TODO_STATUS_VALUES',
      'TODO_STATUS',
      'STATUSES',
      'STATUS_VALUES',
      'TODO_STATUSES',
    ],
    'a shared status vocabulary',
  );

  if (Array.isArray(exported)) {
    return exported;
  }

  if (exported && typeof exported === 'object') {
    return Object.values(exported);
  }

  throw new TypeError(
    'The shared status vocabulary must be an array or object of string values.',
  );
}

function getStatusLabels() {
  const exported = resolveExport(
    [
      'TODO_STATUS_LABELS',
      'STATUS_LABELS',
      'TODO_STATUS_META',
      'TODO_STATUS_OPTIONS',
    ],
    'a status label map',
  );

  if (Array.isArray(exported)) {
    return Object.fromEntries(
      exported.map(({ value, label }) => [value, label]),
    );
  }

  if (exported && typeof exported === 'object') {
    const firstValue = Object.values(exported)[0];
    if (firstValue && typeof firstValue === 'object' && 'label' in firstValue) {
      return Object.fromEntries(
        Object.entries(exported).map(([status, meta]) => [status, meta.label]),
      );
    }
  }

  return exported;
}

function getStatusPalette() {
  return resolveExport(
    ['TODO_STATUS_PALETTE', 'STATUS_PALETTE'],
    'a status palette map',
  );
}

function getStorageKeys() {
  return resolveExport(
    ['APP_STORAGE_KEYS', 'STORAGE_KEYS', 'LOCAL_STORAGE_KEYS'],
    'a storage key map',
  );
}

describe('app constants contract', () => {
  describe('status completeness', () => {
    it('exports every expected status value as a unique string', () => {
      const statusValues = getStatusValues();

      expect(statusValues).toHaveLength(EXPECTED_STATUS_VALUES.length);
      expect([...statusValues].sort()).toEqual(
        [...EXPECTED_STATUS_VALUES].sort(),
      );
      expect(statusValues.every((status) => typeof status === 'string')).toBe(
        true,
      );
      expect(new Set(statusValues).size).toBe(statusValues.length);
    });
  });

  describe('status consistency with model.js', () => {
    it('uses the exported status vocabulary for model transitions and sampling', () => {
      const [
        todoStatus,
        inProgressStatus,
        doneStatus,
        cancelledStatus,
        blockedStatus,
      ] = EXPECTED_STATUS_VALUES;
      const statusValues = getStatusValues();
      const original = [
        { id: 'task-1', text: 'Write constants tests', status: todoStatus },
      ];

      statusValues.forEach((status) => {
        const updated = setStatus(original, 'task-1', status);
        expect(updated[0].status).toBe(status);
      });

      expect(setStatus(original, 'task-1', 'active')).toBe(original);

      expect(
        cycleStatus(
          [{ id: 'todo', text: 'Todo task', status: todoStatus }],
          'todo',
        )[0].status,
      ).toBe(inProgressStatus);
      expect(
        cycleStatus(
          [{ id: 'doing', text: 'In progress task', status: inProgressStatus }],
          'doing',
        )[0].status,
      ).toBe(doneStatus);
      expect(
        cycleStatus(
          [{ id: 'done', text: 'Done task', status: doneStatus }],
          'done',
        )[0].status,
      ).toBe(todoStatus);
      expect(
        cycleStatus(
          [
            {
              id: 'cancelled',
              text: 'Cancelled task',
              status: cancelledStatus,
            },
          ],
          'cancelled',
        )[0].status,
      ).toBe(todoStatus);
      expect(
        cycleStatus(
          [
            {
              id: 'blocked',
              text: 'Blocked task',
              status: blockedStatus,
              blockedBy: ['blocker-1'],
            },
          ],
          'blocked',
        )[0].status,
      ).toBe(blockedStatus);

      const sample = takeBurndownSample([
        { id: 'todo', text: 'Todo task', status: todoStatus },
        { id: 'doing', text: 'In progress task', status: inProgressStatus },
        { id: 'done', text: 'Done task', status: doneStatus },
        { id: 'cancelled', text: 'Cancelled task', status: cancelledStatus },
        {
          id: 'blocked',
          text: 'Blocked task',
          status: blockedStatus,
          blockedBy: ['todo'],
        },
      ]);

      expect(sample).toMatchObject({
        done: 1,
        cancelled: 1,
        todo: 2,
        total: 5,
      });
    });
  });

  describe('palette completeness', () => {
    it('defines a palette entry for every supported status', () => {
      const statusValues = [...getStatusValues()].sort();
      const palette = getStatusPalette();

      statusValues.forEach((status) => {
        expect(palette).toHaveProperty(status);
        expect(palette[status]).toEqual(EXPECTED_STATUS_PALETTE[status]);
      });

      if ('default' in palette) {
        expect(palette.default).toEqual(EXPECTED_STATUS_PALETTE.todo);
      }
    });
  });

  describe('label completeness', () => {
    it('defines a display label for every supported status', () => {
      const statusValues = [...getStatusValues()].sort();
      const labels = getStatusLabels();

      expect(Object.keys(labels).sort()).toEqual(statusValues);
      expect(labels).toEqual(EXPECTED_STATUS_LABELS);
    });
  });

  describe('storage keys', () => {
    it('defines every localStorage key as a unique string', () => {
      const storageKeys = getStorageKeys();
      const values = Object.values(storageKeys);

      expect(storageKeys).toMatchObject(EXPECTED_STORAGE_KEYS);
      expect(values.every((value) => typeof value === 'string')).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    });

    it('provides canonical storage keys that the model helpers accept directly', () => {
      const storageKeys = getStorageKeys();
      const storage = {
        getItem: vi.fn().mockReturnValue('[]'),
        setItem: vi.fn(),
      };

      loadTodos(storage, storageKeys.TODOS);
      saveTodos(
        [{ id: 'task-1', text: 'Persist me', status: 'todo' }],
        storage,
        storageKeys.TODOS,
      );
      loadBurndownData(storage, storageKeys.BURNDOWN);
      saveBurndownData([], storage, storageKeys.BURNDOWN);

      expect(storage.getItem).toHaveBeenCalledWith(storageKeys.TODOS);
      expect(storage.getItem).toHaveBeenCalledWith(storageKeys.BURNDOWN);
      expect(storage.setItem).toHaveBeenCalledWith(
        storageKeys.TODOS,
        JSON.stringify([{ id: 'task-1', text: 'Persist me', status: 'todo' }]),
      );
      expect(storage.setItem).toHaveBeenCalledWith(
        storageKeys.BURNDOWN,
        JSON.stringify([]),
      );
    });
  });

  describe('no duplication contract', () => {
    it('keeps labels and palette keyed from the same exported status vocabulary', () => {
      const statusValues = [...getStatusValues()].sort();
      const labels = getStatusLabels();
      const palette = getStatusPalette();

      expect(Object.keys(labels).sort()).toEqual(statusValues);
      statusValues.forEach((status) => {
        expect(palette).toHaveProperty(status);
      });
    });
  });
});
