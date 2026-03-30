import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_AUTO_DISMISS_MS,
  UNBLOCKED_HIGHLIGHT_MS,
  createNotificationController,
} from './notification.js';

describe('createNotificationController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses unblocked notifications after five seconds', () => {
    const controller = createNotificationController();

    controller.showUnblocked([{ id: 'a', name: 'Write integration tests' }]);

    expect(controller.getState().visible).toBe(true);

    vi.advanceTimersByTime(NOTIFICATION_AUTO_DISMISS_MS - 1);
    expect(controller.getState().visible).toBe(true);

    vi.advanceTimersByTime(1);
    expect(controller.getState().visible).toBe(false);
  });

  it('updates notification text and resets the dismiss timer for consecutive unblock events', () => {
    const controller = createNotificationController();

    controller.showUnblocked([{ id: 'a', name: 'First follow-up' }]);

    vi.advanceTimersByTime(4000);

    controller.showUnblocked([
      { id: 'b', name: 'Second follow-up' },
      { id: 'c', name: 'Third follow-up' },
    ]);

    expect(controller.getState()).toMatchObject({
      visible: true,
      message:
        "You've unblocked 2 tasks: Second follow-up, Third follow-up. Scroll down to find them.",
      detail:
        "Alert: You've unblocked 2 tasks. Second follow-up, Third follow-up.",
    });

    vi.advanceTimersByTime(1000);
    expect(controller.getState().visible).toBe(true);

    vi.advanceTimersByTime(3999);
    expect(controller.getState().visible).toBe(true);

    vi.advanceTimersByTime(1);
    expect(controller.getState().visible).toBe(false);
  });

  it('clears notification highlights when dismissed explicitly', () => {
    const controller = createNotificationController();

    controller.showUnblocked([
      { id: 'a', name: 'First follow-up' },
      { id: 'b', name: 'Second follow-up' },
    ]);

    expect(controller.getHighlightRemainingMs('a')).toBe(
      UNBLOCKED_HIGHLIGHT_MS,
    );
    expect(controller.getHighlightRemainingMs('b')).toBe(
      UNBLOCKED_HIGHLIGHT_MS,
    );

    controller.dismiss({ clearHighlights: true });

    expect(controller.getState()).toMatchObject({
      visible: false,
      message: '',
      detail: '',
      highlightExpiresAt: {},
    });
    expect(controller.getHighlightRemainingMs('a')).toBeNull();
    expect(controller.getHighlightRemainingMs('b')).toBeNull();
  });
});
