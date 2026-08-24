import type { ProColumns } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appsSettingsApiDeleteUserTableColumnsView,
  appsSettingsApiGetUserSettingView,
  appsSettingsApiPutUserTableColumns,
} from '@/services/openapi/userSettings';
import type {
  PersistedTableColumnsState,
  TableColumnsState,
} from './userTableColumnsState';
import {
  buildDefaultColumnsState,
  mergePersistedColumnsState,
  mergeRuntimeColumnsState,
  persistedColumnsStateSignature,
  runtimeColumnsStateDelta,
  runtimeColumnsStateSignature,
  sanitizePersistedColumnsState,
  sortColumnsStateKeys,
  toPersistedColumnsState,
} from './userTableColumnsState';

export type { TableColumnsState } from './userTableColumnsState';
export {
  buildDefaultColumnsState,
  mergeRuntimeColumnsState,
  sanitizePersistedColumnsState,
} from './userTableColumnsState';

type UseUserTableColumnsStateOptions<T> = {
  tableKey: string;
  columns: readonly ProColumns<T>[];
  defaultValue?: TableColumnsState;
  debounceMs?: number;
};

const USER_TABLE_COLUMNS_SETTING_KEY = 'internal.ui.table_columns';
const USER_TABLE_COLUMNS_QUERY_KEY = [
  'user-setting',
  USER_TABLE_COLUMNS_SETTING_KEY,
] as const;

type TableColumnsSettingQueryData = {
  exists: boolean;
  value: Record<string, unknown>;
};

type PendingWrite =
  | { kind: 'put'; value: PersistedTableColumnsState }
  | { kind: 'delete' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function loadTableColumnsSetting(): Promise<TableColumnsSettingQueryData> {
  try {
    const setting = await appsSettingsApiGetUserSettingView(
      { key: USER_TABLE_COLUMNS_SETTING_KEY },
      { skipErrorHandler: true },
    );
    return {
      exists: true,
      value: isRecord(setting.value) ? setting.value : {},
    };
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      return { exists: false, value: {} };
    }
    throw error;
  }
}

export function useUserTableColumnsState<T>({
  tableKey,
  columns,
  defaultValue = {},
  debounceMs = 500,
}: UseUserTableColumnsStateOptions<T>) {
  const queryClient = useQueryClient();
  const builtDefaults = buildDefaultColumnsState(columns, defaultValue);
  const builtDefaultsSignature = runtimeColumnsStateSignature(builtDefaults);
  const stableDefaultsRef = useRef({
    signature: builtDefaultsSignature,
    value: builtDefaults,
  });
  if (stableDefaultsRef.current.signature !== builtDefaultsSignature) {
    stableDefaultsRef.current = {
      signature: builtDefaultsSignature,
      value: builtDefaults,
    };
  }
  const defaults = stableDefaultsRef.current.value;
  const defaultKeys = useMemo(() => sortColumnsStateKeys(defaults), [defaults]);
  const allowedColumnKeys = useMemo(() => new Set(defaultKeys), [defaultKeys]);
  const defaultPersistedSignature = useMemo(
    () =>
      persistedColumnsStateSignature(
        toPersistedColumnsState(defaults, defaultKeys),
      ),
    [defaultKeys, defaults],
  );
  const identity = `${tableKey}:${builtDefaultsSignature}`;

  const [value, setValue] = useState<TableColumnsState>(defaults);
  const [isSaving, setIsSaving] = useState(false);
  const valueRef = useRef(value);
  const mountedRef = useRef(true);
  const hydratedIdentityRef = useRef<string | undefined>(undefined);
  const locallyChangedRef = useRef(false);
  const resetBeforeHydrationRef = useRef(false);
  const writeBlockedRef = useRef(false);
  const queryReadyRef = useRef(false);
  const pendingWriteRef = useRef<PendingWrite | undefined>(undefined);
  const pendingWriteReadyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const writeInFlightRef = useRef<Promise<void> | undefined>(undefined);
  const flushPendingWriteRef = useRef<() => void>(() => undefined);

  const columnsQuery = useQuery({
    queryKey: USER_TABLE_COLUMNS_QUERY_KEY,
    queryFn: loadTableColumnsSetting,
    retry: false,
    staleTime: 60_000,
  });
  queryReadyRef.current = columnsQuery.isSuccess;

  const updateQueryCache = useCallback(
    (write: PendingWrite) => {
      queryClient.setQueryData<TableColumnsSettingQueryData>(
        USER_TABLE_COLUMNS_QUERY_KEY,
        (current) => {
          const nextValue = { ...(current?.value || {}) };
          if (write.kind === 'put') nextValue[tableKey] = write.value;
          else delete nextValue[tableKey];
          return {
            exists: Object.keys(nextValue).length > 0,
            value: nextValue,
          };
        },
      );
    },
    [queryClient, tableKey],
  );

  const sendWrite = useCallback(
    async (write: PendingWrite, notifyError: boolean) => {
      try {
        if (write.kind === 'put') {
          await appsSettingsApiPutUserTableColumns(
            { table_key: tableKey },
            write.value,
            { skipErrorHandler: true },
          );
        } else {
          await appsSettingsApiDeleteUserTableColumnsView(
            { table_key: tableKey },
            { skipErrorHandler: true },
          );
        }
        updateQueryCache(write);
      } catch (error) {
        if (notifyError && mountedRef.current) {
          message.error('表头设置保存失败');
        }
        throw error;
      }
    },
    [tableKey, updateQueryCache],
  );

  const flushPendingWrite = useCallback(() => {
    if (
      !pendingWriteReadyRef.current ||
      writeInFlightRef.current ||
      writeBlockedRef.current ||
      !queryReadyRef.current
    ) {
      return;
    }
    const write = pendingWriteRef.current;
    if (!write) return;

    pendingWriteRef.current = undefined;
    pendingWriteReadyRef.current = false;
    if (mountedRef.current) setIsSaving(true);
    const request = sendWrite(write, true)
      .catch(() => undefined)
      .finally(() => {
        writeInFlightRef.current = undefined;
        if (mountedRef.current) setIsSaving(false);
        flushPendingWriteRef.current();
      });
    writeInFlightRef.current = request;
  }, [sendWrite]);
  flushPendingWriteRef.current = flushPendingWrite;

  const scheduleWrite = useCallback(
    (write: PendingWrite) => {
      if (writeBlockedRef.current) return;
      pendingWriteRef.current = write;
      pendingWriteReadyRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = undefined;
        pendingWriteReadyRef.current = true;
        flushPendingWriteRef.current();
      }, debounceMs);
    },
    [debounceMs],
  );

  const writeForRuntimeValue = useCallback(
    (runtimeValue: TableColumnsState) => {
      const persisted = toPersistedColumnsState(runtimeValue, defaultKeys);
      const write: PendingWrite =
        persistedColumnsStateSignature(persisted) === defaultPersistedSignature
          ? { kind: 'delete' }
          : { kind: 'put', value: persisted };
      scheduleWrite(write);
    },
    [defaultKeys, defaultPersistedSignature, scheduleWrite],
  );

  useEffect(() => {
    if (!columnsQuery.isError || writeBlockedRef.current) return;
    writeBlockedRef.current = true;
    pendingWriteRef.current = undefined;
    pendingWriteReadyRef.current = false;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = undefined;
    message.error('表头设置加载失败，当前调整不会保存');
  }, [columnsQuery.isError]);

  useEffect(() => {
    hydratedIdentityRef.current = undefined;
    locallyChangedRef.current = false;
    resetBeforeHydrationRef.current = false;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = undefined;
    pendingWriteRef.current = undefined;
    pendingWriteReadyRef.current = false;
    valueRef.current = defaults;
    setValue(defaults);
  }, [defaults, identity]);

  useEffect(() => {
    if (!columnsQuery.isSuccess || hydratedIdentityRef.current === identity) {
      return;
    }
    hydratedIdentityRef.current = identity;
    const persisted = sanitizePersistedColumnsState(
      columnsQuery.data.value[tableKey],
      allowedColumnKeys,
    );

    if (resetBeforeHydrationRef.current) {
      valueRef.current = defaults;
      setValue(defaults);
      locallyChangedRef.current = false;
      resetBeforeHydrationRef.current = false;
      scheduleWrite({ kind: 'delete' });
      return;
    }

    if (locallyChangedRef.current) {
      const rebasedPersisted = mergePersistedColumnsState(
        persisted,
        runtimeColumnsStateDelta(defaults, valueRef.current),
      );
      const rebasedRuntime = mergeRuntimeColumnsState(
        defaults,
        rebasedPersisted,
      );
      valueRef.current = rebasedRuntime;
      setValue(rebasedRuntime);
      locallyChangedRef.current = false;
      writeForRuntimeValue(rebasedRuntime);
      return;
    }

    const remoteRuntime = mergeRuntimeColumnsState(defaults, persisted);
    valueRef.current = remoteRuntime;
    setValue(remoteRuntime);
  }, [
    allowedColumnKeys,
    columnsQuery.data,
    columnsQuery.isSuccess,
    defaults,
    identity,
    scheduleWrite,
    tableKey,
    writeForRuntimeValue,
  ]);

  const onChange = useCallback(
    (nextValue: TableColumnsState) => {
      const completeNextValue = Object.fromEntries(
        defaultKeys.map((key) => [
          key,
          { ...(defaults[key] || {}), ...(nextValue[key] || {}) },
        ]),
      );
      const runtimeValue = mergeRuntimeColumnsState(
        defaults,
        toPersistedColumnsState(completeNextValue, defaultKeys),
      );
      if (
        runtimeColumnsStateSignature(valueRef.current) ===
        runtimeColumnsStateSignature(runtimeValue)
      ) {
        return;
      }

      valueRef.current = runtimeValue;
      setValue(runtimeValue);
      locallyChangedRef.current = true;
      if (!columnsQuery.isSuccess) {
        resetBeforeHydrationRef.current =
          persistedColumnsStateSignature(
            toPersistedColumnsState(runtimeValue, defaultKeys),
          ) === defaultPersistedSignature;
        return;
      }
      writeForRuntimeValue(runtimeValue);
    },
    [
      columnsQuery.isSuccess,
      defaultKeys,
      defaultPersistedSignature,
      defaults,
      writeForRuntimeValue,
    ],
  );

  const reset = useCallback(() => {
    valueRef.current = defaults;
    setValue(defaults);
    locallyChangedRef.current = true;
    if (!columnsQuery.isSuccess) {
      resetBeforeHydrationRef.current = true;
      return;
    }
    scheduleWrite({ kind: 'delete' });
  }, [columnsQuery.isSuccess, defaults, scheduleWrite]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
      const pendingWrite = pendingWriteRef.current;
      pendingWriteRef.current = undefined;
      pendingWriteReadyRef.current = false;
      if (!pendingWrite || writeBlockedRef.current || !queryReadyRef.current) {
        return;
      }

      const submitPendingWrite = () =>
        sendWrite(pendingWrite, false).catch(() => undefined);
      if (writeInFlightRef.current) {
        void writeInFlightRef.current.finally(submitPendingWrite);
      } else {
        void submitPendingWrite();
      }
    };
  }, [sendWrite]);

  return {
    value,
    onChange,
    reset,
    isLoading: columnsQuery.isPending,
    isSaving,
  };
}
