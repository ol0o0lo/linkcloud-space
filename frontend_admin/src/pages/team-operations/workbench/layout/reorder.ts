import type { WorkbenchLayoutPreference } from './model';

export function reorderWorkbenchWidgets(
  current: WorkbenchLayoutPreference,
  activeId: string,
  overId: string,
): WorkbenchLayoutPreference {
  const from = current.findIndex((item) => item.id === activeId);
  const to = current.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return current;

  const next = [...current];
  const [moved] = next.splice(from, 1);
  if (!moved) return current;
  next.splice(to, 0, moved);
  return next;
}
