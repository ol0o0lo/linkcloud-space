import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListUserSettings, mockPutUserSetting } = vi.hoisted(() => ({
  mockListUserSettings: vi.fn(),
  mockPutUserSetting: vi.fn(),
}));

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiListUserSettings: mockListUserSettings,
  appsSettingsApiPutUserSetting: mockPutUserSetting,
}));

import {
  sanitizeUserTableColumnsState,
  useUserTableColumnsState,
} from './useUserTableColumnsState';

const preferenceKey = 'ui.table.property-rental.houses.columns.v1';
const columnKeys = ['house', 'media', 'actions'] as const;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUserTableColumnsState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUserSettings.mockResolvedValue([]);
    mockPutUserSetting.mockResolvedValue({ key: preferenceKey, value: {} });
  });

  it('只保留允许列的表头显示、位置和固定状态', () => {
    expect(
      sanitizeUserTableColumnsState(
        {
          house: { show: false, order: 2, fixed: 'left', sorter: 'ascend' },
          media: { show: true, order: Number.NaN },
          actions: {},
          obsolete: { show: false, order: 1 },
        },
        columnKeys,
      ),
    ).toEqual({
      house: { show: false, order: 2, fixed: 'left' },
      media: { show: true },
      actions: { fixed: undefined },
    });
  });

  it('加载当前用户保存的表头状态', async () => {
    mockListUserSettings.mockResolvedValue([
      {
        key: preferenceKey,
        value: {
          house: { show: false, order: 3 },
          obsolete: { show: false },
        },
      },
    ]);

    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          preferenceKey,
          columnKeys,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.value).toEqual({
        house: { show: false, order: 3 },
      }),
    );
  });

  it('立即更新表头并防抖保存到个人设置', async () => {
    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          preferenceKey,
          columnKeys,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockListUserSettings).toHaveBeenCalled());

    act(() => {
      result.current.onChange({
        media: { show: false, order: 2 },
        actions: { show: true, fixed: 'right', order: 3 },
        obsolete: { show: false },
      });
    });

    expect(result.current.value).toEqual({
      media: { show: false, order: 2 },
      actions: { show: true, fixed: 'right', order: 3 },
    });
    await waitFor(() =>
      expect(mockPutUserSetting).toHaveBeenCalledWith(
        { key: preferenceKey },
        {
          value: {
            media: { show: false, order: 2 },
            actions: { show: true, fixed: 'right', order: 3 },
          },
        },
      ),
    );
  });

  it('忽略与当前值相同的表头状态回调', async () => {
    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          preferenceKey,
          columnKeys,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockListUserSettings).toHaveBeenCalled());

    act(() => {
      result.current.onChange({ media: { show: false, order: 2 } });
    });
    const previousValue = result.current.value;

    act(() => {
      result.current.onChange({ media: { show: false, order: 2 } });
    });

    expect(result.current.value).toBe(previousValue);
  });
});
