function isHTMLElement(value) {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function getFocusableElements(container) {
  if (!isHTMLElement(container)) {
    return [];
  }

  return [
    ...container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => {
    if (!isHTMLElement(element)) {
      return false;
    }

    return (
      !element.hidden &&
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true'
    );
  });
}

export function createModals({
  helpButton,
  helpModal,
  helpCloseButton,
  blockedCompletionModal,
  blockedCompletionMessage,
  blockedCompletionDismissButton,
}) {
  let helpOpen = false;
  let helpReturnFocusEl = null;
  let blockedOpen = false;
  let blockedReturnFocusEl = null;

  function openHelp() {
    if (helpOpen) {
      return;
    }

    helpReturnFocusEl = isHTMLElement(document.activeElement)
      ? document.activeElement
      : null;
    helpOpen = true;
    helpModal.hidden = false;
    helpButton.setAttribute('aria-expanded', 'true');
    helpCloseButton.focus();
  }

  function closeHelp() {
    if (!helpOpen) {
      return;
    }

    helpOpen = false;
    helpModal.hidden = true;
    helpButton.setAttribute('aria-expanded', 'false');
    if (helpReturnFocusEl?.isConnected) {
      helpReturnFocusEl.focus();
    }
    helpReturnFocusEl = null;
  }

  function toggleHelp() {
    if (helpOpen) {
      closeHelp();
      return;
    }

    openHelp();
  }

  function openBlocked(message, { returnFocusEl = null } = {}) {
    if (blockedOpen) {
      blockedCompletionMessage.textContent = message;
      return;
    }

    blockedReturnFocusEl =
      returnFocusEl ??
      (isHTMLElement(document.activeElement) ? document.activeElement : null);
    blockedCompletionMessage.textContent = message;
    blockedCompletionModal.hidden = false;
    blockedOpen = true;
    blockedCompletionDismissButton.focus();
  }

  function closeBlocked() {
    if (!blockedOpen) {
      return;
    }

    blockedOpen = false;
    blockedCompletionModal.hidden = true;
    if (blockedReturnFocusEl?.isConnected) {
      blockedReturnFocusEl.focus();
    }
    blockedReturnFocusEl = null;
  }

  function trapBlockedFocus(event) {
    if (!blockedOpen || event.key !== 'Tab') {
      return false;
    }

    const focusableElements = getFocusableElements(blockedCompletionModal);
    if (focusableElements.length === 0) {
      event.preventDefault();
      blockedCompletionDismissButton.focus();
      return true;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    const focusInsideModal =
      isHTMLElement(activeElement) &&
      blockedCompletionModal.contains(activeElement);

    if (event.shiftKey) {
      if (!focusInsideModal || activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
      return true;
    }

    if (!focusInsideModal || activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
    return true;
  }

  function handleHelpButtonClick() {
    toggleHelp();
  }

  function handleHelpCloseClick() {
    closeHelp();
  }

  function handleHelpBackdropClick(event) {
    if (event.target === helpModal) {
      closeHelp();
    }
  }

  function handleBlockedDismissClick() {
    closeBlocked();
  }

  function handleBlockedBackdropClick(event) {
    if (event.target === blockedCompletionModal) {
      closeBlocked();
    }
  }

  helpButton.addEventListener('click', handleHelpButtonClick);
  helpCloseButton.addEventListener('click', handleHelpCloseClick);
  helpModal.addEventListener('click', handleHelpBackdropClick);
  blockedCompletionDismissButton.addEventListener(
    'click',
    handleBlockedDismissClick,
  );
  blockedCompletionModal.addEventListener('click', handleBlockedBackdropClick);

  return {
    closeBlocked,
    closeHelp,
    isBlockedOpen: () => blockedOpen,
    isHelpOpen: () => helpOpen,
    openBlocked,
    openHelp,
    toggleHelp,
    trapBlockedFocus,
    destroy() {
      helpButton.removeEventListener('click', handleHelpButtonClick);
      helpCloseButton.removeEventListener('click', handleHelpCloseClick);
      helpModal.removeEventListener('click', handleHelpBackdropClick);
      blockedCompletionDismissButton.removeEventListener(
        'click',
        handleBlockedDismissClick,
      );
      blockedCompletionModal.removeEventListener(
        'click',
        handleBlockedBackdropClick,
      );
    },
  };
}
