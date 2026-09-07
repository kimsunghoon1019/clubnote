export function isInspectDismissClick(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !target.closest(
    "tbody tr, thead, button, a, input, select, textarea, label, [role='dialog'], [data-roster-row], [data-tx-row], [data-detail-surface]",
  );
}
