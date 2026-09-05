export type ResponsiveFilterMeasurement = {
  key: string;
  priority?: number;
  width: number;
};

type ResolveResponsiveFilterOverflowOptions = {
  availableWidth: number;
  fixedWidths: number[];
  gap: number;
  items: ResponsiveFilterMeasurement[];
};

export function resolveResponsiveFilterOverflow({
  availableWidth,
  fixedWidths,
  gap,
  items,
}: ResolveResponsiveFilterOverflowOptions) {
  if (availableWidth <= 0) return [];

  const visibleKeys = new Set(items.map((item) => item.key));
  const fixedItemWidths = fixedWidths.filter((width) => width > 0);
  const moveOrder = items
    .map((item, index) => ({
      ...item,
      index,
      movePriority: item.priority ?? index,
    }))
    .sort(
      (left, right) =>
        left.movePriority - right.movePriority || left.index - right.index,
    );

  const currentWidth = () => {
    const visibleItems = items.filter((item) => visibleKeys.has(item.key));
    const itemCount = visibleItems.length + fixedItemWidths.length;
    return (
      visibleItems.reduce((total, item) => total + item.width, 0) +
      fixedItemWidths.reduce((total, width) => total + width, 0) +
      Math.max(0, itemCount - 1) * gap
    );
  };

  for (const item of moveOrder) {
    if (currentWidth() <= availableWidth) break;
    visibleKeys.delete(item.key);
  }

  return items
    .filter((item) => !visibleKeys.has(item.key))
    .map((item) => item.key);
}
