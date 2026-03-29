export const NOTIFICATION_AUTO_DISMISS_MS = 5000;
export const UNBLOCKED_HIGHLIGHT_MS = 3000;

export function createNotificationState() {
  return {
    visible: false,
    message: '',
    detail: '',
    shownAt: null,
    highlightExpiresAt: {}
  };
}

function copyHighlightExpiresAt(highlightExpiresAt) {
  return { ...highlightExpiresAt };
}

export function dismissNotification(state, { clearHighlights = false } = {}) {
  return {
    ...state,
    visible: false,
    message: '',
    detail: '',
    shownAt: null,
    highlightExpiresAt: clearHighlights ? {} : copyHighlightExpiresAt(state.highlightExpiresAt)
  };
}

export function showUnblockedNotification(state, taskNames, now = Date.now()) {
  if (taskNames.length === 0) {
    return dismissNotification(state, { clearHighlights: true });
  }

  const taskCount = taskNames.length;
  const taskLabel = taskCount === 1 ? 'task' : 'tasks';
  const subject = taskCount === 1
    ? `${taskCount} ${taskLabel}: ${taskNames[0]}`
    : `${taskCount} ${taskLabel}: ${taskNames.join(', ')}`;
  const scrollTarget = taskCount === 1 ? 'it' : 'them';

  return {
    ...state,
    visible: true,
    message: `You've unblocked ${subject}. Scroll down to find ${scrollTarget}.`,
    detail: `Alert: You've unblocked ${taskCount} ${taskLabel}. ${taskNames.join(', ')}.`,
    shownAt: now,
    highlightExpiresAt: copyHighlightExpiresAt(state.highlightExpiresAt)
  };
}

export function highlightUnblockedTodos(state, ids, now = Date.now()) {
  const highlightExpiresAt = copyHighlightExpiresAt(state.highlightExpiresAt);

  ids.forEach((id) => {
    highlightExpiresAt[id] = now + UNBLOCKED_HIGHLIGHT_MS;
  });

  return {
    ...state,
    highlightExpiresAt
  };
}

export function clearUnblockedHighlight(state, id) {
  if (!(id in state.highlightExpiresAt)) {
    return state;
  }

  const highlightExpiresAt = copyHighlightExpiresAt(state.highlightExpiresAt);
  delete highlightExpiresAt[id];

  return {
    ...state,
    highlightExpiresAt
  };
}

export function getHighlightRemainingMs(state, id, now = Date.now()) {
  const expiresAt = state.highlightExpiresAt[id];
  if (typeof expiresAt !== 'number') {
    return null;
  }

  return expiresAt - now;
}

export function shouldAutoDismiss(state, now = Date.now()) {
  return state.visible
    && typeof state.shownAt === 'number'
    && now - state.shownAt >= NOTIFICATION_AUTO_DISMISS_MS;
}

export function createNotificationController({
  now = () => Date.now(),
  onStateChange = () => {},
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  let state = createNotificationState();
  let notificationTimeoutId = null;
  const highlightTimeoutIds = new Map();

  function getState() {
    return {
      ...state,
      highlightExpiresAt: copyHighlightExpiresAt(state.highlightExpiresAt)
    };
  }

  function emitChange() {
    onStateChange(getState());
  }

  function setState(nextState) {
    state = nextState;
    emitChange();
    return getState();
  }

  function clearNotificationTimeout() {
    if (notificationTimeoutId !== null) {
      clearTimeoutFn(notificationTimeoutId);
      notificationTimeoutId = null;
    }
  }

  function clearHighlightTimeout(id) {
    const timeoutId = highlightTimeoutIds.get(id);
    if (timeoutId !== undefined) {
      clearTimeoutFn(timeoutId);
      highlightTimeoutIds.delete(id);
    }
  }

  function clearAllHighlightTimeouts() {
    [...highlightTimeoutIds.keys()].forEach(id => clearHighlightTimeout(id));
  }

  function dismiss({ clearHighlights = false } = {}) {
    clearNotificationTimeout();

    if (clearHighlights) {
      clearAllHighlightTimeouts();
    }

    return setState(dismissNotification(state, { clearHighlights }));
  }

  function clearHighlight(id) {
    clearHighlightTimeout(id);
    return setState(clearUnblockedHighlight(state, id));
  }

  function scheduleHighlight(id) {
    clearHighlightTimeout(id);

    const timeoutId = setTimeoutFn(() => {
      highlightTimeoutIds.delete(id);
      state = clearUnblockedHighlight(state, id);
      emitChange();
    }, UNBLOCKED_HIGHLIGHT_MS);

    highlightTimeoutIds.set(id, timeoutId);
  }

  function scheduleAutoDismiss() {
    clearNotificationTimeout();

    notificationTimeoutId = setTimeoutFn(() => {
      notificationTimeoutId = null;
      state = dismissNotification(state);
      emitChange();
    }, NOTIFICATION_AUTO_DISMISS_MS);
  }

  function showUnblocked(unblockedItems) {
    if (unblockedItems.length === 0) {
      return dismiss({ clearHighlights: true });
    }

    const timestamp = now();
    const ids = unblockedItems.map(item => item.id);
    const names = unblockedItems.map(item => item.name);

    ids.forEach(id => scheduleHighlight(id));

    state = highlightUnblockedTodos(state, ids, timestamp);
    state = showUnblockedNotification(state, names, timestamp);
    scheduleAutoDismiss();

    return setState(state);
  }

  return {
    clearHighlight,
    dismiss,
    getHighlightRemainingMs: (id) => getHighlightRemainingMs(state, id, now()),
    getState,
    showUnblocked
  };
}
