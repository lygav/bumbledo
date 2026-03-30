import { TODO_STATUS, TODO_STATUS_META } from '../app/constants.js';

const STATUS_PILL_TONE_CLASS = {
  ready: 'is-ready',
  inprogress: 'is-inprogress',
  blocked: 'is-blocked',
  done: 'is-done',
};

export function buildStatusMetricItems(progress) {
  return [
    {
      count: progress.todo,
      label: TODO_STATUS_META[TODO_STATUS.TODO].metricLabel,
      tone: 'ready',
    },
    {
      count: progress.inProgress,
      label: TODO_STATUS_META[TODO_STATUS.IN_PROGRESS].metricLabel,
      tone: 'inprogress',
    },
    {
      count: progress.blocked,
      label: TODO_STATUS_META[TODO_STATUS.BLOCKED].metricLabel,
      tone: 'blocked',
    },
    {
      count: progress.done,
      label: TODO_STATUS_META[TODO_STATUS.DONE].metricLabel,
      tone: 'done',
    },
  ];
}

function buildStatusMetricText(items) {
  return items
    .map((item) => item.text ?? `${item.count} ${item.label}`)
    .join(' · ');
}

function createStatusPill(item) {
  const pill = document.createElement('span');
  const toneClass =
    STATUS_PILL_TONE_CLASS[item.tone] ?? STATUS_PILL_TONE_CLASS.ready;
  pill.className = `status-pill ${toneClass}`;

  if (item.text) {
    pill.textContent = item.text;
    return pill;
  }

  const count = document.createElement('span');
  count.className = 'status-pill-count';
  count.textContent = String(item.count);

  const label = document.createElement('span');
  label.className = 'status-pill-label';
  label.textContent = item.label;

  pill.append(count, label);
  return pill;
}

export function renderStatusMetricLine(container, items) {
  if (!container) {
    return;
  }

  container.replaceChildren(...items.map(createStatusPill));
  container.setAttribute('aria-label', buildStatusMetricText(items));
}
