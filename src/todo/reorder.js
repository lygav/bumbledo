export function createTodoReorderController({
  listEl,
  getTodos,
  getVisibleTodos,
  isFiltered,
  isReorderableTodo,
  reorderTodos,
  onReorder,
  onDismissReorderTip = () => {}
}) {
  let draggedId = null;
  let draggedElement = null;
  let touchDragState = null;
  let suppressClickUntil = 0;

  const TOUCH_DRAG_HOLD_MS = 180;
  const TOUCH_DRAG_CANCEL_DISTANCE = 10;

  function reorderVisibleTodos(activeDraggedId, targetId, insertAfter) {
    const todos = getTodos();
    if (isFiltered()) {
      const visibleTodos = getVisibleTodos();
      const reorderedVisible = reorderTodos(visibleTodos, activeDraggedId, targetId, insertAfter);
      if (reorderedVisible === visibleTodos) {
        return todos;
      }

      let visibleIndex = 0;
      return todos.map((todo) => {
        if (!isReorderableTodo(todo)) {
          return todo;
        }

        const replacement = reorderedVisible[visibleIndex];
        visibleIndex += 1;
        return replacement ?? todo;
      });
    }

    return reorderTodos(todos, activeDraggedId, targetId, insertAfter);
  }

  function clearDragIndicators() {
    listEl.querySelectorAll('.drag-over-above, .drag-over-below').forEach((element) => {
      element.classList.remove('drag-over-above', 'drag-over-below');
    });
  }

  function resetDraggedElementStyles() {
    if (!draggedElement) {
      return;
    }

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

  function beginDrag(item, { touch = false } = {}) {
    if (!item?.dataset.id) {
      return;
    }

    draggedId = item.dataset.id;
    draggedElement = item;
    item.classList.add('dragging');
    item.classList.toggle('touch-dragging', touch);
    document.body.classList.add('is-dragging');
  }

  function getDragTarget(item, clientY) {
    clearDragIndicators();
    if (!item || item.dataset.id === draggedId) {
      return null;
    }

    const rect = item.getBoundingClientRect();
    const insertAfter = clientY >= rect.top + rect.height / 2;
    item.classList.add(insertAfter ? 'drag-over-below' : 'drag-over-above');
    return { targetId: item.dataset.id, insertAfter };
  }

  function getDragTargetFromPoint(clientX, clientY) {
    const hoveredElement = document.elementFromPoint(clientX, clientY);
    const item = hoveredElement?.closest('li[data-id]') ?? null;
    return getDragTarget(item, clientY);
  }

  function commitReorder(activeDraggedId, targetId, insertAfter) {
    if (!activeDraggedId || !targetId || activeDraggedId === targetId) {
      return false;
    }

    const nextTodos = reorderVisibleTodos(activeDraggedId, targetId, insertAfter);
    if (nextTodos === getTodos()) {
      return false;
    }

    return onReorder(nextTodos);
  }

  function clearTouchHold() {
    if (!touchDragState) {
      return;
    }

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
    if (!draggedElement || !touchDragState?.active) {
      return;
    }

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

  function handleTouchStart(event) {
    if (event.touches.length !== 1) {
      return;
    }

    const handle = event.target instanceof Element ? event.target.closest('.drag-handle') : null;
    if (!(handle instanceof HTMLElement)) {
      return;
    }

    const item = handle.closest('li[data-id]');
    if (!(item instanceof HTMLElement)) {
      return;
    }

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

  function handleDragStart(event) {
    const item = event.target instanceof Element ? event.target.closest('li[data-id]') : null;
    if (!(item instanceof HTMLElement)) {
      return;
    }

    beginDrag(item);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.dataset.id ?? '');
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const item = event.target instanceof Element ? event.target.closest('li[data-id]') : null;
    getDragTarget(item, event.clientY);
  }

  function handleDragLeave(event) {
    const item = event.target instanceof Element ? event.target.closest('li[data-id]') : null;
    if (item && !item.contains(event.relatedTarget)) {
      item.classList.remove('drag-over-above', 'drag-over-below');
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const targetItem = event.target instanceof Element ? event.target.closest('li[data-id]') : null;
    if (!(targetItem instanceof HTMLElement) || !draggedId) {
      return;
    }

    const dragTarget = getDragTarget(targetItem, event.clientY);
    const activeDraggedId = draggedId;
    cleanupDragState();
    if (!dragTarget) {
      return;
    }

    commitReorder(activeDraggedId, dragTarget.targetId, dragTarget.insertAfter);
  }

  function handleDragEnd() {
    cleanupDragState();
  }

  function handleClickCapture(event) {
    if (performance.now() >= suppressClickUntil) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickUntil = 0;
  }

  function handleTouchMove(event) {
    if (!touchDragState) {
      return;
    }

    if (event.touches.length > 1) {
      resetTouchDragState({ suppressClick: true });
      return;
    }

    const touch = findTouchById(event.touches, touchDragState.touchId);
    if (!touch) {
      return;
    }

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

    if (!draggedId || !draggedElement) {
      return;
    }

    event.preventDefault();
    updateTouchDragPosition(touch.clientX, touch.clientY);
    getDragTargetFromPoint(touch.clientX, touch.clientY);
  }

  function handleTouchEnd(event) {
    if (!touchDragState) {
      return;
    }

    const touch = findTouchById(event.changedTouches, touchDragState.touchId);
    if (!touch) {
      return;
    }

    const activeState = touchDragState.active;
    const dragTarget = activeState ? getDragTargetFromPoint(touch.clientX, touch.clientY) : null;

    const { wasActive, activeDraggedId } = resetTouchDragState({ suppressClick: true });
    if (!activeState) {
      return;
    }

    event.preventDefault();
    if (!wasActive || !dragTarget) {
      return;
    }

    const reordered = commitReorder(activeDraggedId, dragTarget.targetId, dragTarget.insertAfter);
    if (reordered) {
      onDismissReorderTip();
    }
  }

  function handleTouchCancel() {
    if (!touchDragState) {
      return;
    }

    resetTouchDragState({ suppressClick: true });
  }

  return {
    attach() {
      listEl.addEventListener('dragstart', handleDragStart);
      listEl.addEventListener('dragover', handleDragOver);
      listEl.addEventListener('dragleave', handleDragLeave);
      listEl.addEventListener('drop', handleDrop);
      listEl.addEventListener('dragend', handleDragEnd);
      listEl.addEventListener('click', handleClickCapture, true);
      listEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      document.addEventListener('touchcancel', handleTouchCancel);
    },
    detach() {
      listEl.removeEventListener('dragstart', handleDragStart);
      listEl.removeEventListener('dragover', handleDragOver);
      listEl.removeEventListener('dragleave', handleDragLeave);
      listEl.removeEventListener('drop', handleDrop);
      listEl.removeEventListener('dragend', handleDragEnd);
      listEl.removeEventListener('click', handleClickCapture, true);
      listEl.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      resetTouchDragState();
      cleanupDragState();
    },
    reset() {
      clearDragIndicators();
      if (draggedId === null) {
        document.body.classList.remove('is-dragging');
      }
    }
  };
}
