import type { ColumnsState, ProColumns } from '@ant-design/pro-components';

export type TableColumnsState = Record<string, ColumnsState>;

export type PersistedColumnState = {
  show?: boolean;
  fixed?: 'left' | 'right' | null;
  order?: number;
};

export type PersistedTableColumnsState = Record<string, PersistedColumnState>;

type ColumnDescriptor = {
  key: string;
  fixed?: 'left' | 'right';
  disable?: boolean;
  index: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeFixed(value: unknown): 'left' | 'right' | undefined {
  return value === 'left' || value === 'right' ? value : undefined;
}

function collectColumnDescriptors<T>(
  columns: readonly ProColumns<T>[],
  result: ColumnDescriptor[] = [],
  seen = new Set<string>(),
): ColumnDescriptor[] {
  columns.forEach((column) => {
    if (column.key !== undefined && column.key !== null) {
      const key = String(column.key);
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          key,
          fixed: normalizeFixed(column.fixed),
          disable: column.disable === true ? true : undefined,
          index: result.length,
        });
      }
    }
    if (column.children?.length) {
      collectColumnDescriptors(
        column.children as readonly ProColumns<T>[],
        result,
        seen,
      );
    }
  });
  return result;
}

export function sortColumnsStateKeys(value: TableColumnsState): string[] {
  return Object.keys(value).sort((left, right) => {
    const leftOrder = value[left]?.order;
    const rightOrder = value[right]?.order;
    const normalizedLeft = isFiniteNumber(leftOrder)
      ? leftOrder
      : Number.MAX_SAFE_INTEGER;
    const normalizedRight = isFiniteNumber(rightOrder)
      ? rightOrder
      : Number.MAX_SAFE_INTEGER;
    return normalizedLeft - normalizedRight;
  });
}

export function buildDefaultColumnsState<T>(
  columns: readonly ProColumns<T>[],
  defaultValue: TableColumnsState = {},
): TableColumnsState {
  const defaults: TableColumnsState = {};
  collectColumnDescriptors(columns).forEach((descriptor) => {
    const configured = defaultValue[descriptor.key];
    const state: ColumnsState = {
      show: typeof configured?.show === 'boolean' ? configured.show : true,
      order: isFiniteNumber(configured?.order)
        ? configured.order
        : descriptor.index,
    };

    const fixed = Object.hasOwn(configured || {}, 'fixed')
      ? normalizeFixed(configured?.fixed)
      : descriptor.fixed;
    if (fixed) state.fixed = fixed;

    const disable =
      typeof configured?.disable === 'boolean'
        ? configured.disable
        : descriptor.disable;
    if (disable !== undefined) state.disable = disable;
    defaults[descriptor.key] = state;
  });

  sortColumnsStateKeys(defaults).forEach((key, order) => {
    const state = defaults[key];
    if (state) state.order = order;
  });
  return defaults;
}

export function sanitizePersistedColumnsState(
  value: unknown,
  allowedColumnKeys: ReadonlySet<string>,
): PersistedTableColumnsState {
  if (!isRecord(value)) return {};

  const result: PersistedTableColumnsState = {};
  Object.entries(value).forEach(([columnKey, rawState]) => {
    if (!allowedColumnKeys.has(columnKey) || !isRecord(rawState)) return;
    const state: PersistedColumnState = {};
    if (typeof rawState.show === 'boolean') state.show = rawState.show;
    if (Object.hasOwn(rawState, 'fixed')) {
      if (rawState.fixed === null) state.fixed = null;
      else {
        const fixed = normalizeFixed(rawState.fixed);
        if (fixed) state.fixed = fixed;
      }
    }
    if (isFiniteNumber(rawState.order)) state.order = rawState.order;
    if (Object.keys(state).length > 0) result[columnKey] = state;
  });
  return result;
}

export function mergeRuntimeColumnsState(
  defaults: TableColumnsState,
  persisted: PersistedTableColumnsState,
): TableColumnsState {
  const defaultKeys = sortColumnsStateKeys(defaults);
  const defaultIndex = new Map(
    defaultKeys.map((key, index) => [key, index] as const),
  );
  const persistedOrderedKeys = defaultKeys
    .filter((key) => isFiniteNumber(persisted[key]?.order))
    .sort((left, right) => {
      const difference =
        (persisted[left]?.order ?? 0) - (persisted[right]?.order ?? 0);
      if (difference !== 0) return difference;
      return (defaultIndex.get(left) ?? 0) - (defaultIndex.get(right) ?? 0);
    });
  const persistedOrderSet = new Set(persistedOrderedKeys);
  let nextPersistedIndex = 0;
  const runtimeKeys = defaultKeys.map((key) => {
    if (!persistedOrderSet.has(key)) return key;
    const persistedKey = persistedOrderedKeys[nextPersistedIndex];
    nextPersistedIndex += 1;
    return persistedKey || key;
  });

  const result: TableColumnsState = {};
  runtimeKeys.forEach((key, order) => {
    const defaultState = defaults[key] || {};
    const persistedState = persisted[key];
    const state: ColumnsState = { ...defaultState, order };
    if (typeof persistedState?.show === 'boolean') {
      state.show = persistedState.show;
    }
    if (persistedState && Object.hasOwn(persistedState, 'fixed')) {
      if (persistedState.fixed === null) delete state.fixed;
      else state.fixed = persistedState.fixed;
    }
    if (defaultState.disable !== undefined) {
      state.disable = defaultState.disable;
    } else {
      delete state.disable;
    }
    result[key] = state;
  });
  return result;
}

export function toPersistedColumnsState(
  value: TableColumnsState,
  allowedColumnKeys: readonly string[],
): PersistedTableColumnsState {
  const result: PersistedTableColumnsState = {};
  allowedColumnKeys.forEach((columnKey) => {
    const rawState = value[columnKey] || {};
    const state: PersistedColumnState = {
      fixed: normalizeFixed(rawState.fixed) || null,
    };
    if (typeof rawState.show === 'boolean') state.show = rawState.show;
    if (isFiniteNumber(rawState.order)) state.order = rawState.order;
    result[columnKey] = state;
  });
  return result;
}

export function runtimeColumnsStateDelta(
  defaults: TableColumnsState,
  current: TableColumnsState,
): PersistedTableColumnsState {
  const result: PersistedTableColumnsState = {};
  Object.keys(defaults).forEach((key) => {
    const defaultState = defaults[key] || {};
    const currentState = current[key] || {};
    const delta: PersistedColumnState = {};
    if (currentState.show !== defaultState.show) delta.show = currentState.show;
    const defaultFixed = normalizeFixed(defaultState.fixed) || null;
    const currentFixed = normalizeFixed(currentState.fixed) || null;
    if (currentFixed !== defaultFixed) delta.fixed = currentFixed;
    if (currentState.order !== defaultState.order) {
      delta.order = currentState.order;
    }
    if (Object.keys(delta).length > 0) result[key] = delta;
  });
  return result;
}

export function mergePersistedColumnsState(
  base: PersistedTableColumnsState,
  overrides: PersistedTableColumnsState,
): PersistedTableColumnsState {
  const result = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    result[key] = { ...(result[key] || {}), ...value };
  });
  return result;
}

export function persistedColumnsStateSignature(
  value: PersistedTableColumnsState,
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, value[key]]),
    ),
  );
}

export function runtimeColumnsStateSignature(value: TableColumnsState): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => {
          const state = value[key] || {};
          return [
            key,
            {
              show: state.show,
              fixed: normalizeFixed(state.fixed) || null,
              order: state.order,
              disable: state.disable,
            },
          ];
        }),
    ),
  );
}
