import { describe, expect, it, vi } from 'vitest';
import {
  confirmBlockerImpact,
  getBlockerImpactMessage,
} from './blocker-warning.js';

describe('blocker warning helpers', () => {
  it('builds the delete warning copy with the dependent count', () => {
    expect(getBlockerImpactMessage('delete', 2)).toBe(
      'This task blocks 2 other task(s). Deleting it will unblock them. Continue?',
    );
  });

  it('builds the cancel warning copy with the dependent count', () => {
    expect(getBlockerImpactMessage('cancel', 1)).toBe(
      'This task blocks 1 other task(s). Cancelling it will unblock them. Continue?',
    );
  });

  it('skips confirmation for non-blockers', () => {
    const confirm = vi.fn();

    expect(
      confirmBlockerImpact({ action: 'delete', dependentCount: 0, confirm }),
    ).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('delegates blocker confirmation to the provided confirm function', () => {
    const confirm = vi.fn(() => false);

    expect(
      confirmBlockerImpact({ action: 'cancel', dependentCount: 3, confirm }),
    ).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'This task blocks 3 other task(s). Cancelling it will unblock them. Continue?',
    );
  });
});
