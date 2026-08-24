import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appsSettingsApiGetUserSettingView,
  appsSettingsApiPutUserSetting,
} from '@/services/openapi/userSettings';
import type { WorkbenchWidgetDefinition } from '../layout/model';
import { useWorkbenchLayoutPreference } from './useWorkbenchLayoutPreference';

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiGetUserSettingView: vi.fn(),
  appsSettingsApiPutUserSetting: vi.fn(),
}));

const definitions: WorkbenchWidgetDefinition[] = [
  {
    id: 'summary',
    title: '概览',
    defaultWidth: 3,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'quick',
    title: '快捷入口',
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useWorkbenchLayoutPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses defaults when the setting does not exist', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('mine', definitions),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.committed).toEqual([
      { id: 'summary', width: 3, visible: true },
      { id: 'quick', width: 1, visible: true },
    ]);
    expect(result.current.loadError).toBe(false);
    expect(appsSettingsApiGetUserSettingView).toHaveBeenCalledWith(
      { key: 'internal.workbench.mine.layout.v1' },
      { skipErrorHandler: true },
    );
  });

  it('normalizes a saved layout', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockResolvedValue({
      key: 'internal.workbench.mine.layout.v1',
      value: [{ id: 'quick', width: 3, visible: true }],
    });

    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('mine', definitions),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.committed).toEqual([
      { id: 'quick', width: 1, visible: true },
      { id: 'summary', width: 3, visible: true },
    ]);
  });

  it('prevents saving when the remote layout failed to load', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockRejectedValue(
      new Error('offline'),
    );

    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('mine', definitions),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.committed).toEqual([
      { id: 'summary', width: 3, visible: true },
      { id: 'quick', width: 1, visible: true },
    ]);
    expect(result.current.canSave).toBe(false);
  });

  it('keeps the draft when saving fails', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockRejectedValue({
      response: { status: 404 },
    });
    vi.mocked(appsSettingsApiPutUserSetting).mockRejectedValue(
      new Error('offline'),
    );

    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('mine', definitions),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => result.current.beginEditing());
    act(() => {
      result.current.setDraft((current) => {
        const [summary, quick] = current;
        if (!summary || !quick) return current;
        return [{ ...quick, width: 2 }, summary];
      });
    });

    await expect(result.current.save()).rejects.toThrow('offline');
    expect(result.current.isEditing).toBe(true);
    expect(result.current.draft).toEqual([
      { id: 'quick', width: 2, visible: true },
      { id: 'summary', width: 3, visible: true },
    ]);
  });

  it('commits the normalized draft after saving', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockRejectedValue({
      response: { status: 404 },
    });
    vi.mocked(appsSettingsApiPutUserSetting).mockImplementation(
      async ({ key }, body) => ({ key, value: body.value }),
    );

    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('space', definitions),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => result.current.beginEditing());
    act(() => {
      result.current.setDraft((current) => {
        const [summary, quick] = current;
        return summary && quick ? [quick, summary] : current;
      });
    });
    await act(async () => result.current.save());

    expect(appsSettingsApiPutUserSetting).toHaveBeenCalledWith(
      { key: 'internal.workbench.space.layout.v1' },
      {
        value: [
          { id: 'quick', width: 1, visible: true },
          { id: 'summary', width: 3, visible: true },
        ],
      },
      { skipErrorHandler: true },
    );
    expect(result.current.isEditing).toBe(false);
    expect(result.current.committed[0]?.id).toBe('quick');
  });
});
