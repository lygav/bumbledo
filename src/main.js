import './styles.css';
import { createBurndownView } from './burndown/view.js';
import { createDagView } from './dag/view.js';
import { buildDependencyGraph } from './dag/graph.js';
import {
  ACTIONABLE_TODO_STATUSES,
  ACTIONABLE_TODO_STATUS_SUMMARY_LABEL,
  APP_STORAGE_KEYS,
  EDITABLE_TODO_STATUSES,
  TERMINAL_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_CYCLE,
  TODO_STATUS_META,
  TOGGLEABLE_TODO_STATUSES
} from './app/constants.js';
import { createKeyboardController } from './ui/keyboard.js';
import { createModals } from './ui/modals.js';
import {
  buildStatusMetricItems,
  renderStatusMetricLine
} from './ui/status-metrics.js';
import { createTodoListView } from './todo/list-view.js';
import { createNotificationController } from './todo/notification.js';
import { createTodoReorderController } from './todo/reorder.js';
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
  wouldCreateCycle,
  updateTodoText
} from './todo/model.js';

const CONFETTI_COLORS = ['#4a90d9', '#2f8f63', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899'];
const CONFETTI_COUNT = 52;
const CONFETTI_MIN_DURATION_MS = 2000;
const CONFETTI_MAX_DURATION_MS = 3000;

const ACTIONABLE_STATUS_SET = new Set(ACTIONABLE_TODO_STATUSES);
const EDITABLE_STATUS_SET = new Set(EDITABLE_TODO_STATUSES);
const TERMINAL_STATUS_SET = new Set(TERMINAL_TODO_STATUSES);
const TOGGLEABLE_STATUS_SET = new Set(TOGGLEABLE_TODO_STATUSES);

function isActionableStatus(status) {
  return ACTIONABLE_STATUS_SET.has(status);
}

function canEditTodoStatus(status) {
  return EDITABLE_STATUS_SET.has(status);
}

function getLiveProgressCounts(todos) {
  const total = todos.length;
  const todo = todos.filter(item => item.status === TODO_STATUS.TODO).length;
  const inProgress = todos.filter(item => item.status === TODO_STATUS.IN_PROGRESS).length;
  const blocked = todos.filter(item => item.status === TODO_STATUS.BLOCKED).length;
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

function isMobileViewport() {
  return window.matchMedia('(max-width: 479px)').matches;
}

function loadReadyFilterPreference() {
  try {
    const storedPreference = localStorage.getItem(APP_STORAGE_KEYS.READY_FILTER);
    if (storedPreference !== null) {
      return storedPreference === 'true';
    }

    const legacyPreference = localStorage.getItem(APP_STORAGE_KEYS.LEGACY_ACTIONABLE_FILTER);
    if (legacyPreference !== null) {
      try {
        localStorage.setItem(APP_STORAGE_KEYS.READY_FILTER, legacyPreference);
        localStorage.removeItem(APP_STORAGE_KEYS.LEGACY_ACTIONABLE_FILTER);
      } catch {
        // Ignore storage migration failures so the UI stays usable.
      }
    }

    return legacyPreference === 'true';
  } catch {
    return false;
  }
}

function saveReadyFilterPreference(isActive) {
  try {
    localStorage.setItem(APP_STORAGE_KEYS.READY_FILTER, String(isActive));
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
    let editingId = null;
    let shortcutsTipDismissed = loadTipDismissed(APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED);
    let reorderTipDismissed = loadTipDismissed(APP_STORAGE_KEYS.REORDER_TIP_DISMISSED);
    let shortcutsTipShownThisSession = false;
    let reorderTipShownThisSession = false;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (shouldSampleToday(burndownData)) {
      burndownData = saveBurndownData([...burndownData, takeBurndownSample(todos)], undefined, APP_STORAGE_KEYS.BURNDOWN);
    }

    const modals = createModals({
      helpButton: shortcutsHelpBtn,
      helpModal: shortcutsHelpModal,
      helpCloseButton: shortcutsHelpClose,
      blockedCompletionModal,
      blockedCompletionMessage,
      blockedCompletionDismissButton: blockedCompletionDismiss
    });

    let notificationController;
    const listView = createTodoListView({
      container: todoList,
      getHighlightRemainingMs: (id) => notificationController.getHighlightRemainingMs(id),
      canEditTodoStatus,
      wouldCreateCycle,
      onSelectTask: (id) => {
        selectedTaskId = id;
        listView.syncSelection(selectedTaskId);
        syncDagState();
      },
      onEnterEditMode: (id) => {
        const todo = todos.find(item => item.id === id);
        if (!todo || !canEditTodoStatus(todo.status)) {
          return;
        }

        editingId = id;
        renderApp();
      },
      onSaveEdit: (newText) => {
        if (!editingId) {
          return;
        }

        const trimmed = newText.trim();
        if (!trimmed) {
          return;
        }

        todos = updateTodoText(todos, editingId, newText);
        saveTodos(todos);
        editingId = null;
        renderApp();
      },
      onCancelEdit: () => {
        editingId = null;
        renderApp();
      },
      onDeleteTask: (id) => {
        const todosBefore = todos;
        todos = deleteTodo(todos, id);
        surfaceUnblockedTodos(todosBefore, todos);
        if (selectedTaskId === id) {
          selectedTaskId = null;
        }
        saveTodos(todos);
        renderApp();
      },
      onStatusChange: (id, nextStatus, { returnFocusEl = null } = {}) => {
        const currentTodo = todos.find(item => item.id === id);
        if (!currentTodo) {
          return;
        }

        const isBlockedCompletionAttempt = currentTodo.status === TODO_STATUS.BLOCKED
          && TERMINAL_STATUS_SET.has(nextStatus)
          && Array.isArray(currentTodo.blockedBy)
          && currentTodo.blockedBy.length > 0
          && hasActiveBlockers(todos, currentTodo.id);

        if (isBlockedCompletionAttempt) {
          showBlockedCompletionNotification(currentTodo.id, returnFocusEl);
          renderApp();
          return;
        }

        const todosBefore = todos;
        todos = setStatus(todos, currentTodo.id, nextStatus);
        if (TERMINAL_STATUS_SET.has(nextStatus)) {
          todos = cleanupBlockedBy(todos, currentTodo.id);
          surfaceUnblockedTodos(todosBefore, todos);
        }
        saveTodos(todos);
        if (nextStatus === TODO_STATUS.DONE) {
          fireConfetti();
        }
        renderApp();
      },
      onToggleBlocker: (todoId, blockerId) => {
        todos = toggleBlocker(todos, todoId, blockerId);
        saveTodos(todos);
        renderApp();
      },
      onFinalizeBlockedStatus: (todoId) => {
        const nextTodos = finalizeBlockedStatus(todos, todoId);
        if (nextTodos === todos) {
          return;
        }

        todos = nextTodos;
        saveTodos(todos);
        renderApp();
      },
      onClearHighlight: (id) => {
        notificationController.clearHighlight(id);
      }
    });

    let burndownView;
    burndownView = createBurndownView({
      toggleEl: burndownToggle,
      collapsedSummaryEl: burndownCollapsedSummary,
      panelEl: burndownPanel,
      summaryHeadlineEl: burndownSummaryHeadline,
      emptyStateEl: burndownEmptyState,
      chartEl: burndownChart,
      svgEl: burndownChartSvg,
      tooltipEl: burndownTooltip,
      isMobileViewport,
      onToggle: () => {
        burndownExpanded = !burndownExpanded;
        burndownView.update({
          burndownData,
          progress: getLiveProgressCounts(todos),
          expanded: burndownExpanded
        });
      }
    });

    const dagView = createDagView({
      container: dagContainer,
      onSelectTask: (id) => {
        selectedTaskId = id;
        listView.syncSelection(selectedTaskId);
        syncDagState();
        listView.scrollTaskIntoView(id, { flash: true });
      }
    });

    saveTodos(todos);

    notificationController = createNotificationController({
      onStateChange: () => {
        applyNotificationState();
        listView.syncUnblockedHighlights();
      }
    });

    const keyboardController = createKeyboardController({
      document,
      getState: () => ({
        blockedModalOpen: modals.isBlockedOpen(),
        helpModalOpen: modals.isHelpOpen(),
        editing: editingId !== null,
        selectedTaskId,
        canNavigate: selectedTaskId !== null || document.activeElement === todoList || todoList.contains(document.activeElement)
      }),
      actions: {
        cancelEdit: () => {
          editingId = null;
          renderApp();
        },
        clearSelection,
        closeBlockedModal: () => {
          modals.closeBlocked();
        },
        closeHelpModal: () => {
          modals.closeHelp();
        },
        deleteSelectedTodo,
        focusTodoInput: () => {
          todoInput.focus();
          todoInput.select();
        },
        moveSelection,
        toggleHelp: () => {
          modals.toggleHelp();
        },
        toggleSelectedTodoStatus,
        trapBlockedModalFocus: (event) => modals.trapBlockedFocus(event)
      }
    });

    if (focusInputShortcut) {
      focusInputShortcut.innerHTML = keyboardController.getFocusInputShortcutMarkup();
    }

    keyboardController.attach();

    const reorderController = createTodoReorderController({
      listEl: todoList,
      getTodos: () => todos,
      getVisibleTodos: () => getVisibleTodos(),
      isFiltered: () => filterActive,
      isReorderableTodo: (todo) => isActionableStatus(todo.status),
      reorderTodos,
      onReorder: (nextTodos) => {
        if (nextTodos === todos) {
          return false;
        }

        todos = nextTodos;
        saveTodos(todos);
        renderApp();
        return true;
      },
      onDismissReorderTip: () => {
        dismissReorderTip();
      }
    });
    reorderController.attach();

    function getVisibleTodos() {
      return filterActive ? getReadyTodos(todos) : todos;
    }

    function applyNotificationState() {
      const notificationState = notificationController.getState();
      unblockedNotification.hidden = !notificationState.visible;
      unblockedNotificationMessage.textContent = notificationState.message;
      unblockedNotificationDetail.textContent = notificationState.detail;
    }

    function dismissUnblockedNotification({ clearHighlights = false } = {}) {
      notificationController.dismiss({ clearHighlights });
    }

    function dismissShortcutsTip() {
      if (shortcutsTipDismissed) {
        return;
      }

      shortcutsTipDismissed = true;
      dismissTip(APP_STORAGE_KEYS.SHORTCUTS_TIP_DISMISSED);
      if (shortcutsTip) {
        shortcutsTip.hidden = true;
      }
    }

    function dismissReorderTip() {
      if (reorderTipDismissed) {
        return;
      }

      reorderTipDismissed = true;
      dismissTip(APP_STORAGE_KEYS.REORDER_TIP_DISMISSED);
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

    function showBlockedCompletionNotification(todoId, returnFocusEl = null) {
      const activeBlockerCount = getActiveBlockerCount(todos, todoId);
      if (activeBlockerCount === 0) {
        return;
      }

      modals.openBlocked(
        getBlockedCompletionMessage(activeBlockerCount),
        { returnFocusEl }
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

    function renderTaskSummary(progress, showReadyEmptyState) {
      const hasFinished = todos.some(todo => TERMINAL_STATUS_SET.has(todo.status));
      clearFinishedBtn.disabled = !hasFinished;
      readyFilterToggle.classList.toggle('is-active', filterActive);
      readyFilterToggle.setAttribute('aria-pressed', String(filterActive));
      readySummary.textContent = `${progress.actionable} of ${progress.total} tasks are ready (${ACTIONABLE_TODO_STATUS_SUMMARY_LABEL})`;
      renderStatusMetricLine(taskProgressSummary, buildStatusMetricItems(progress));
      taskProgressBar.setAttribute('aria-valuenow', String(progress.completionPercentRounded));
      taskProgressBar.setAttribute(
        'aria-valuetext',
        `${progress.done} done, ${progress.blocked} blocked, ${progress.todo} in ${TODO_STATUS_META[TODO_STATUS.TODO].label}, ${progress.inProgress} in ${TODO_STATUS_META[TODO_STATUS.IN_PROGRESS].label} out of ${progress.total} total`
      );
      taskProgressBar.style.setProperty('--task-progress-done', `${progress.completionPercent.toFixed(2)}%`);
      taskProgressBar.style.setProperty('--task-progress-blocked', `${progress.blockedPercent.toFixed(2)}%`);
      emptyState.hidden = progress.total > 0 ? !showReadyEmptyState : false;
      emptyState.textContent = progress.total === 0
        ? 'Your hive is empty — add a task to get buzzing 🐝'
        : 'All caught up! Nothing ready to work on right now. 🍯';
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

    function renderApp() {
      if (!todos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      const progress = getLiveProgressCounts(todos);
      const visibleTodos = getVisibleTodos();
      const showReadyEmptyState = filterActive && progress.total > 0 && progress.actionable === 0;

      if (!visibleTodos.some(todo => todo.id === selectedTaskId)) {
        selectedTaskId = null;
      }

      renderTaskSummary(progress, showReadyEmptyState);
      syncDiscoverabilityTips();
      listView.update({
        todos,
        visibleTodos,
        selectedTaskId,
        editingId
      });
      burndownView.update({
        burndownData,
        progress,
        expanded: burndownExpanded
      });
      syncDagState();
      applyNotificationState();
      reorderController.reset();
    }

    function clearSelection({ focusList = false } = {}) {
      selectedTaskId = null;
      listView.syncSelection(selectedTaskId);
      syncDagState();
      if (focusList) {
        listView.focusList();
      }
    }

    function selectTask(id, { focus = false, scroll = false, flash = false } = {}) {
      if (!todos.some(todo => todo.id === id)) {
        return;
      }

      selectedTaskId = id;
      listView.syncSelection(selectedTaskId);
      syncDagState();

      if (scroll) {
        listView.scrollTaskIntoView(id, { flash });
      }

      if (focus) {
        listView.focusTask(id);
      }
    }

    function moveSelection(step) {
      const visibleTodos = getVisibleTodos();
      if (visibleTodos.length === 0) {
        return;
      }

      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTaskId);
      const nextIndex = currentIndex === -1
        ? (step > 0 ? 0 : visibleTodos.length - 1)
        : Math.max(0, Math.min(visibleTodos.length - 1, currentIndex + step));
      const nextTodo = visibleTodos[nextIndex];
      if (!nextTodo) {
        return;
      }

      selectTask(nextTodo.id, { focus: true, scroll: true });
    }

    function toggleSelectedTodoStatus() {
      const selectedTodo = todos.find(todo => todo.id === selectedTaskId);
      if (!selectedTodo || !TOGGLEABLE_STATUS_SET.has(selectedTodo.status)) {
        return;
      }

      const visibleTodos = getVisibleTodos();
      const currentIndex = visibleTodos.findIndex(todo => todo.id === selectedTodo.id);
      const nextStatus = TODO_STATUS_CYCLE[selectedTodo.status];
      const todosBefore = todos;
      todos = cycleStatus(todos, selectedTodo.id);
      if (nextStatus === TODO_STATUS.DONE) {
        todos = cleanupBlockedBy(todos, selectedTodo.id);
        surfaceUnblockedTodos(todosBefore, todos);
      }
      saveTodos(todos);
      if (nextStatus === TODO_STATUS.DONE) {
        fireConfetti();
      }
      renderApp();

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
      renderApp();

      if (fallbackId && todos.some(todo => todo.id === fallbackId)) {
        selectTask(fallbackId, { focus: true, scroll: true });
      } else {
        clearSelection({ focusList: true });
      }
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

    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      todos = addTodo(todos, todoInput.value);
      saveTodos(todos);
      renderApp();
      todoInput.value = '';
      todoInput.focus();
    });

    readyFilterToggle.addEventListener('click', () => {
      filterActive = !filterActive;
      saveReadyFilterPreference(filterActive);
      renderApp();
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
      renderApp();
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
      renderApp();
      if (!dagToggleTouched) {
        dagExpanded = hasDependencies(todos) && !isMobileViewport();
      }
      syncDagState();
      syncDiscoverabilityTips();
    });

    shortcutsTipDismiss?.addEventListener('click', () => {
      dismissShortcutsTip();
    });

    reorderTipDismiss?.addEventListener('click', () => {
      dismissReorderTip();
    });

    window.addEventListener('beforeunload', () => {
      dismissUnblockedNotification({ clearHighlights: true });
      keyboardController.detach();
      reorderController.detach();
      burndownView.destroy();
      modals.destroy();
      listView.destroy();
      dagView.destroy();
    }, { once: true });

    renderApp();
  })();
}
