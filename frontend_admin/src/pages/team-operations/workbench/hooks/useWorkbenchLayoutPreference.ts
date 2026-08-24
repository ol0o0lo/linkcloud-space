import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appsSettingsApiGetUserSettingView,
  appsSettingsApiPutUserSetting,
} from '@/services/openapi/userSettings';
import type { WorkbenchView } from '../view';
import type {
  WorkbenchLayoutPreference,
  WorkbenchWidgetDefinition,
} from '../layout/model';
import { WORKBENCH_LAYOUT_KEYS } from '../layout/model';
import {
  defaultWorkbenchLayout,
  hasVisibleWorkbenchWidget,
  isSameWorkbenchLayout,
  normalizeWorkbenchLayout,
} from '../layout/normalize';

type LoadedWorkbenchLayout = {
  found: boolean;
  value: unknown;
};

export type UseWorkbenchLayoutPreferenceResult = {
  committed: WorkbenchLayoutPreference;
  draft: WorkbenchLayoutPreference;
  rendered: WorkbenchLayoutPreference;
  isReady: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isEditing: boolean;
  isDirty: boolean;
  loadError: boolean;
  canSave: boolean;
  beginEditing: () => void;
  cancelEditing: () => void;
  restoreDefaults: () => void;
  setDraft: Dispatch<SetStateAction<WorkbenchLayoutPreference>>;
  retry: () => Promise<unknown>;
  save: () => Promise<void>;
};

async function loadWorkbenchLayout(key: string): Promise<LoadedWorkbenchLayout> {
  try {
    const setting = await appsSettingsApiGetUserSettingView(
      { key },
      { skipErrorHandler: true },
    );
    return { found: true, value: setting.value };
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      return { found: false, value: undefined };
    }
    throw error;
  }
}

export function useWorkbenchLayoutPreference(
  view: WorkbenchView,
  definitions: readonly WorkbenchWidgetDefinition[],
): UseWorkbenchLayoutPreferenceResult {
  const queryClient = useQueryClient();
  const key = WORKBENCH_LAYOUT_KEYS[view];
  const queryKey = useMemo(() => ['workbench-layout', key] as const, [key]);
  const defaults = useMemo(
    () => defaultWorkbenchLayout(definitions),
    [definitions],
  );
  const [committed, setCommitted] =
    useState<WorkbenchLayoutPreference>(defaults);
  const [draft, setDraft] = useState<WorkbenchLayoutPreference>(defaults);
  const [isEditing, setIsEditing] = useState(false);

  const layoutQuery = useQuery({
    queryKey,
    queryFn: () => loadWorkbenchLayout(key),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    setCommitted(defaults);
    setDraft(defaults);
    setIsEditing(false);
  }, [defaults, key]);

  useEffect(() => {
    if (!layoutQuery.isSuccess || isEditing) return;
    const normalized = layoutQuery.data.found
      ? normalizeWorkbenchLayout(layoutQuery.data.value, definitions)
      : defaults;
    setCommitted(normalized);
    setDraft(normalized);
  }, [defaults, definitions, isEditing, layoutQuery.data, layoutQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: (value: WorkbenchLayoutPreference) =>
      appsSettingsApiPutUserSetting(
        { key },
        { value },
        { skipErrorHandler: true },
      ),
  });

  const beginEditing = useCallback(() => {
    setDraft(committed);
    setIsEditing(true);
  }, [committed]);

  const cancelEditing = useCallback(() => {
    setDraft(committed);
    setIsEditing(false);
  }, [committed]);

  const restoreDefaults = useCallback(() => {
    setDraft(defaults);
  }, [defaults]);

  const save = useCallback(async () => {
    if (layoutQuery.isError) {
      throw new Error('个性化布局尚未加载，无法保存');
    }
    const normalized = normalizeWorkbenchLayout(draft, definitions);
    if (!hasVisibleWorkbenchWidget(normalized)) {
      throw new Error('工作台至少需要保留一个组件');
    }
    await saveMutation.mutateAsync(normalized);
    queryClient.setQueryData<LoadedWorkbenchLayout>(queryKey, {
      found: true,
      value: normalized,
    });
    setCommitted(normalized);
    setDraft(normalized);
    setIsEditing(false);
  }, [definitions, draft, layoutQuery.isError, queryClient, queryKey, saveMutation]);

  const isDirty = !isSameWorkbenchLayout(committed, draft);

  return {
    committed,
    draft,
    rendered: isEditing ? draft : committed,
    isReady: !layoutQuery.isPending,
    isLoading: layoutQuery.isPending,
    isSaving: saveMutation.isPending,
    isEditing,
    isDirty,
    loadError: layoutQuery.isError,
    canSave:
      !layoutQuery.isError &&
      !layoutQuery.isPending &&
      hasVisibleWorkbenchWidget(draft),
    beginEditing,
    cancelEditing,
    restoreDefaults,
    setDraft,
    retry: async () => layoutQuery.refetch(),
    save,
  };
}
