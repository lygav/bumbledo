import { createDagView } from './dag/view.js';
import { buildDependencyGraph } from './dag/graph.js';
import { createNotificationController } from './todo/notification.js';
import {
  addTodo,
  cleanupBlockedBy,
  clearFinished,
  cycleStatus,
  detectUnblockedTodos,
  finalizeBlockedStatus,
  deleteTodo,
  getActionableTodos as getReadyTodos,
  getActiveBlockerCount,
  hasActiveBlockers,
  hasDependencies,
  loadBurndownData,
  loadTodos,
  reorderTodos,
  saveTodos,
  saveBurndownData,
  setStatus,
  shouldSampleToday,
  takeBurndownSample,
  toggleBlocker,
  updateTodoText
} from './todo/model.js';

// OWNERSHIP: main.js is the orchestrator.
// - Owns: todos state, persistence, selectedTaskId, section visibility
// - Owns: #dag-toggle, #dag-summary, #dag-empty-state, #dependency-graph-section
// - dag/view.js owns only SVG rendering inside #dependency-graph container

const READY_FILTER_STORAGE_KEY = 'bumbledo_filter_ready';
const LEGACY_ACTIONABLE_FILTER_STORAGE_KEY = 'bumbledo_filter_actionable';
const BURNDOWN_STORAGE_KEY = 'todos_burndown';
const SHORTCUTS_TIP_STORAGE_KEY = 'bumbledo_tip_shortcuts_dismissed';
const REORDER_TIP_STORAGE_KEY = 'bumbledo_tip_reorder_dismissed';
const BURNDOWN_TOTAL_COLOR = '#4a90d9';
const BURNDOWN_COMPLETED_COLOR = '#2f8f63';
const BURNDOWN_GAP_COLOR = 'rgba(74, 144, 217, 0.12)';
const CONFETTI_COLORS = ['#4a90d9', '#2f8f63', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899'];
const CONFETTI_COUNT = 52;
const CONFETTI_MIN_DURATION_MS = 2000;
const CONFETTI_MAX_DURATION_MS = 3000;
const STATUS_PILL_TONE_CLASS = {
  total: 'is-total',
  ready: 'is-ready',
  inprogress: 'is-inprogress',
  blocked: 'is-blocked',
  done: 'is-done',
  trend: 'is-trend',
  'trend-up': 'is-trend-up',
  'trend-down': 'is-trend-down'
};

function isActionableStatus(status) {
  return status === 'todo' || status === 'inprogress';
}

function parseBurndownDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatBurndownDate(dateKey, options) {
  return new Intl.DateTimeFormat(undefined, options).format(parseBurndownDate(dateKey));
}

function buildBurndownSeries(samples) {
  let completedMax = 0;
  let totalMax = 0;

  return samples.map((sample) => {
    const completed = sample.done + sample.cancelled;
    completedMax = Math.max(completedMax, completed);
    totalMax = Math.max(totalMax, sample.total, completedMax);

    return {
      ...sample,
      completed: completedMax,
      total: totalMax
    };
  });
}

function getLiveProgressCounts(todos) {
  const total = todos.length;
  const todo = todos.filter(item => item.status === 'todo').length;
  const inProgress = todos.filter(item => item.status === 'inprogress').length;
  const blocked = todos.filter(item => item.status === 'blocked').length;
  const sample = takeBurndownSample(todos);
  const done = sample.done + sample.cancelled;
  const actionable = todo + inProgress;
  const completionPercent = total > 0 ? (done / total) * 100 : 0;
  const blockedPercent = total > 0 ? (blocked / total) * 100 : 0;

  return {
    total,
    todo,
    inProgress,
    actionable,
    blocked,
    done,
    completionPercent,
    completionPercentRounded: Math.round(completionPercent),
    blockedPercent
  };
}

function getBurndownTrend(samples, currentDone) {
  const previousSample = samples.length >= 2 ? samples[samples.length - 2] : null;
  if (!previousSample) {
    return { symbol: '→', tone: 'trend' };
  }

  const previousDone = previousSample.done + previousSample.cancelled;
  if (currentDone > previousDone) {
    return { symbol: '↑', tone: 'trend-up' };
  }

  if (currentDone < previousDone) {
    return { symbol: '↓', tone: 'trend-down' };
  }

  return { symbol: '→', tone: 'trend' };
}

function buildStatusMetricItems(progress, { includeTotal = false, trend = null } = {}) {
  const items = [];

  if (includeTotal) {
    items.push({ count: progress.total, label: 'total', tone: 'total' });
  }

  items.push(
    { count: progress.todo, label: 'To Do', tone: 'ready' },
    { count: progress.inProgress, label: 'In Progress', tone: 'inprogress' },
    { count: progress.blocked, label: 'blocked', tone: 'blocked' },
    { count: progress.done, label: 'done', tone: 'done' }
  );

  if (trend) {
    items.push({ text: `trend: ${trend.symbol}`, tone: trend.tone });
  }

  return items;
}

function buildStatusMetricText(items) {
  return items.map(item => item.text ?? `${item.count} ${item.label}`).join(' · ');
}

function createStatusPill(item) {
  const pill = document.createElement('span');
  const toneClass = STATUS_PILL_TONE_CLASS[item.tone] ?? STATUS_PILL_TONE_CLASS.total;
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

function renderStatusMetricLine(container, items) {
  if (!container) {
    return;
  }

  container.replaceChildren(...items.map(createStatusPill));
  container.setAttribute('aria-label', buildStatusMetricText(items));
}

function buildBurndownPath(points) {
  if (points.length === 0) {
    return '';
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    return `${path} H ${point.x} V ${point.y}`;
  }, '');
}

function buildBurndownAreaPath(upperPoints, lowerPoints) {
  if (upperPoints.length === 0 || lowerPoints.length === 0) {
    return '';
  }

  const upperPath = buildBurndownPath(upperPoints);
  const reversedLower = [...lowerPoints].reverse();
  const lowerPath = reversedLower.reduce((path, point, index) => {
    if (index === 0) {
      return `${path} L ${point.x} ${point.y}`;
    }

    return `${path} H ${point.x} V ${point.y}`;
  }, upperPath);
  return `${lowerPath} Z`;
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 479px)').matches;
}

function loadReadyFilterPreference() {
  try {
    const storedPreference = localStorage.getItem(READY_FILTER_STORAGE_KEY);
    if (storedPreference !== null) {
      return storedPreference === 'true';
    }

    const legacyPreference = localStorage.getItem(LEGACY_ACTIONABLE_FILTER_STORAGE_KEY);
    if (legacyPreference !== null) {
      try {
        localStorage.setItem(READY_FILTER_STORAGE_KEY, legacyPreference);
        localStorage.removeItem(LEGACY_ACTIONABLE_FILTER_STORAGE_KEY);
      } catch {
        // Ignore storage migration failures so the UI stays usable.
      }

      return legacyPreference === 'true';
    }

    return false;
  } catch {
    return false;
  }
}

function saveReadyFilterPreference(isActive) {
  try {
    localStorage.setItem(READY_FILTER_STORAGE_KEY, String(isActive));
  } catch {
    // Ignore storage write failures so the UI stays usable.
  }
}

function loadTipDismissed(storageKey) {
  try {
    return localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

function dismissTip(storageKey) {
  try {
    localStorage.setItem(storageKey, 'true');
  } catch {
    // Ignore storage write failures so the UI stays usable.
  }
}

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
      || target.isContentEditable
  );
}

function getFocusableElements(container) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }

  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    return !element.hidden
      && !element.hasAttribute('disabled')
      && element.getAttribute('aria-hidden') !== 'true';
  });
}

// DOM initialization - runs on load
if (typeof document !== 'undefined') {
  (function init() {
    const todoList = document.getElementById('todo-list');
    const todoInput = document.getElementById('todo-input');
    const addForm = document.getElementById('add-form');
    const shortcutsTip = document.getElementById('shortcuts-tip');
    const shortcutsTipDismiss = document.getElementById('shortcuts-tip-dismiss');
    const unblockedNotification = document.getElementById('unblocked-notification');
    const unblockedNotificationMessage = document.getElementById('unblocked-notification-message');
    const unblockedNotificationDetail = document.getElementById('unblocked-notification-detail');
    const unblockedNotificationDismiss = document.getElementById('unblocked-notification-dismiss');
    const readyFilterToggle = document.getElementById('ready-filter-toggle');
    const readySummary = document.getElementById('ready-summary');
    const taskProgressSummary = document.getElementById('task-progress-summary');
    const taskProgressBar = document.querySelector('.task-progress-bar');
    const emptyState = document.getElementById('empty-state');
    const reorderTip = document.getElementById('reorder-tip');
    const reorderTipDismiss = document.getElementById('reorder-tip-dismiss');
    const burndownToggle = document.getElementById('burndown-toggle');
    const burndownCollapsedSummary = document.getElementById('burndown-collapsed-summary');
    const burndownPanel = document.getElementById('burndown-panel');
    const burndownSummaryHeadline = document.getElementById('burndown-summary-headline');
    const burndownEmptyState = document.getElementById('burndown-empty-state');
    const burndownChart = document.getElementById('burndown-chart');
    const burndownChartSvg = document.getElementById('burndown-chart-svg');
    const burndownTooltip = document.getElementById('burndown-tooltip');
    const clearFinishedBtn = document.getElementById('clear-finished-btn');
    const dagSection = document.getElementById('dependency-graph-section');
    const dagContainer = document.getElementById('dependency-graph');
    const dagSummary = document.getElementById('dag-summary');
    const dagEmptyState = document.getElementById('dag-empty-state');
    const dagToggle = document.getElementById('dag-toggle');
    const shortcutsHelpBtn = document.getElementById('shortcuts-help-btn');
    const shortcutsHelpModal = document.getElementById('shortcuts-help-modal');
    const shortcutsHelpClose = document.getElementById('shortcuts-help-close');
    const focusInputShortcut = document.getElementById('focus-input-shortcut');
    const blockedCompletionModal = document.getElementById('blocked-completion-modal');
    const blockedCompletionMessage = document.getElementById('blocked-completion-message');
    const blockedCompletionDismiss = document.getElementById('blocked-completion-dismiss');

    let todos = loadTodos();
    let burndownData = loadBurndownData();
    let selectedTaskId = null;
    let filterActive = loadReadyFilterPreference();
    let burndownExpanded = false;
    let dagExpanded = !isMobileViewport() && hasDependencies(todos);
    let dagToggleTouched = false;
    let flashTimeoutId = null;
    let editingId = null;
    let helpModalOpen = false;
    let helpModalReturnFocusEl = null;
    let blockedCompletionModalOpen = false;
    let blockedCompletionReturnFocusEl = null;
    let shortcutsTipDismissed = loadTipDismissed(SHORTCUTS_TIP_STORAGE_KEY);
    let reorderTipDismissed = loadTipDismissed(REORDER_TIP_STORAGE_KEY);
    let shortcutsTipShownThisSession = false;
    let reorderTipShownThisSession = false;

    const prefersMacKeys = isMacPlatform();
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (shouldSampleToday(burndownData)) {
      burndownData = saveBurndownData([...burndownData, takeBurndownSample(todos)], undefined, BURNDOWN_STORAGE_KEY);
    }

    if (focusInputShortcut) {
      focusInputShortcut.innerHTML = prefersMacKeys
        ? '<kbd>Cmd</kbd> <span>+</span> <kbd>Shift</kbd> <span>+</span> <kbd>A</kbd>'
        : '<kbd>Ctrl</kbd> <span>+</span> <kbd>Shift</kbd> <span>+</span> <kbd>A</kbd>';
    }

    const dagView = createDagView({
      container: dagContainer,
      onSelectTask: (id) => {
        selectedTaskId = id;
        syncTaskRowSelection();
        syncDagState();
        scrollTaskIntoView(id, true);
      }
    });

    saveTodos(todos);

    const notificationController = createNotificationController({
      onStateChange: () => {
        applyNotificationState();
        syncVisibleUnblockedHighlights();
      }
    });

    function getVisibleTodos() {
      return filterActive ? getReadyTodos(todos) : todos;
    }

    function applyNotificationState() {
      const notificationState = notificationController.getState();
      unblockedNotification.hidden = !notificationState.visible;
      unblockedNotificationMessage.textContent = notificationState.message;
      unblockedNotificationDetail.textContent = notificationState.detail;
    }

    function syncVisibleUnblockedHighlights() {
      [...todoList.querySelectorAll('li[data-id]')].forEach((taskElement) => {
        const remainingMs = notificationController.getHighlightRemainingMs(taskElement.dataset.id);
        if (remainingMs !== null && remainingMs > 0) {
          taskElement.classList.add('task-row-unblocked');
          taskElement.style.setProperty('--unblocked-delay', `${remainingMs - 3000}ms`);
          return;
        }

        taskElement.classList.remove('task-row-unblocked');
        taskElement.style.removeProperty('--unblocked-delay');
      });
    }

    function dismissUnblockedNotification({ clearHighlights = false } = {}) {
      notificationController.dismiss({ clearHighlights });
    }

    function dismissShortcutsTip() {
      if (shortcutsTipDismissed) return;
      shortcutsTipDismissed = true;
      dismissTip(SHORTCUTS_TIP_STORAGE_KEY);
      if (shortcutsTip) {
        shortcutsTip.hidden = true;
      }
    }

    function dismissReorderTip() {
      if (reorderTipDismissed) return;
      reorderTipDismissed = true;
      dismissTip(REORDER_TIP_STORAGE_KEY);
      if (reorderTip) {
        reorderTip.hidden = true;
      }
    }

    function syncDiscoverabilityTips() {
      if (shortcutsTip) {
        const shouldShowShortcutsTip = !shortcutsTipDismissed && todos.length >= 3;
        shortcutsTip.hidden = !shouldShowShortcutsTip;
        if (shouldShowShortcutsTip) {
          shortcutsTipShownThisSession = true;
        }
      }

      if (reorderTip) {
        const shouldShowReorderTip = !reorderTipDismissed
          && isTouchDevice
          && isMobileViewport()
          && todos.length > 0;
        reorderTip.hidden = !shouldShowReorderTip;
        if (shouldShowReorderTip) {
          reorderTipShownThisSession = true;
        }
      }
    }

    function getBlockedCompletionMessage(activeBlockerCount) {
      const dependencyLabel = activeBlockerCount === 1 ? 'dependency' : 'dependencies';
      return `Can't complete — this task has ${activeBlockerCount} ${dependencyLabel} remaining.`;
    }

    function openBlockedCompletionModal(message, returnFocusEl = null) {
      if (blockedCompletionModalOpen) {
        blockedCompletionMessage.textContent = message;
        return;
      }

      blockedCompletionReturnFocusEl = returnFocusEl ?? (
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      );
      blockedCompletionMessage.textContent = message;
      blockedCompletionModal.hidden = false;
      blockedCompletionModalOpen = true;
      blockedCompletionDismiss.focus();
    }

    function closeBlockedCompletionModal() {
      if (!blockedCompletionModalOpen) return;
      blockedCompletionModalOpen = false;
      blockedCompletionModal.hidden = true;
      if (blockedCompletionReturnFocusEl?.isConnected) {
        blockedCompletionReturnFocusEl.focus();
      }
      blockedCompletionReturnFocusEl = null;
    }

    function showBlockedCompletionNotification(todoId, returnFocusEl = null) {
      const activeBlockerCount = getActiveBlockerCount(todos, todoId);
      if (activeBlockerCount === 0) {
        return;
      }

      openBlockedCompletionModal(
        getBlockedCompletionMessage(activeBlockerCount),
        returnFocusEl
      );
    }

    function surfaceUnblockedTodos(todosBefore, todosAfter) {
      const unblockedIds = detectUnblockedTodos(todosBefore, todosAfter);
      if (unblockedIds.length === 0) {
        return;
      }

      notificationController.showUnblocked(
        unblockedIds
          .map(id => ({ id, name: todosAfter.find(todo => todo.id === id)?.text }))
          .filter(item => item.name)
      );
    }

    function findTaskElement(id) {
      return [...todoList.querySelectorAll('li[data-id]')].find(item => item.dataset.id === id) ?? null;
    }

    function focusTaskList() {
      todoList.focus();
    }

    function focusTaskRow(id) {
      const taskElement = findTaskElement(id);
      if (taskElement) {
        taskElement.focus();
      }
    }

    function syncTaskRowSelection() {
      const validSelection = todos.some(todo => todo.id === selectedTaskId);
      if (!validSelection) {
        selectedTaskId = null;
      }

      todoList.querySelectorAll('li[data-id]').forEach((item) => {
        const isSelected = item.dataset.id === selectedTaskId;
        item.classList.toggle('task-row-selected', isSelected);
        item.setAttribute('aria-selected', String(isSelected));
      });
    }

    function flashTaskRow(taskElement) {
      if (!taskElement) return;
      taskElement.classList.remove('task-row-flash');
      void taskElement.offsetWidth;
      taskElement.classList.add('task-row-flash');
      window.clearTimeout(flashTimeoutId);
      flashTimeoutId = window.setTimeout(() => {
        taskElement.classList.remove('task-row-flash');
      }, 1400);
    }

    function fireConfetti() {
      const viewportWidth = Math.max(window.innerWidth, 320);
      const viewportHeight = Math.max(window.innerHeight, 480);
      const burst = document.createElement('div');
      burst.className = 'confetti-burst';

      let remainingPieces = CONFETTI_COUNT;
      let longestAnimationMs = CONFETTI_MAX_DURATION_MS;
      let cleanupTimeoutId = null;

      function cleanupConfetti() {
        if (cleanupTimeoutId !== null) {
          window.clearTimeout(cleanupTimeoutId);
          cleanupTimeoutId = null;
        }

        burst.replaceChildren();
        burst.remove();
      }

      burst.addEventListener('animationend', (event) => {
        if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('confetti-piece')) {
          return;
        }

        event.target.remove();
        remainingPieces -= 1;
        if (remainingPieces <= 0) {
          cleanupConfetti();
        }
      });

      for (let index = 0; index < CONFETTI_COUNT; index += 1) {
        const piece = document.createElement('span');
        const isCircle = Math.random() > 0.55;
        const size = 6 + Math.random() * 6;
        const startX = Math.round(Math.random() * viewportWidth);
        const swayOneX = Math.round((Math.random() - 0.5) * 72);
        const swayTwoX = Math.round((Math.random() - 0.5) * 108);
        const endX = Math.round((Math.random() - 0.5) * 144);
        const endY = Math.round(viewportHeight + 72 + Math.random() * 64);
        const swayYOne = Math.round(endY * (0.32 + Math.random() * 0.08));
        const swayYTwo = Math.round(endY * (0.62 + Math.random() * 0.1));
        const rotationDirection = Math.random() > 0.5 ? 1 : -1;
        const baseRotation = (180 + Math.random() * 220) * rotationDirection;
        const startRotation = Math.round((Math.random() - 0.5) * 90);
        const midRotation = Math.round(startRotation + baseRotation * 0.45);
        const midRotationTwo = Math.round(startRotation + baseRotation * 0.8);
        const endRotation = Math.round(startRotation + baseRotation * (1.2 + Math.random() * 0.5));
        const durationMs = Math.round(CONFETTI_MIN_DURATION_MS + Math.random() * (CONFETTI_MAX_DURATION_MS - CONFETTI_MIN_DURATION_MS));
        const delayMs = Math.round(Math.random() * 220);
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const scale = (0.85 + Math.random() * 0.45).toFixed(2);
        const entryOffset = Math.round(18 + Math.random() * 36);

        longestAnimationMs = Math.max(longestAnimationMs, durationMs + delayMs);

        piece.className = `confetti-piece${isCircle ? ' is-circle' : ''}`;
        piece.style.backgroundColor = color;
        piece.style.left = `${startX}px`;
        piece.style.width = `${size}px`;
        piece.style.height = `${isCircle ? size : Math.max(4, size * 0.62)}px`;
        piece.style.setProperty('--confetti-scale', scale);
        piece.style.setProperty('--confetti-entry-offset', `${entryOffset}px`);
        piece.style.setProperty('--confetti-sway-x-one', `${swayOneX}px`);
        piece.style.setProperty('--confetti-sway-y-one', `${swayYOne}px`);
        piece.style.setProperty('--confetti-sway-x-two', `${swayTwoX}px`);
        piece.style.setProperty('--confetti-sway-y-two', `${swayYTwo}px`);
        piece.style.setProperty('--confetti-end-x', `${endX}px`);
        piece.style.setProperty('--confetti-end-y', `${endY}px`);
        piece.style.setProperty('--confetti-start-rotate', `${startRotation}deg`);
        piece.style.setProperty('--confetti-mid-rotate', `${midRotation}deg`);
        piece.style.setProperty('--confetti-mid-rotate-two', `${midRotationTwo}deg`);
        piece.style.setProperty('--confetti-end-rotate', `${endRotation}deg`);
        piece.style.setProperty('--confetti-duration', `${durationMs}ms`);
        piece.style.animationDelay = `${delayMs}ms`;
        burst.appendChild(piece);
      }

      document.body.appendChild(burst);
      cleanupTimeoutId = window.setTimeout(cleanupConfetti, longestAnimationMs + 120);
    }

    function scrollTaskIntoView(id, shouldFlash = false) {
      const taskElement = findTaskElement(id);
      if (!taskElement) return;
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (shouldFlash) {
        flashTaskRow(taskElement);
      }
    }

    function enterEditMode(id) {
      editingId = id;
      render();
      const input = document.querySelector(`li[data-id="${id}"] .edit-input`);
      if (input) {
        input.focus();
        input.select();
      }
    }

    function saveEdit(newText) {
      if (!editingId) return;
      const trimmed = newText.trim();
      if (!trimmed) return; // Reject empty: keep input focused
      todos = updateTodoText(todos, editingId, newText);
      saveTodos(todos);
      editingId = null;
      render();
    }

    function cancelEdit() {
      editingId = null;
      render();
    }

    function openHelpModal() {
      if (helpModalOpen) return;
      helpModalReturnFocusEl = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      helpModalOpen = true;
      shortcutsHelpModal.hidden = false;
      shortcutsHelpBtn.setAttribute('aria-expanded', 'true');
      shortcutsHelpClose.focus();
    }

    function closeHelpModal() {
      if (!helpModalOpen) return;
      helpModalOpen = false;
      shortcutsHelpModal.hidden = true;
      shortcutsHelpBtn.setAttribute('aria-expanded', 'false');
      if (helpModalReturnFocusEl?.isConnected) {
        helpModalReturnFocusEl.focus();
      }
      helpModalReturnFocusEl = null;
    }

    function clearSelection({ focusList = false } = {}) {
      selectedTaskId = null;
      syncTaskRowSelection();
      syncDagState();
      if (focusList) {
        focusTaskList();
      }
    }

    function selectTask(id, { focus = false, scroll = false, flash = false } = {}) {
      selectedTaskId = id;
      syncTaskRowSelection();
      syncDagState();

      if (scroll) {
        scrollTaskIntoView(id, flash);
      }

      if (focus) {
        focusTaskRow(id);
      }
    }

    function moveSelection(step) {
      const visibleTodos = getVisibleTodos();
      if (visibleTodos.length === 0) return;

      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTaskId);
      const nextIndex = currentIndex === -1
        ? (step > 0 ? 0 : visibleTodos.length - 1)
        : Math.max(0, Math.min(visibleTodos.length - 1, currentIndex + step));

      const nextTodo = visibleTodos[nextIndex];
      if (!nextTodo) return;

      selectTask(nextTodo.id, { focus: true, scroll: true });
    }

    function toggleSelectedTodoStatus() {
      const selectedTodo = todos.find(todo => todo.id === selectedTaskId);
      if (!selectedTodo) return;
      if (!['todo', 'inprogress', 'done'].includes(selectedTodo.status)) return;

      const visibleTodos = getVisibleTodos();
      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTodo.id);
      const nextStatus = selectedTodo.status === 'todo'
        ? 'inprogress'
        : selectedTodo.status === 'inprogress'
          ? 'done'
          : 'todo';
      const todosBefore = todos;
      todos = cycleStatus(todos, selectedTodo.id);
      if (nextStatus === 'done') {
        todos = cleanupBlockedBy(todos, selectedTodo.id);
        surfaceUnblockedTodos(todosBefore, todos);
      }
      saveTodos(todos);
      if (nextStatus === 'done') {
        fireConfetti();
      }
      render();

      const nextVisibleTodos = getVisibleTodos();
      if (nextVisibleTodos.some(todo => todo.id === selectedTodo.id)) {
        selectTask(selectedTodo.id, { focus: true, scroll: true });
        return;
      }

      const fallbackTodo = currentIndex === -1
        ? null
        : nextVisibleTodos[currentIndex] ?? nextVisibleTodos[currentIndex - 1] ?? null;

      if (fallbackTodo) {
        selectTask(fallbackTodo.id, { focus: true, scroll: true });
      } else {
        clearSelection({ focusList: true });
      }
    }

    function deleteSelectedTodo() {
      const visibleTodos = getVisibleTodos();
      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTaskId);
      const fallbackId = currentIndex === -1
        ? null
        : visibleTodos[currentIndex + 1]?.id ?? visibleTodos[currentIndex - 1]?.id ?? null;

      const todosBefore = todos;
      todos = deleteTodo(todos, selectedTaskId);
      surfaceUnblockedTodos(todosBefore, todos);
      saveTodos(todos);
      render();

      if (fallbackId && todos.some(todo => todo.id === fallbackId)) {
        selectTask(fallbackId, { focus: true, scroll: true });
      } else {
        clearSelection({ focusList: true });
      }
    }

    function hideBurndownTooltip() {
      burndownTooltip.hidden = true;
      burndownTooltip.textContent = '';
      burndownTooltip.style.left = '';
      burndownTooltip.style.top = '';
    }

    function showBurndownTooltip(point, viewBoxWidth, viewBoxHeight) {
      burndownTooltip.innerHTML = `
        <strong>${formatBurndownDate(point.date, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
        <div>Done: ${point.completed}</div>
        <div>Total: ${point.total}</div>
      `;
      burndownTooltip.hidden = false;

      const chartRect = burndownChart.getBoundingClientRect();
      const x = (point.x / viewBoxWidth) * chartRect.width;
      const y = (Math.min(point.completedY, point.totalY) / viewBoxHeight) * chartRect.height;

      const tooltipWidth = burndownTooltip.offsetWidth;
      const tooltipHeight = burndownTooltip.offsetHeight;
      const left = Math.max(8, Math.min(chartRect.width - tooltipWidth - 8, x - (tooltipWidth / 2)));
      const top = Math.max(8, y - tooltipHeight - 12);

      burndownTooltip.style.left = `${left}px`;
      burndownTooltip.style.top = `${top}px`;
    }

    function renderBurndownChart(series) {
      const mobile = isMobileViewport();
      const width = 640;
      const height = mobile ? 220 : 280;
      const margin = mobile
        ? { top: 20, right: 12, bottom: 34, left: 34 }
        : { top: 24, right: 20, bottom: 40, left: 42 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      const maxY = Math.max(1, ...series.map(point => point.total));
      const tickCount = maxY >= 6 ? 4 : 3;
      const yTicks = [...new Set(
        Array.from({ length: tickCount }, (_, index) => Math.round((maxY / (tickCount - 1)) * index))
      )];
      const xLabelEvery = Math.max(1, Math.ceil(series.length / (mobile ? 3 : 6)));
      const shouldShowXAxisLabel = (index) => (
        index === 0
        || index === series.length - 1
        || index % xLabelEvery === 0
      );
      const getX = (index) => (
        series.length === 1
          ? margin.left + (chartWidth / 2)
          : margin.left + ((chartWidth * index) / (series.length - 1))
      );
      const getY = (value) => margin.top + chartHeight - ((value / maxY) * chartHeight);

      const totalPoints = series.map((point, index) => ({
        ...point,
        x: getX(index),
        y: getY(point.total)
      }));
      const completedPoints = series.map((point, index) => ({
        ...point,
        x: getX(index),
        y: getY(point.completed)
      }));

      burndownChartSvg.innerHTML = '';
      burndownChartSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      burndownChartSvg.setAttribute('role', 'img');
      burndownChartSvg.setAttribute('aria-label', 'Burndown chart showing done work versus total work over time');

      yTicks.forEach((tick) => {
        const y = getY(tick);
        burndownChartSvg.appendChild(createSvgElement('line', {
          x1: margin.left,
          y1: y,
          x2: width - margin.right,
          y2: y,
          stroke: '#e3e8ef',
          'stroke-width': 1
        }));

        const tickLabel = createSvgElement('text', {
          x: margin.left - 8,
          y: y + 4,
          'text-anchor': 'end',
          fill: '#7c8798',
          'font-size': mobile ? 10 : 11
        });
        tickLabel.textContent = String(tick);
        burndownChartSvg.appendChild(tickLabel);
      });

      const gapArea = createSvgElement('path', {
        d: buildBurndownAreaPath(totalPoints, completedPoints),
        fill: BURNDOWN_GAP_COLOR,
        stroke: 'none'
      });
      burndownChartSvg.appendChild(gapArea);

      const totalLine = createSvgElement('path', {
        d: buildBurndownPath(totalPoints),
        fill: 'none',
        stroke: BURNDOWN_TOTAL_COLOR,
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      });
      burndownChartSvg.appendChild(totalLine);

      const completedLine = createSvgElement('path', {
        d: buildBurndownPath(completedPoints),
        fill: 'none',
        stroke: BURNDOWN_COMPLETED_COLOR,
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      });
      burndownChartSvg.appendChild(completedLine);

      totalPoints.forEach((point, index) => {
        const completedPoint = completedPoints[index];

        burndownChartSvg.appendChild(createSvgElement('circle', {
          cx: point.x,
          cy: point.y,
          r: 3.5,
          fill: '#fff',
          stroke: BURNDOWN_TOTAL_COLOR,
          'stroke-width': 2
        }));

        burndownChartSvg.appendChild(createSvgElement('circle', {
          cx: completedPoint.x,
          cy: completedPoint.y,
          r: 3.5,
          fill: '#fff',
          stroke: BURNDOWN_COMPLETED_COLOR,
          'stroke-width': 2
        }));

        if (shouldShowXAxisLabel(index)) {
          const xAxisLabel = createSvgElement('text', {
            x: point.x,
            y: height - 10,
            'text-anchor': 'middle',
            fill: '#7c8798',
            'font-size': mobile ? 10 : 11
          });
          xAxisLabel.textContent = formatBurndownDate(point.date, mobile
            ? { month: 'numeric', day: 'numeric' }
            : { month: 'short', day: 'numeric' });
          burndownChartSvg.appendChild(xAxisLabel);
        }

        const hitTarget = createSvgElement('rect', {
          x: point.x - Math.max(18, chartWidth / Math.max(8, series.length * 2)),
          y: margin.top,
          width: Math.max(36, chartWidth / Math.max(4, series.length)),
          height: chartHeight,
          fill: 'transparent',
          tabindex: 0,
          'aria-label': `${formatBurndownDate(point.date, { month: 'short', day: 'numeric', year: 'numeric' })}: ${completedPoint.completed} done, ${point.total} total`
        });

        const tooltipPoint = {
          ...point,
          completed: completedPoint.completed,
          completedY: completedPoint.y,
          totalY: point.y
        };

        hitTarget.addEventListener('mouseenter', () => showBurndownTooltip(tooltipPoint, width, height));
        hitTarget.addEventListener('focus', () => showBurndownTooltip(tooltipPoint, width, height));
        hitTarget.addEventListener('mouseleave', hideBurndownTooltip);
        hitTarget.addEventListener('blur', hideBurndownTooltip);
        burndownChartSvg.appendChild(hitTarget);
      });
    }

    function syncBurndownState() {
      const series = buildBurndownSeries(burndownData);
      const progress = getLiveProgressCounts(todos);
      const trend = getBurndownTrend(burndownData, progress.done);

      burndownToggle.setAttribute('aria-expanded', String(burndownExpanded));
      renderStatusMetricLine(
        burndownCollapsedSummary,
        buildStatusMetricItems(progress, { trend })
      );
      burndownCollapsedSummary.hidden = burndownExpanded;
      burndownPanel.hidden = !burndownExpanded;
      renderStatusMetricLine(
        burndownSummaryHeadline,
        buildStatusMetricItems(progress, { includeTotal: true })
      );

      const hasEnoughData = series.length >= 3;
      burndownEmptyState.hidden = hasEnoughData;
      burndownChart.hidden = !hasEnoughData;

      if (burndownExpanded && hasEnoughData) {
        renderBurndownChart(series);
      } else {
        burndownChartSvg.innerHTML = '';
        hideBurndownTooltip();
      }
    }

    function syncDagState() {
      const { hasDependencies: dependencyState, stats } = buildDependencyGraph(todos);

      if (!dagToggleTouched) {
        dagExpanded = dependencyState && !isMobileViewport();
      }

      if (!dependencyState) {
        dagExpanded = false;
      }

      dagSection.classList.toggle('is-empty', !dependencyState);
      dagToggle.disabled = !dependencyState;
      dagToggle.textContent = dagExpanded ? 'Hide' : 'Show graph';
      dagToggle.setAttribute('aria-expanded', String(dependencyState && dagExpanded));
      dagContainer.hidden = !dependencyState || !dagExpanded;
      dagSummary.textContent = `${stats.nodeCount} tasks · ${stats.edgeCount} dependencies`;
      dagSummary.hidden = dagExpanded || !dependencyState;
      dagEmptyState.hidden = dependencyState || dagExpanded;

      if (dependencyState && dagExpanded) {
        dagView.update({ todos, selectedTaskId });
      } else {
        dagView.update({ todos: [], selectedTaskId: null });
      }
    }

    function reorderVisibleTodos(draggedId, targetId, insertAfter) {
      if (filterActive) {
        const visibleTodos = getReadyTodos(todos);
        const reorderedVisible = reorderTodos(visibleTodos, draggedId, targetId, insertAfter);
        if (reorderedVisible === visibleTodos) return todos;

        let visibleIndex = 0;
        return todos.map(todo => {
          if (!isActionableStatus(todo.status)) {
            return todo;
          }

          const replacement = reorderedVisible[visibleIndex];
          visibleIndex += 1;
          return replacement ?? todo;
        });
      }

      return reorderTodos(todos, draggedId, targetId, insertAfter);
    }

    function clearDragIndicators() {
      todoList.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });
    }

    let draggedId = null;
    let draggedElement = null;
    let touchDragState = null;
    let suppressClickUntil = 0;

    const TOUCH_DRAG_HOLD_MS = 180;
    const TOUCH_DRAG_CANCEL_DISTANCE = 10;

    function resetDraggedElementStyles() {
      if (!draggedElement) return;

      draggedElement.classList.remove('dragging', 'touch-dragging');
      draggedElement.style.removeProperty('--touch-drag-x');
      draggedElement.style.removeProperty('--touch-drag-y');
      draggedElement = null;
    }

    function cleanupDragState() {
      draggedId = null;
      document.body.classList.remove('is-dragging');
      clearDragIndicators();
      resetDraggedElementStyles();
    }

    function beginDrag(li, { touch = false } = {}) {
      if (!li?.dataset.id) return;

      draggedId = li.dataset.id;
      draggedElement = li;
      li.classList.add('dragging');
      li.classList.toggle('touch-dragging', touch);
      document.body.classList.add('is-dragging');
    }

    function getDragTarget(li, clientY) {
      clearDragIndicators();
      if (!li || li.dataset.id === draggedId) return null;

      const rect = li.getBoundingClientRect();
      const insertAfter = clientY >= rect.top + rect.height / 2;
      li.classList.add(insertAfter ? 'drag-over-below' : 'drag-over-above');
      return { targetId: li.dataset.id, insertAfter };
    }

    function getDragTargetFromPoint(clientX, clientY) {
      const hoveredElement = document.elementFromPoint(clientX, clientY);
      const li = hoveredElement?.closest('li[data-id]') ?? null;
      return getDragTarget(li, clientY);
    }

    function commitReorder(activeDraggedId, targetId, insertAfter) {
      if (!activeDraggedId || !targetId || activeDraggedId === targetId) return false;

      const nextTodos = reorderVisibleTodos(activeDraggedId, targetId, insertAfter);
      if (nextTodos === todos) return false;

      todos = nextTodos;
      saveTodos(todos);
      render();
      return true;
    }

    function clearTouchHold() {
      if (!touchDragState) return;

      if (touchDragState.timerId !== null) {
        window.clearTimeout(touchDragState.timerId);
        touchDragState.timerId = null;
      }

      touchDragState.handle?.classList.remove('touch-armed');
    }

    function resetTouchDragState({ suppressClick = false } = {}) {
      const wasActive = touchDragState?.active ?? false;
      const activeDraggedId = draggedId;

      clearTouchHold();
      touchDragState = null;

      if (wasActive) {
        if (suppressClick) {
          suppressClickUntil = performance.now() + 400;
        }
        cleanupDragState();
      }

      return { wasActive, activeDraggedId };
    }

    function findTouchById(touchList, touchId) {
      return [...touchList].find(touch => touch.identifier === touchId) ?? null;
    }

    function updateTouchDragPosition(clientX, clientY) {
      if (!draggedElement || !touchDragState?.active) return;

      draggedElement.style.setProperty('--touch-drag-x', `${clientX - touchDragState.startX}px`);
      draggedElement.style.setProperty('--touch-drag-y', `${clientY - touchDragState.startY}px`);
    }

    function beginTouchDrag() {
      if (!touchDragState?.item?.isConnected) {
        resetTouchDragState();
        return;
      }

      touchDragState.active = true;
      clearTouchHold();
      beginDrag(touchDragState.item, { touch: true });
      updateTouchDragPosition(touchDragState.lastX, touchDragState.lastY);
      getDragTargetFromPoint(touchDragState.lastX, touchDragState.lastY);
    }

    function onHandleTouchStart(event) {
      if (event.touches.length !== 1) return;

      const handle = event.currentTarget;
      const item = handle.closest('li[data-id]');
      if (!item) return;

      resetTouchDragState();

      const touch = event.touches[0];
      handle.classList.add('touch-armed');

      touchDragState = {
        active: false,
        handle,
        item,
        lastX: touch.clientX,
        lastY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        timerId: window.setTimeout(() => {
          beginTouchDrag();
        }, TOUCH_DRAG_HOLD_MS),
        touchId: touch.identifier
      };
    }

    function render() {
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      const progress = getLiveProgressCounts(todos);
      const visibleTodos = getVisibleTodos();
      const showReadyEmptyState = filterActive && progress.total > 0 && progress.actionable === 0;

      if (!visibleTodos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      todoList.innerHTML = '';

      const hasFinished = todos.some(t => t.status === 'done' || t.status === 'cancelled');
      clearFinishedBtn.disabled = !hasFinished;
      readyFilterToggle.classList.toggle('is-active', filterActive);
      readyFilterToggle.setAttribute('aria-pressed', String(filterActive));
      readySummary.textContent = `${progress.actionable} of ${progress.total} tasks are ready (To Do or In Progress)`;
      renderStatusMetricLine(taskProgressSummary, buildStatusMetricItems(progress));
      taskProgressBar.setAttribute('aria-valuenow', String(progress.completionPercentRounded));
      taskProgressBar.setAttribute(
        'aria-valuetext',
        `${progress.done} done, ${progress.blocked} blocked, ${progress.todo} in To Do, ${progress.inProgress} in Progress out of ${progress.total} total`
      );
      taskProgressBar.style.setProperty('--task-progress-done', `${progress.completionPercent.toFixed(2)}%`);
      taskProgressBar.style.setProperty('--task-progress-blocked', `${progress.blockedPercent.toFixed(2)}%`);
      emptyState.hidden = progress.total > 0 ? !showReadyEmptyState : false;
      emptyState.textContent = progress.total === 0
        ? 'Your hive is empty — add a task to get buzzing 🐝'
        : 'All caught up! Nothing ready to work on right now. 🍯';
      syncDiscoverabilityTips();

      visibleTodos.forEach(todo => {
        const li = document.createElement('li');
        li.draggable = true;
        li.tabIndex = 0;
        li.dataset.id = todo.id;
        if (todo.status !== 'todo') li.classList.add('status-' + todo.status);
        if (todo.id === selectedTaskId) li.classList.add('task-row-selected');

        const remainingMs = notificationController.getHighlightRemainingMs(todo.id);
        if (remainingMs !== null && remainingMs > 0) {
          li.classList.add('task-row-unblocked');
          li.style.setProperty('--unblocked-delay', `${remainingMs - 3000}ms`);
        }

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.title = 'Drag to reorder';
        handle.setAttribute('aria-label', 'Drag to reorder');
        handle.setAttribute('role', 'button');
        handle.textContent = '⠿';
        handle.addEventListener('touchstart', onHandleTouchStart, { passive: true });

        const select = document.createElement('select');
        select.className = 'todo-status';
        select.setAttribute('aria-label', `Status for "${todo.text}"`);
        const statusOptions = [
          { value: 'todo', label: 'To Do' },
          { value: 'inprogress', label: 'In Progress' },
          { value: 'done', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'blocked', label: 'Blocked' }
        ];
        statusOptions.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.value;
          opt.textContent = s.label;
          if (s.value === todo.status) opt.selected = true;
          select.appendChild(opt);
        });
        select.style.color = '#1a1a1a';
        select.addEventListener('change', () => {
          const nextStatus = select.value;
          const currentTodo = todos.find(item => item.id === todo.id);
          if (!currentTodo) return;
          const isBlockedCompletionAttempt = currentTodo.status === 'blocked'
            && (nextStatus === 'done' || nextStatus === 'cancelled')
            && Array.isArray(currentTodo.blockedBy)
            && currentTodo.blockedBy.length > 0
            && hasActiveBlockers(todos, currentTodo.id);

          if (isBlockedCompletionAttempt) {
            select.value = currentTodo.status;
            showBlockedCompletionNotification(currentTodo.id, select);
            return;
          }

          const todosBefore = todos;
          todos = setStatus(todos, currentTodo.id, nextStatus);
          if (nextStatus === 'done' || nextStatus === 'cancelled') {
            todos = cleanupBlockedBy(todos, currentTodo.id);
            surfaceUnblockedTodos(todosBefore, todos);
          }
          saveTodos(todos);
          if (nextStatus === 'done') {
            fireConfetti();
          }
          render();
        });

        const text = document.createElement('span');
        text.className = 'todo-text';
        text.textContent = todo.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', `Delete "${todo.text}"`);
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
          const todosBefore = todos;
          todos = deleteTodo(todos, todo.id);
          surfaceUnblockedTodos(todosBefore, todos);
          if (selectedTaskId === todo.id) {
            selectedTaskId = null;
          }
          saveTodos(todos);
          render();
        });

        if (editingId === todo.id) {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'edit-input';
          input.value = todo.text;
          input.setAttribute('aria-label', `Edit "${todo.text}"`);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit(input.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          });
          input.addEventListener('blur', () => {
            if (editingId === todo.id) {
              saveEdit(input.value);
            }
          });
          li.append(handle, select, input, deleteBtn);
        } else {
          text.addEventListener('dblclick', () => {
            enterEditMode(todo.id);
          });
          li.append(handle, select, text, deleteBtn);
        }

        if (todo.status === 'blocked' && editingId !== todo.id) {
          if (Array.isArray(todo.blockedBy) && todo.blockedBy.length > 0) {
            const blockerNames = todo.blockedBy
              .map(bid => {
                const blocker = todos.find(t => t.id === bid);
                if (!blocker) return null;
                return blocker.text.length > 30 ? blocker.text.slice(0, 30) + '…' : blocker.text;
              })
              .filter(Boolean);

            if (blockerNames.length > 0) {
              let displayText;
              if (blockerNames.length <= 3) {
                displayText = 'Blocked by: ' + blockerNames.join(', ');
              } else {
                displayText = 'Blocked by: ' + blockerNames.slice(0, 2).join(', ') + ' + ' + (blockerNames.length - 2) + ' more';
              }
              const subtitle = document.createElement('div');
              subtitle.className = 'blocked-by-text';
              subtitle.textContent = displayText;
              li.appendChild(subtitle);
            }
          }

          const picker = document.createElement('div');
          picker.className = 'blocker-picker';
          picker.addEventListener('click', (event) => {
            event.stopPropagation();
          });

          const pickerTitle = document.createElement('div');
          pickerTitle.className = 'blocker-picker-title';
          pickerTitle.textContent = 'Blocked by:';
          picker.appendChild(pickerTitle);

          const eligible = todos.filter(t => t.id !== todo.id && (t.status === 'todo' || t.status === 'blocked'));

          if (eligible.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'no-blockers-msg';
            msg.textContent = 'No other tasks to select.';
            picker.appendChild(msg);
          } else {
            eligible.forEach(t => {
              const label = document.createElement('label');
              const checkboxId = `blocker-${todo.id}-${t.id}`;
              label.htmlFor = checkboxId;
              const cb = document.createElement('input');
              cb.id = checkboxId;
              cb.type = 'checkbox';
              cb.checked = Array.isArray(todo.blockedBy) && todo.blockedBy.includes(t.id);
              cb.addEventListener('change', () => {
                todos = toggleBlocker(todos, todo.id, t.id);
                saveTodos(todos);
                render();
              });

              const labelText = document.createElement('span');
              labelText.textContent = t.text.length > 40 ? t.text.slice(0, 40) + '…' : t.text;

              label.append(cb, labelText);
              picker.appendChild(label);
            });
          }

          li.appendChild(picker);

          li.addEventListener('focusout', () => {
            queueMicrotask(() => {
              if (li.contains(document.activeElement)) {
                return;
              }

              const nextTodos = finalizeBlockedStatus(todos, todo.id);
              if (nextTodos === todos) {
                return;
              }

              todos = nextTodos;
              saveTodos(todos);
              render();
            });
          });
        }

        li.addEventListener('click', () => {
          const remainingMs = notificationController.getHighlightRemainingMs(todo.id);
          if (remainingMs !== null && remainingMs > 0) {
            notificationController.clearHighlight(todo.id);
          }
          selectTask(todo.id);
        });

        li.addEventListener('focusin', () => {
          selectTask(todo.id);
        });

        todoList.appendChild(li);
      });

      syncTaskRowSelection();
      syncBurndownState();
      syncDagState();
      applyNotificationState();

      if (draggedId === null) {
        document.body.classList.remove('is-dragging');
      }
    }

    addForm.addEventListener('submit', e => {
      e.preventDefault();
      todos = addTodo(todos, todoInput.value);
      saveTodos(todos);
      render();
      todoInput.value = '';
      todoInput.focus();
    });

    readyFilterToggle.addEventListener('click', () => {
      filterActive = !filterActive;
      saveReadyFilterPreference(filterActive);
      render();
    });

    unblockedNotificationDismiss.addEventListener('click', () => {
      dismissUnblockedNotification({ clearHighlights: true });
    });

    clearFinishedBtn.addEventListener('click', () => {
      const todosBefore = todos;
      todos = clearFinished(todos);
      surfaceUnblockedTodos(todosBefore, todos);
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }
      saveTodos(todos);
      render();
    });

    burndownToggle.addEventListener('click', () => {
      burndownExpanded = !burndownExpanded;
      syncBurndownState();
    });

    dagToggle.addEventListener('click', () => {
      if (!hasDependencies(todos)) {
        return;
      }
      dagToggleTouched = true;
      dagExpanded = !dagExpanded;
      syncDagState();
    });

    window.addEventListener('resize', () => {
      syncBurndownState();
      if (!dagToggleTouched) {
        dagExpanded = hasDependencies(todos) && !isMobileViewport();
      }
      syncDagState();
      syncDiscoverabilityTips();
    });

    burndownChartSvg.addEventListener('mouseleave', hideBurndownTooltip);

    shortcutsHelpBtn.addEventListener('click', () => {
      if (helpModalOpen) {
        closeHelpModal();
        return;
      }
      openHelpModal();
    });

    shortcutsHelpClose.addEventListener('click', () => {
      closeHelpModal();
    });

    shortcutsHelpModal.addEventListener('click', (event) => {
      if (event.target === shortcutsHelpModal) {
        closeHelpModal();
      }
    });

    blockedCompletionDismiss.addEventListener('click', () => {
      closeBlockedCompletionModal();
    });

    blockedCompletionModal.addEventListener('click', (event) => {
      if (event.target === blockedCompletionModal) {
        closeBlockedCompletionModal();
      }
    });

    shortcutsTipDismiss?.addEventListener('click', () => {
      dismissShortcutsTip();
    });

    reorderTipDismiss?.addEventListener('click', () => {
      dismissReorderTip();
    });

    document.addEventListener('keydown', (event) => {
      const isTyping = isEditableTarget(event.target);

      if (event.key === 'Escape') {
        if (blockedCompletionModalOpen) {
          event.preventDefault();
          closeBlockedCompletionModal();
          return;
        }

        if (helpModalOpen) {
          event.preventDefault();
          closeHelpModal();
          return;
        }

        if (isTyping && editingId !== null) {
          event.preventDefault();
          cancelEdit();
          return;
        }

        if (isTyping || selectedTaskId === null) {
          return;
        }

        event.preventDefault();
        clearSelection({ focusList: true });
        return;
      }

      if (blockedCompletionModalOpen && event.key === 'Tab') {
        const focusableElements = getFocusableElements(blockedCompletionModal);

        if (focusableElements.length === 0) {
          event.preventDefault();
          blockedCompletionDismiss.focus();
          return;
        }

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;
        const focusInsideModal = activeElement instanceof HTMLElement
          && blockedCompletionModal.contains(activeElement);

        if (event.shiftKey) {
          if (!focusInsideModal || activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
          }
          return;
        }

        if (!focusInsideModal || activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
        return;
      }

      if (blockedCompletionModalOpen) {
        return;
      }

      const modifierPressed = prefersMacKeys ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;

      if (modifierPressed && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        todoInput.focus();
        todoInput.select();
        return;
      }

      if (isTyping) {
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        if (helpModalOpen) {
          closeHelpModal();
        } else {
          openHelpModal();
        }
        return;
      }

      if (helpModalOpen) {
        return;
      }

      const canNavigate = selectedTaskId !== null || document.activeElement === todoList || todoList.contains(document.activeElement);

      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && canNavigate) {
        event.preventDefault();
        moveSelection(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }

      if (!selectedTaskId) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        toggleSelectedTodoStatus();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedTodo();
      }
    });

    todoList.addEventListener('dragstart', e => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      beginDrag(li);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', li.dataset.id);
    });

    todoList.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const li = e.target.closest('li[data-id]');
      getDragTarget(li, e.clientY);
    });

    todoList.addEventListener('dragleave', e => {
      const li = e.target.closest('li[data-id]');
      if (li && !li.contains(e.relatedTarget)) {
        li.classList.remove('drag-over-above', 'drag-over-below');
      }
    });

    todoList.addEventListener('drop', e => {
      e.preventDefault();
      const targetLi = e.target.closest('li[data-id]');
      if (!targetLi || !draggedId) return;

      const dragTarget = getDragTarget(targetLi, e.clientY);
      const activeDraggedId = draggedId;
      cleanupDragState();
      if (!dragTarget) return;
      commitReorder(activeDraggedId, dragTarget.targetId, dragTarget.insertAfter);
    });

    todoList.addEventListener('dragend', () => {
      cleanupDragState();
    });

    todoList.addEventListener('click', event => {
      if (performance.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntil = 0;
    }, true);

    document.addEventListener('touchmove', event => {
      if (!touchDragState) return;
      if (event.touches.length > 1) {
        resetTouchDragState({ suppressClick: true });
        return;
      }

      const touch = findTouchById(event.touches, touchDragState.touchId);
      if (!touch) return;

      touchDragState.lastX = touch.clientX;
      touchDragState.lastY = touch.clientY;

      if (!touchDragState.active) {
        const travelDistance = Math.hypot(
          touch.clientX - touchDragState.startX,
          touch.clientY - touchDragState.startY
        );

        if (travelDistance > TOUCH_DRAG_CANCEL_DISTANCE) {
          resetTouchDragState();
        }
        return;
      }

      if (!draggedId || !draggedElement) return;

      event.preventDefault();
      updateTouchDragPosition(touch.clientX, touch.clientY);
      getDragTargetFromPoint(touch.clientX, touch.clientY);
    }, { passive: false });

    document.addEventListener('touchend', event => {
      if (!touchDragState) return;

      const touch = findTouchById(event.changedTouches, touchDragState.touchId);
      if (!touch) return;

      const activeState = touchDragState.active;
      const dragTarget = activeState ? getDragTargetFromPoint(touch.clientX, touch.clientY) : null;

      const { wasActive, activeDraggedId } = resetTouchDragState({ suppressClick: true });
      if (!activeState) return;

      event.preventDefault();
      if (!wasActive) return;
      if (!dragTarget) return;
      const reordered = commitReorder(activeDraggedId, dragTarget.targetId, dragTarget.insertAfter);
      if (reordered) {
        dismissReorderTip();
      }
    }, { passive: false });

    document.addEventListener('touchcancel', event => {
      if (!touchDragState) return;
      resetTouchDragState({ suppressClick: true });
    });

    window.addEventListener('beforeunload', () => {
      dismissUnblockedNotification({ clearHighlights: true });
      dagView.destroy();
    }, { once: true });

    render();
  })();
}
