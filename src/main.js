import './styles.css';
import { createAppStore } from './app/store.js';
import {
  selectBlockedStatusChange,
  selectDagViewModel,
  selectHasFinishedTodos,
  selectProgress,
  selectShowReadyEmptyState,
  selectVisibleTodos,
} from './app/selectors.js';
import { createDagView } from './dag/view.js';
import {
  ACTIONABLE_TODO_STATUSES,
  ACTIONABLE_TODO_STATUS_SUMMARY_LABEL,
  applyRootDesignTokens,
  CONFETTI_COLORS,
  EDITABLE_TODO_STATUSES,
  TODO_STATUS,
  TODO_STATUS_META,
} from './app/constants.js';
import { createKeyboardController } from './ui/keyboard.js';
import { createModals } from './ui/modals.js';
import {
  buildStatusMetricItems,
  renderStatusMetricLine,
} from './ui/status-metrics.js';
import { createTodoListView } from './todo/list-view.js';
import { createNotificationController } from './todo/notification.js';
import { createTodoReorderController } from './todo/reorder.js';
import { reorderTodos, wouldCreateCycle } from './todo/model.js';

const CONFETTI_COUNT = 52;
const CONFETTI_MIN_DURATION_MS = 2000;
const CONFETTI_MAX_DURATION_MS = 3000;

const ACTIONABLE_STATUS_SET = new Set(ACTIONABLE_TODO_STATUSES);
const EDITABLE_STATUS_SET = new Set(EDITABLE_TODO_STATUSES);
function isActionableStatus(status) {
  return ACTIONABLE_STATUS_SET.has(status);
}

function canEditTodoStatus(status) {
  return EDITABLE_STATUS_SET.has(status);
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 479px)').matches;
}

if (typeof document !== 'undefined') {
  applyRootDesignTokens(document.documentElement);

  (function init() {
    const todoList = document.getElementById('todo-list');
    const todoInput = document.getElementById('todo-input');
    const addForm = document.getElementById('add-form');
    const shortcutsTip = document.getElementById('shortcuts-tip');
    const shortcutsTipDismiss = document.getElementById(
      'shortcuts-tip-dismiss',
    );
    const unblockedNotification = document.getElementById(
      'unblocked-notification',
    );
    const unblockedNotificationMessage = document.getElementById(
      'unblocked-notification-message',
    );
    const unblockedNotificationDetail = document.getElementById(
      'unblocked-notification-detail',
    );
    const unblockedNotificationDismiss = document.getElementById(
      'unblocked-notification-dismiss',
    );
    const readyFilterToggle = document.getElementById('ready-filter-toggle');
    const readySummary = document.getElementById('ready-summary');
    const taskProgressSummary = document.getElementById(
      'task-progress-summary',
    );
    const taskProgressBar = document.querySelector('.task-progress-bar');
    const welcomeTip = document.getElementById('welcome-tip');
    const welcomeTipDismiss = document.getElementById('welcome-tip-dismiss');
    const emptyState = document.getElementById('empty-state');
    const reorderTip = document.getElementById('reorder-tip');
    const reorderTipDismiss = document.getElementById('reorder-tip-dismiss');
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
    const blockedCompletionModal = document.getElementById(
      'blocked-completion-modal',
    );
    const blockedCompletionMessage = document.getElementById(
      'blocked-completion-message',
    );
    const blockedCompletionDismiss = document.getElementById(
      'blocked-completion-dismiss',
    );

    const store = createAppStore({ isMobileViewport: isMobileViewport() });
    let todos = [];
    let selectedTaskId = null;
    let filterActive = false;
    let dagExpanded = false;
    let editingId = null;
    let welcomeTipDismissed = false;
    let shortcutsTipDismissed = false;
    let reorderTipDismissed = false;

    const isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const syncStoreState = (nextState) => {
      ({
        todos,
        selectedTaskId,
        filterActive,
        dagExpanded,
        editingId,
        welcomeTipDismissed,
        shortcutsTipDismissed,
        reorderTipDismissed,
      } = nextState);
    };
    syncStoreState(store.getState());

    const modals = createModals({
      helpButton: shortcutsHelpBtn,
      helpModal: shortcutsHelpModal,
      helpCloseButton: shortcutsHelpClose,
      blockedCompletionModal,
      blockedCompletionMessage,
      blockedCompletionDismissButton: blockedCompletionDismiss,
    });

    let notificationController;
    const listView = createTodoListView({
      container: todoList,
      getHighlightRemainingMs: (id) =>
        notificationController.getHighlightRemainingMs(id),
      canEditTodoStatus,
      isStatusOptionDisabled: (todo, nextStatus) =>
        selectBlockedStatusChange(store.getState(), todo.id, nextStatus)
          .blockedStatusTransitionDenied,
      wouldCreateCycle: (allTodos, todoId, blockerId) =>
        wouldCreateCycle(allTodos, todoId, blockerId),
      onSelectTask: (id) => {
        store.selectTask({ id });
      },
      onEnterEditMode: (id) => {
        store.enterEditMode({ id });
      },
      onSaveEdit: (newText) => {
        store.saveEditedTask({ text: newText });
      },
      onCancelEdit: () => {
        store.cancelEdit();
      },
      onDeleteTask: (id) => {
        store.deleteTask({ id });
      },
      onStatusChange: (id, nextStatus, { returnFocusEl = null } = {}) => {
        store.setTaskStatus({ id, nextStatus, returnFocusEl });
      },
      onToggleBlocker: (todoId, blockerId) => {
        store.toggleBlocker({ todoId, blockerId });
      },
      onFinalizeBlockedStatus: (todoId) => {
        store.finalizeBlockedStatus({ todoId });
      },
      onClearHighlight: (id) => {
        notificationController.clearHighlight(id);
      },
    });

    const dagView = createDagView({
      container: dagContainer,
      onSelectTask: (id) => {
        store.selectTask({ id });
        if (store.getState().selectedTaskId === id) {
          listView.scrollTaskIntoView(id, { flash: true });
        }
      },
    });

    notificationController = createNotificationController({
      onStateChange: () => {
        applyNotificationState();
        listView.syncUnblockedHighlights();
      },
    });

    const keyboardController = createKeyboardController({
      document,
      getState: () => ({
        blockedModalOpen: modals.isBlockedOpen(),
        helpModalOpen: modals.isHelpOpen(),
        editing: editingId !== null,
        selectedTaskId,
        canNavigate:
          selectedTaskId !== null ||
          document.activeElement === todoList ||
          todoList.contains(document.activeElement),
      }),
      actions: {
        cancelEdit: () => {
          store.cancelEdit();
        },
        clearSelection: ({ focusList = false } = {}) => {
          store.clearSelection();
          if (focusList) {
            listView.focusList();
          }
        },
        closeBlockedModal: () => {
          modals.closeBlocked();
        },
        closeHelpModal: () => {
          modals.closeHelp();
        },
        deleteSelectedTodo: () => {
          if (selectedTaskId) {
            store.deleteTask({ id: selectedTaskId });
          }
        },
        focusTodoInput: () => {
          todoInput.focus();
          todoInput.select();
        },
        moveSelection: (step) => {
          store.moveSelection({ step });
        },
        toggleHelp: () => {
          modals.toggleHelp();
        },
        toggleSelectedTodoStatus: () => {
          store.toggleSelectedTaskStatus();
        },
        trapBlockedModalFocus: (event) => modals.trapBlockedFocus(event),
      },
    });

    if (focusInputShortcut) {
      focusInputShortcut.innerHTML =
        keyboardController.getFocusInputShortcutMarkup();
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
        return store.reorderTasks({ todos: nextTodos }).changed;
      },
      onDismissReorderTip: () => {
        dismissReorderTip();
      },
    });
    reorderController.attach();

    function getVisibleTodos() {
      return selectVisibleTodos(store.getState());
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
      store.dismissShortcutsTip();
    }

    function dismissWelcomeTip() {
      store.dismissWelcomeTip();
    }

    function dismissReorderTip() {
      store.dismissReorderTip();
    }

    function syncDiscoverabilityTips() {
      if (welcomeTip) {
        const shouldShowWelcomeTip = !welcomeTipDismissed && todos.length === 0;
        welcomeTip.hidden = !shouldShowWelcomeTip;
      }

      if (shortcutsTip) {
        const shouldShowShortcutsTip =
          !shortcutsTipDismissed && todos.length >= 3;
        shortcutsTip.hidden = !shouldShowShortcutsTip;
      }

      if (reorderTip) {
        const shouldShowReorderTip =
          !reorderTipDismissed &&
          isTouchDevice &&
          isMobileViewport() &&
          todos.length > 0;
        reorderTip.hidden = !shouldShowReorderTip;
      }
    }

    function getBlockedCompletionMessage(activeBlockerCount) {
      const dependencyLabel =
        activeBlockerCount === 1 ? 'dependency' : 'dependencies';
      return `Can't complete — this task has ${activeBlockerCount} ${dependencyLabel} remaining.`;
    }

    function showBlockedCompletionNotification(
      activeBlockerCount,
      returnFocusEl = null,
    ) {
      if (activeBlockerCount === 0) {
        return;
      }

      modals.openBlocked(getBlockedCompletionMessage(activeBlockerCount), {
        returnFocusEl,
      });
    }

    function surfaceUnblockedTodos(unblockedIds) {
      if (unblockedIds.length === 0) {
        return;
      }

      notificationController.showUnblocked(
        unblockedIds
          .map((id) => ({
            id,
            name: todos.find((todo) => todo.id === id)?.text,
          }))
          .filter((item) => item.name),
      );
    }

    function renderTaskSummary(progress, showReadyEmptyState) {
      const hasFinished = selectHasFinishedTodos(store.getState());
      clearFinishedBtn.disabled = !hasFinished;
      readyFilterToggle.classList.toggle('is-active', filterActive);
      readyFilterToggle.setAttribute('aria-checked', String(filterActive));
      readySummary.textContent = filterActive
        ? `${progress.actionable} actionable tasks visible (${ACTIONABLE_TODO_STATUS_SUMMARY_LABEL})`
        : `Showing all ${progress.total} tasks`;
      renderStatusMetricLine(
        taskProgressSummary,
        buildStatusMetricItems(progress),
      );
      taskProgressBar.setAttribute(
        'aria-valuenow',
        String(progress.completionPercentRounded),
      );
      taskProgressBar.setAttribute(
        'aria-valuetext',
        `${progress.done} done, ${progress.blocked} blocked, ${progress.todo} in ${TODO_STATUS_META[TODO_STATUS.TODO].label}, ${progress.inProgress} in ${TODO_STATUS_META[TODO_STATUS.IN_PROGRESS].label} out of ${progress.total} total`,
      );
      taskProgressBar.style.setProperty(
        '--task-progress-done',
        `${progress.completionPercent.toFixed(2)}%`,
      );
      taskProgressBar.style.setProperty(
        '--task-progress-blocked',
        `${progress.blockedPercent.toFixed(2)}%`,
      );
      emptyState.hidden = progress.total > 0 ? !showReadyEmptyState : false;
      emptyState.textContent =
        progress.total === 0
          ? 'Your hive is empty — add a task to get buzzing 🐝'
          : 'All caught up! Nothing ready to work on right now. 🍯';
    }

    function syncDagState() {
      const {
        hasDependencies: dependencyState,
        stats,
        expanded,
      } = selectDagViewModel(store.getState());
      dagExpanded = expanded;

      dagSection.classList.toggle('is-empty', !dependencyState);
      dagToggle.disabled = !dependencyState;
      dagToggle.textContent = dagExpanded ? 'Hide' : 'Show graph';
      dagToggle.setAttribute(
        'aria-expanded',
        String(dependencyState && dagExpanded),
      );
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
      const storeState = store.getState();
      const progress = selectProgress(storeState);
      const visibleTodos = selectVisibleTodos(storeState);
      const showReadyEmptyState = selectShowReadyEmptyState(
        storeState,
        progress,
      );

      renderTaskSummary(progress, showReadyEmptyState);
      syncDiscoverabilityTips();
      listView.update({
        todos,
        visibleTodos,
        selectedTaskId,
        editingId,
      });
      syncDagState();
      applyNotificationState();
      reorderController.reset();
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
        if (
          !(event.target instanceof HTMLElement) ||
          !event.target.classList.contains('confetti-piece')
        ) {
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
        const endRotation = Math.round(
          startRotation + baseRotation * (1.2 + Math.random() * 0.5),
        );
        const durationMs = Math.round(
          CONFETTI_MIN_DURATION_MS +
            Math.random() *
              (CONFETTI_MAX_DURATION_MS - CONFETTI_MIN_DURATION_MS),
        );
        const delayMs = Math.round(Math.random() * 220);
        const color =
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
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
        piece.style.setProperty(
          '--confetti-start-rotate',
          `${startRotation}deg`,
        );
        piece.style.setProperty('--confetti-mid-rotate', `${midRotation}deg`);
        piece.style.setProperty(
          '--confetti-mid-rotate-two',
          `${midRotationTwo}deg`,
        );
        piece.style.setProperty('--confetti-end-rotate', `${endRotation}deg`);
        piece.style.setProperty('--confetti-duration', `${durationMs}ms`);
        piece.style.animationDelay = `${delayMs}ms`;
        burst.appendChild(piece);
      }

      document.body.appendChild(burst);
      cleanupTimeoutId = window.setTimeout(
        cleanupConfetti,
        longestAnimationMs + 120,
      );
    }

    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (store.addTask({ text: todoInput.value }).changed) {
        todoInput.value = '';
        todoInput.focus();
      }
    });

    readyFilterToggle.addEventListener('click', () => {
      store.toggleReadyFilter();
    });

    unblockedNotificationDismiss.addEventListener('click', () => {
      dismissUnblockedNotification({ clearHighlights: true });
    });

    clearFinishedBtn.addEventListener('click', () => {
      store.clearFinished();
    });

    dagToggle.addEventListener('click', () => {
      if (!selectDagViewModel(store.getState()).hasDependencies) {
        return;
      }
      store.toggleDagExpanded();
    });

    window.addEventListener('resize', () => {
      store.setViewport({ isMobileViewport: isMobileViewport() });
      renderApp();
    });

    shortcutsTipDismiss?.addEventListener('click', () => {
      dismissShortcutsTip();
    });

    welcomeTipDismiss?.addEventListener('click', () => {
      dismissWelcomeTip();
    });

    reorderTipDismiss?.addEventListener('click', () => {
      dismissReorderTip();
    });

    window.addEventListener(
      'beforeunload',
      () => {
        dismissUnblockedNotification({ clearHighlights: true });
        keyboardController.detach();
        reorderController.detach();
        modals.destroy();
        listView.destroy();
        dagView.destroy();
      },
      { once: true },
    );

    store.subscribe((event) => {
      if (!event.changed && !event.meta.blockedStatusTransitionDenied) {
        return;
      }

      syncStoreState(event.state);

      if (event.changed || event.meta.blockedStatusTransitionDenied) {
        renderApp();
      }

      if (event.meta.unblockedIds?.length) {
        surfaceUnblockedTodos(event.meta.unblockedIds);
      }

      if (event.meta.blockedCompletionAttempt) {
        showBlockedCompletionNotification(
          event.meta.activeBlockerCount,
          event.meta.returnFocusEl,
        );
      }

      if (event.meta.completedTaskId) {
        fireConfetti();
      }

      if (event.meta.focusSelection && selectedTaskId) {
        listView.focusTask(selectedTaskId);
        if (event.meta.scrollSelection) {
          listView.scrollTaskIntoView(selectedTaskId);
        }
      } else if (event.meta.focusList) {
        listView.focusList();
      }
    });

    renderApp();
  })();
}
