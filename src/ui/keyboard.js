function isMacPlatform(navigatorLike = globalThis.navigator) {
  if (!navigatorLike) {
    return false;
  }

  return /Mac|iPhone|iPad|iPod/i.test(
    navigatorLike.platform || navigatorLike.userAgent || '',
  );
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]') ||
    target.isContentEditable,
  );
}

export function createKeyboardController({ document, getState, actions }) {
  const prefersMacKeys = isMacPlatform(document.defaultView?.navigator);

  function handleKeydown(event) {
    const state = getState();
    const isTyping = isEditableTarget(event.target);

    if (event.key === 'Escape') {
      if (state.blockedModalOpen) {
        event.preventDefault();
        actions.closeBlockedModal();
        return;
      }

      if (state.helpModalOpen) {
        event.preventDefault();
        actions.closeHelpModal();
        return;
      }

      if (isTyping && state.editing) {
        event.preventDefault();
        actions.cancelEdit();
        return;
      }

      if (isTyping || state.selectedTaskId === null) {
        return;
      }

      event.preventDefault();
      actions.clearSelection({ focusList: true });
      return;
    }

    if (state.blockedModalOpen && event.key === 'Tab') {
      if (actions.trapBlockedModalFocus(event)) {
        return;
      }
    }

    if (state.blockedModalOpen) {
      return;
    }

    const modifierPressed = prefersMacKeys
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;

    if (modifierPressed && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      actions.focusTodoInput();
      return;
    }

    if (isTyping) {
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      actions.toggleHelp();
      return;
    }

    if (state.helpModalOpen) {
      return;
    }

    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
      state.canNavigate
    ) {
      event.preventDefault();
      actions.moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (!state.selectedTaskId) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      actions.toggleSelectedTodoStatus();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      actions.deleteSelectedTodo();
    }
  }

  return {
    attach() {
      document.addEventListener('keydown', handleKeydown);
    },
    detach() {
      document.removeEventListener('keydown', handleKeydown);
    },
    getFocusInputShortcutMarkup() {
      return prefersMacKeys
        ? '<kbd>Cmd</kbd> <span>+</span> <kbd>Shift</kbd> <span>+</span> <kbd>A</kbd>'
        : '<kbd>Ctrl</kbd> <span>+</span> <kbd>Shift</kbd> <span>+</span> <kbd>A</kbd>';
    },
  };
}
