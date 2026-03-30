export const TODO_STATUS = Object.freeze({
  TODO: 'todo',
  IN_PROGRESS: 'inprogress',
  DONE: 'done',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
});

export const TODO_STATUS_VALUES = Object.freeze([
  TODO_STATUS.TODO,
  TODO_STATUS.IN_PROGRESS,
  TODO_STATUS.DONE,
  TODO_STATUS.CANCELLED,
  TODO_STATUS.BLOCKED,
]);

export const ACTIONABLE_TODO_STATUSES = Object.freeze([
  TODO_STATUS.TODO,
  TODO_STATUS.IN_PROGRESS,
]);

export const EDITABLE_TODO_STATUSES = Object.freeze([
  ...ACTIONABLE_TODO_STATUSES,
  TODO_STATUS.BLOCKED,
]);

export const TERMINAL_TODO_STATUSES = Object.freeze([
  TODO_STATUS.DONE,
  TODO_STATUS.CANCELLED,
]);

export const TOGGLEABLE_TODO_STATUSES = Object.freeze([
  TODO_STATUS.TODO,
  TODO_STATUS.IN_PROGRESS,
  TODO_STATUS.DONE,
]);

export const BLOCKER_SOURCE_TODO_STATUSES = Object.freeze([
  TODO_STATUS.TODO,
  TODO_STATUS.IN_PROGRESS,
  TODO_STATUS.BLOCKED,
]);

export const TODO_STATUS_CYCLE = Object.freeze({
  [TODO_STATUS.TODO]: TODO_STATUS.IN_PROGRESS,
  [TODO_STATUS.IN_PROGRESS]: TODO_STATUS.DONE,
  [TODO_STATUS.DONE]: TODO_STATUS.TODO,
  [TODO_STATUS.CANCELLED]: TODO_STATUS.TODO,
});

export const TODO_STATUS_META = Object.freeze({
  [TODO_STATUS.TODO]: Object.freeze({
    value: TODO_STATUS.TODO,
    label: 'To Do',
    metricLabel: 'To Do',
  }),
  [TODO_STATUS.IN_PROGRESS]: Object.freeze({
    value: TODO_STATUS.IN_PROGRESS,
    label: 'In Progress',
    metricLabel: 'In Progress',
  }),
  [TODO_STATUS.DONE]: Object.freeze({
    value: TODO_STATUS.DONE,
    label: 'Done',
    metricLabel: 'done',
  }),
  [TODO_STATUS.CANCELLED]: Object.freeze({
    value: TODO_STATUS.CANCELLED,
    label: 'Cancelled',
    metricLabel: 'cancelled',
  }),
  [TODO_STATUS.BLOCKED]: Object.freeze({
    value: TODO_STATUS.BLOCKED,
    label: 'Blocked',
    metricLabel: 'blocked',
  }),
});

export const TODO_STATUS_OPTIONS = Object.freeze(
  TODO_STATUS_VALUES.map((status) =>
    Object.freeze({
      value: status,
      label: TODO_STATUS_META[status].label,
    }),
  ),
);

export const ACTIONABLE_TODO_STATUS_SUMMARY_LABEL =
  ACTIONABLE_TODO_STATUSES.map((status) => TODO_STATUS_META[status].label).join(
    ' or ',
  );

const DEFAULT_TODO_STATUS_PALETTE = Object.freeze({
  fill: '#ffffff',
  border: '#e0e0e0',
  accent: null,
  text: '#1a1a1a',
  opacity: '1',
  strike: null,
});

export const TODO_STATUS_PALETTE = Object.freeze({
  default: DEFAULT_TODO_STATUS_PALETTE,
  [TODO_STATUS.TODO]: DEFAULT_TODO_STATUS_PALETTE,
  [TODO_STATUS.IN_PROGRESS]: Object.freeze({
    fill: 'rgba(33, 150, 243, 0.08)',
    border: '#90caf9',
    accent: '#2196f3',
    text: '#1a1a1a',
    opacity: '1',
    strike: null,
  }),
  [TODO_STATUS.DONE]: Object.freeze({
    fill: 'rgba(76, 175, 80, 0.08)',
    border: '#4caf50',
    accent: '#4caf50',
    text: '#5f6f62',
    opacity: '1',
    strike: 'rgba(95, 111, 98, 0.7)',
  }),
  [TODO_STATUS.CANCELLED]: Object.freeze({
    fill: 'rgba(192, 57, 43, 0.08)',
    border: '#d7a8a3',
    accent: '#c0392b',
    text: '#c0392b',
    opacity: '0.8',
    strike: '#c0392b',
  }),
  [TODO_STATUS.BLOCKED]: Object.freeze({
    fill: '#fffbf0',
    border: '#e6d5b8',
    accent: '#e67e22',
    text: '#1a1a1a',
    opacity: '1',
    strike: null,
  }),
});

export const APP_PALETTE = Object.freeze({
  DAG_ARROW_DEFAULT: '#9aa1aa',
  DAG_ARROW_HIGHLIGHT: '#4a90d9',
  DAG_ARROW_CYCLE: '#d64541',
  DAG_EDGE_DEFAULT: '#9aa1aa',
  DAG_EDGE_HIGHLIGHT: '#4a90d9',
  DAG_EDGE_CYCLE: '#d64541',
});

export const DESIGN_RADII = Object.freeze({
  CONTROL: 6,
  SURFACE: 8,
  PILL: 999,
});

export const CONFETTI_COLORS = Object.freeze([
  APP_PALETTE.DAG_ARROW_HIGHLIGHT,
  TODO_STATUS_PALETTE[TODO_STATUS.DONE].accent,
  '#f59e0b',
  TODO_STATUS_PALETTE[TODO_STATUS.CANCELLED].accent,
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#ec4899',
]);

const STATUS_CSS_VARIABLES = Object.freeze(
  Object.freeze(
    Object.fromEntries(
      TODO_STATUS_VALUES.flatMap((status) => {
        const palette = TODO_STATUS_PALETTE[status];
        return [
          [`--status-${status}-fill`, palette.fill],
          [`--status-${status}-border`, palette.border],
          [`--status-${status}-accent`, palette.accent ?? palette.border],
          [`--status-${status}-text`, palette.text],
          [`--status-${status}-opacity`, palette.opacity],
          [`--status-${status}-strike`, palette.strike ?? 'transparent'],
        ];
      }),
    ),
  ),
);

export function applyRootDesignTokens(root) {
  if (!root) {
    return;
  }

  Object.entries(STATUS_CSS_VARIABLES).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

export const APP_STORAGE_KEYS = Object.freeze({
  TODOS: 'todos',
  READY_FILTER: 'bumbledo_filter_ready',
  LEGACY_ACTIONABLE_FILTER: 'bumbledo_filter_actionable',
  SHORTCUTS_TIP_DISMISSED: 'bumbledo_tip_shortcuts_dismissed',
  REORDER_TIP_DISMISSED: 'bumbledo_tip_reorder_dismissed',
});

export function getTodoStatusLabel(status) {
  return TODO_STATUS_META[status]?.label ?? status;
}

export function getTodoStatusPalette(status) {
  return TODO_STATUS_PALETTE[status] ?? TODO_STATUS_PALETTE.default;
}
