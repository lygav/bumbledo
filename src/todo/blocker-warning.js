const ACTION_LABELS = {
  cancel: 'Cancelling',
  delete: 'Deleting',
};

export function getBlockerImpactMessage(action, dependentCount) {
  const actionLabel = ACTION_LABELS[action] ?? 'Changing';
  return `This task blocks ${dependentCount} other task(s). ${actionLabel} it will unblock them. Continue?`;
}

export function confirmBlockerImpact({
  action,
  dependentCount,
  confirm = (message) => window.confirm(message),
}) {
  if (dependentCount === 0) {
    return true;
  }

  return confirm(getBlockerImpactMessage(action, dependentCount));
}
