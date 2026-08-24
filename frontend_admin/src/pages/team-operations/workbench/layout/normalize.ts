import type {
  WorkbenchLayoutPreference,
  WorkbenchWidgetDefinition,
  WorkbenchWidgetPreference,
  WorkbenchWidgetWidth,
} from './model';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const defaultWorkbenchLayout = (
  definitions: readonly WorkbenchWidgetDefinition[],
): WorkbenchLayoutPreference =>
  definitions.map((item) => ({
    id: item.id,
    width: item.defaultWidth,
    visible: item.defaultVisible,
  }));

export function normalizeWorkbenchLayout(
  value: unknown,
  definitions: readonly WorkbenchWidgetDefinition[],
): WorkbenchLayoutPreference {
  if (!Array.isArray(value)) return defaultWorkbenchLayout(definitions);

  const byId = new Map(definitions.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const normalized: WorkbenchWidgetPreference[] = [];

  value.forEach((raw) => {
    if (
      !isRecord(raw) ||
      typeof raw.id !== 'string' ||
      seen.has(raw.id)
    ) {
      return;
    }
    const definition = byId.get(raw.id);
    if (!definition) return;

    seen.add(raw.id);
    const width = definition.allowedWidths.includes(
      raw.width as WorkbenchWidgetWidth,
    )
      ? (raw.width as WorkbenchWidgetWidth)
      : definition.defaultWidth;
    normalized.push({
      id: definition.id,
      width,
      visible:
        typeof raw.visible === 'boolean'
          ? raw.visible
          : definition.defaultVisible,
    });
  });

  definitions.forEach((definition) => {
    if (seen.has(definition.id)) return;
    normalized.push({
      id: definition.id,
      width: definition.defaultWidth,
      visible: definition.defaultVisible,
    });
  });

  return normalized;
}

export function setWidgetVisibility(
  current: WorkbenchLayoutPreference,
  widgetId: string,
  visible: boolean,
): WorkbenchLayoutPreference {
  const target = current.find((item) => item.id === widgetId);
  if (!target || target.visible === visible) return current;

  if (!visible) {
    return current.map((item) =>
      item.id === widgetId ? { ...item, visible: false } : item,
    );
  }

  return [
    ...current.filter((item) => item.id !== widgetId),
    { ...target, visible: true },
  ];
}

export function updateWidgetWidth(
  current: WorkbenchLayoutPreference,
  widgetId: string,
  width: WorkbenchWidgetWidth,
  definitions: readonly WorkbenchWidgetDefinition[],
): WorkbenchLayoutPreference {
  const definition = definitions.find((item) => item.id === widgetId);
  if (!definition?.allowedWidths.includes(width)) return current;

  return current.map((item) =>
    item.id === widgetId ? { ...item, width } : item,
  );
}

export const hasVisibleWorkbenchWidget = (
  value: WorkbenchLayoutPreference,
) => value.some((item) => item.visible);

export function isSameWorkbenchLayout(
  left: WorkbenchLayoutPreference,
  right: WorkbenchLayoutPreference,
) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return (
        other?.id === item.id &&
        other.width === item.width &&
        other.visible === item.visible
      );
    })
  );
}
