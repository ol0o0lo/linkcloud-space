import type { ProColumns } from '@ant-design/pro-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDeleteTableColumns,
  mockGetUserSetting,
  mockMessageError,
  mockPutTableColumns,
} = vi.hoisted(() => ({
  mockDeleteTableColumns: vi.fn(),
  mockGetUserSetting: vi.fn(),
  mockMessageError: vi.fn(),
  mockPutTableColumns: vi.fn(),
}));

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiDeleteUserTableColumnsView: mockDeleteTableColumns,
  appsSettingsApiGetUserSettingView: mockGetUserSetting,
  appsSettingsApiPutUserTableColumns: mockPutTableColumns,
}));

vi.mock('antd', () => ({ message: { error: mockMessageError } }));

import {
  buildDefaultColumnsState,
  mergeRuntimeColumnsState,
  sanitizePersistedColumnsState,
  useUserTableColumnsState,
} from './useUserTableColumnsState';

type Row = { id: number };

const columns: ProColumns<Row>[] = [
  { key: 'house', dataIndex: 'house', fixed: 'left' },
  { key: 'media', dataIndex: 'media' },
  {
    key: 'actions',
    dataIndex: 'actions',
    fixed: 'right',
    disable: true,
  },
];

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
    mockGetUserSetting.mockRejectedValue({ response: { status: 404 } });
    mockPutTableColumns.mockResolvedValue({});
    mockDeleteTableColumns.mockResolvedValue({});
  });

  it('只保留允许列的可持久化字段', () => {
    expect(
      sanitizePersistedColumnsState(
        {
          house: { show: false, order: 2, fixed: 'left', sorter: 'ascend' },
          media: { show: true, fixed: null, order: Number.NaN },
          actions: { disable: true },
          obsolete: { show: false },
        },
        new Set(['house', 'media', 'actions']),
      ),
    ).toEqual({
      house: { show: false, order: 2, fixed: 'left' },
      media: { show: true, fixed: null },
    });
  });

  it('把新增列放在当前前端默认位置并保留旧列相对顺序', () => {
    const defaults = buildDefaultColumnsState<Row>([
      { key: 'a', dataIndex: 'a' },
      { key: 'c', dataIndex: 'c' },
      { key: 'b', dataIndex: 'b' },
    ]);

    const result = mergeRuntimeColumnsState(defaults, {
      a: { order: 1 },
      b: { order: 0 },
    });

    expect(
      Object.entries(result)
        .sort(([, left], [, right]) => Number(left.order) - Number(right.order))
        .map(([key]) => key),
    ).toEqual(['b', 'c', 'a']);
  });

  it('加载统一设置并合并前端固定与禁用约束', async () => {
    mockGetUserSetting.mockResolvedValue({
      key: 'internal.ui.table_columns',
      value: {
        'rental.houses': {
          house: { show: false, fixed: null, order: 1 },
          media: { show: true, order: 0 },
          obsolete: { show: false, order: 1 },
        },
      },
    });

    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          tableKey: 'rental.houses',
          columns,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.value.house).toEqual({ show: false, order: 1 });
    expect(result.current.value.media).toEqual({ show: true, order: 0 });
    expect(result.current.value.actions).toEqual({
      show: true,
      fixed: 'right',
      disable: true,
      order: 2,
    });
  });

  it('立即更新并只保存 Ant Design 可持久化字段', async () => {
    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          tableKey: 'rental.houses',
          columns,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onChange({
        house: { show: false, fixed: undefined, order: 0 },
        media: { show: true, order: 1 },
        actions: {
          show: true,
          fixed: 'right',
          order: 2,
          disable: true,
        },
      });
    });

    expect(result.current.value.house).toEqual({ show: false, order: 0 });
    await waitFor(() =>
      expect(mockPutTableColumns).toHaveBeenCalledWith(
        { table_key: 'rental.houses' },
        {
          house: { show: false, fixed: null, order: 0 },
          media: { show: true, fixed: null, order: 1 },
          actions: { show: true, fixed: 'right', order: 2 },
        },
        { skipErrorHandler: true },
      ),
    );
  });

  it('重置为前端默认状态时删除当前列表配置', async () => {
    mockGetUserSetting.mockResolvedValue({
      key: 'internal.ui.table_columns',
      value: { 'rental.houses': { house: { show: false } } },
    });
    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          tableKey: 'rental.houses',
          columns,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.value.house?.show).toBe(false));
    act(() => result.current.reset());

    await waitFor(() =>
      expect(mockDeleteTableColumns).toHaveBeenCalledWith(
        { table_key: 'rental.houses' },
        { skipErrorHandler: true },
      ),
    );
    expect(result.current.value.house?.show).toBe(true);
  });

  it('非 404 加载失败时允许本地调整但禁止远端保存', async () => {
    mockGetUserSetting.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          tableKey: 'rental.houses',
          columns,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(mockMessageError).toHaveBeenCalledWith(
        '表头设置加载失败，当前调整不会保存',
      ),
    );

    act(() => {
      result.current.onChange({
        ...result.current.value,
        media: { ...result.current.value.media, show: false },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(result.current.value.media?.show).toBe(false);
    expect(mockPutTableColumns).not.toHaveBeenCalled();
    expect(mockDeleteTableColumns).not.toHaveBeenCalled();
  });

  it('同一列表写入串行执行并只发送最新待保存状态', async () => {
    let resolveFirstWrite: (() => void) | undefined;
    mockPutTableColumns
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstWrite = () => resolve({});
          }),
      )
      .mockResolvedValue({});
    const { result } = renderHook(
      () =>
        useUserTableColumnsState({
          tableKey: 'rental.houses',
          columns,
          debounceMs: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onChange({
        ...result.current.value,
        house: { ...result.current.value.house, show: false },
      });
    });
    await waitFor(() => expect(mockPutTableColumns).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.onChange({
        ...result.current.value,
        media: { ...result.current.value.media, show: false },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(mockPutTableColumns).toHaveBeenCalledTimes(1);

    resolveFirstWrite?.();
    await waitFor(() => expect(mockPutTableColumns).toHaveBeenCalledTimes(2));
    expect(mockPutTableColumns.mock.calls[1]?.[1]).toMatchObject({
      house: { show: false },
      media: { show: false },
    });
  });
});
