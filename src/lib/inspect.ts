export function isInspectDismissClick(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !target.closest("tbody tr, button, a, input, select, textarea, label, [role='dialog']");
}
