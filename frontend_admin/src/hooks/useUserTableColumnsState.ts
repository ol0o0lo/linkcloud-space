import type { ColumnsState } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appsSettingsApiListUserSettings,
  appsSettingsApiPutUserSetting,
} from '@/services/openapi/userSettings';

export type TableColumnsState = Record<string, ColumnsState>;

type UseUserTableColumnsStateOptions = {
  preferenceKey: string;
  columnKeys: readonly string[];
  debounceMs?: number;
};

const USER_SETTINGS_QUERY_KEY = ['user-settings'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTableColumnsState(
  value: unknown,
  allowedColumnKeys: ReadonlySet<string>,
): TableColumnsState {
  if (!isRecord(value)) return {};

  const result: TableColumnsState = {};
  Object.entries(value).forEach(([columnKey, rawState]) => {
    if (!allowedColumnKeys.has(columnKey) || !isRecord(rawState)) return;

    const state: ColumnsState = {};
    let hasSupportedValue = false;
    if (typeof rawState.show === 'boolean') {
      state.show = rawState.show;
      hasSupportedValue = true;
    }
    if (rawState.fixed === 'left' || rawState.fixed === 'right') {
      state.fixed = rawState.fixed;
      hasSupportedValue = true;
    } else if (
      (Object.hasOwn(rawState, 'fixed') && rawState.fixed == null) ||
      Object.keys(rawState).length === 0
    ) {
      state.fixed = undefined;
      hasSupportedValue = true;
    }
    if (typeof rawState.order === 'number' && Number.isFinite(rawState.order)) {
      state.order = rawState.order;
      hasSupportedValue = true;
    }
    if (hasSupportedValue) result[columnKey] = state;
  });
  return result;
}

export function sanitizeUserTableColumnsState(
  value: unknown,
  columnKeys: readonly string[],
): TableColumnsState {
  return normalizeTableColumnsState(value, new Set(columnKeys));
}

function isSameTableColumnsState(
  current: TableColumnsState,
  next: TableColumnsState,
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;

  return currentKeys.every((key) => {
    const currentColumn = current[key];
    const nextColumn = next[key];
    return (
      nextColumn !== undefined &&
      currentColumn.show === nextColumn.show &&
      currentColumn.fixed === nextColumn.fixed &&
      currentColumn.order === nextColumn.order
    );
  });
}

export function useUserTableColumnsState({
  preferenceKey,
  columnKeys,
  debounceMs = 500,
}: UseUserTableColumnsStateOptions) {
  const queryClient = useQueryClient();
  const allowedColumnKeys = useMemo(() => new Set(columnKeys), [columnKeys]);
  const [value, setValue] = useState<TableColumnsState>({});
  const valueRef = useRef(value);
  const hydratedPreferenceKeyRef = useRef<string | undefined>(undefined);
  const locallyChangedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pendingValueRef = useRef<TableColumnsState | undefined>(undefined);

  const userSettingsQuery = useQuery({
    queryKey: USER_SETTINGS_QUERY_KEY,
    queryFn: () => appsSettingsApiListUserSettings(),
    staleTime: 60_000,
  });
  const cacheUserSetting = useCallback(
    (setting: API.UserSettingOut) => {
      queryClient.setQueryData<API.UserSettingOut[]>(
        USER_SETTINGS_QUERY_KEY,
        (current = []) => [
          ...current.filter((item) => item.key !== setting.key),
          setting,
        ],
      );
    },
    [queryClient],
  );
  const saveMutation = useMutation({
    mutationFn: (nextValue: TableColumnsState) =>
      appsSettingsApiPutUserSetting(
        { key: preferenceKey },
        { value: nextValue },
      ),
    onSuccess: cacheUserSetting,
  });

  useEffect(() => {
    hydratedPreferenceKeyRef.current = undefined;
    locallyChangedRef.current = false;
    valueRef.current = {};
    setValue({});
  }, [preferenceKey]);

  useEffect(() => {
    if (
      !userSettingsQuery.isSuccess ||
      hydratedPreferenceKeyRef.current === preferenceKey
    ) {
      return;
    }
    hydratedPreferenceKeyRef.current = preferenceKey;
    if (locallyChangedRef.current) return;

    const savedValue = userSettingsQuery.data.find(
      (setting) => setting.key === preferenceKey,
    )?.value;
    const normalizedValue = normalizeTableColumnsState(
      savedValue,
      allowedColumnKeys,
    );
    valueRef.current = normalizedValue;
    setValue(normalizedValue);
  }, [
    allowedColumnKeys,
    preferenceKey,
    userSettingsQuery.data,
    userSettingsQuery.isSuccess,
  ]);

  const onChange = useCallback(
    (nextValue: TableColumnsState) => {
      const normalizedValue = normalizeTableColumnsState(
        nextValue,
        allowedColumnKeys,
      );
      if (isSameTableColumnsState(valueRef.current, normalizedValue)) {
        return;
      }
      locallyChangedRef.current = true;
      hydratedPreferenceKeyRef.current = preferenceKey;
      pendingValueRef.current = normalizedValue;
      valueRef.current = normalizedValue;
      setValue(normalizedValue);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const pendingValue = pendingValueRef.current;
        pendingValueRef.current = undefined;
        saveTimerRef.current = undefined;
        if (pendingValue) saveMutation.mutate(pendingValue);
      }, debounceMs);
    },
    [allowedColumnKeys, debounceMs, preferenceKey, saveMutation],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const pendingValue = pendingValueRef.current;
      pendingValueRef.current = undefined;
      saveTimerRef.current = undefined;
      if (pendingValue) {
        void appsSettingsApiPutUserSetting(
          { key: preferenceKey },
          { value: pendingValue },
          { skipErrorHandler: true },
        )
          .then(cacheUserSetting)
          .catch(() => undefined);
      }
    },
    [cacheUserSetting, preferenceKey],
  );

  return {
    value,
    onChange,
    isLoading: userSettingsQuery.isPending,
    isSaving: saveMutation.isPending,
  };
}
