import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VacancySyncPage from './index';

const { mockVacancySync, workspaceState } = vi.hoisted(() => ({
  mockVacancySync: vi.fn(),
  workspaceState: { queryClient: undefined as QueryClient | undefined },
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    vacancySync: mockVacancySync,
  },
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({
    children,
    extra,
  }: {
    children: React.ReactNode;
    extra?: React.ReactNode;
  }) => (
    <>
      {extra}
      {children}
    </>
  ),
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'demo-org',
    queryClient: workspaceState.queryClient,
  }),
}));

const validLine: API.VacancySyncLineOut = {
  line_number: 2,
  raw: '101单间1200',
  status: 'valid',
  error_code: null,
  message: null,
  room_number: '101',
  floor: 1,
  asking_rent: '1200.00',
  bedrooms: 1,
  living_rooms: 0,
  tags: [],
};

function makePreview(
  overrides: Partial<API.VacancySyncOut> = {},
): API.VacancySyncOut {
  return {
    mode: 'preview',
    applied: false,
    can_apply: true,
    plan_hash: 'preview-hash',
    force_rented: false,
    summary: {
      buildings: 1,
      valid_lines: 1,
      error_lines: 0,
      ignored_lines: 0,
      create_buildings: 1,
      create_houses: 1,
      update_houses: 0,
      mark_vacant: 0,
      mark_rented: 0,
      preserve_special_status: 0,
    },
    blocks: [
      {
        block_index: 0,
        address: '测试路1号',
        building_match: {
          status: 'new',
          building_id: null,
          name: null,
          address: '测试路1号',
          candidates: [],
        },
        lines: [validLine],
        changes: {
          create_houses: [
            {
              house_id: null,
              room_number: '101',
              before_status: null,
              after_status: 'vacant',
              changed_fields: [],
            },
          ],
          update_houses: [],
          mark_vacant: [],
          mark_rented: [],
          preserve_special_status: [],
          inactive_conflicts: [],
        },
        errors: [],
      },
    ],
    errors: [],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  workspaceState.queryClient = queryClient;
  return render(
    <QueryClientProvider client={queryClient}>
      <VacancySyncPage />
    </QueryClientProvider>,
  );
}

describe('VacancySyncPage', () => {
  beforeEach(() => {
    mockVacancySync.mockReset();
  });

  it('先预览再携带 plan_hash 确认同步', async () => {
    const preview = makePreview();
    const applied = makePreview({
      mode: 'apply',
      applied: true,
      blocks: [
        {
          ...preview.blocks[0],
          building_match: {
            ...preview.blocks[0].building_match,
            status: 'created',
            building_id: 10,
            name: '测试路1号',
          },
        },
      ],
    });
    mockVacancySync
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(applied);
    renderPage();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1200' },
    });
    fireEvent.click(screen.getByRole('button', { name: /预览同步计划/ }));

    await waitFor(() =>
      expect(mockVacancySync).toHaveBeenNthCalledWith(1, {
        mode: 'preview',
        raw_text: '测试路1号\n101单间1200',
        ignored_lines: [],
        building_overrides: [],
        plan_hash: null,
      }),
    );
    expect(screen.getByText('识别明细')).toBeInTheDocument();
    expect(screen.getAllByText('将新建楼栋').length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('vacancy-sync-result-panel')).getByText(
        '涉及楼栋',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /执行同步/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: '确认执行同步' }),
    );

    await waitFor(() =>
      expect(mockVacancySync).toHaveBeenNthCalledWith(2, {
        mode: 'apply',
        raw_text: '测试路1号\n101单间1200',
        ignored_lines: [],
        building_overrides: [],
        plan_hash: 'preview-hash',
      }),
    );
    expect(await screen.findByText('同步已完成')).toBeInTheDocument();
  });

  it('修改已生成预览的房表会保留结果并标记预览失效', async () => {
    mockVacancySync.mockResolvedValueOnce(makePreview());
    renderPage();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1200' },
    });
    fireEvent.click(screen.getByRole('button', { name: /预览同步计划/ }));

    expect(await screen.findByText('识别明细')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1300' },
    });

    expect(screen.getByText('预览失效')).toBeInTheDocument();
    expect(screen.getAllByText('测试路1号').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /执行同步/ })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /预览同步计划/ }),
    ).toBeInTheDocument();
  });

  it('有输入时不再显示会覆盖内容的载入示例入口', () => {
    renderPage();

    expect(screen.getAllByRole('button', { name: /载入示例/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /执行同步/ })).toBeDisabled();
    expect(
      screen.getByPlaceholderText(/下元岗东街三巷1号/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1200' },
    });

    expect(
      screen.queryByRole('button', { name: /载入示例/ }),
    ).not.toBeInTheDocument();
  });

  it('房表内容停止变化后防抖自动更新预览', async () => {
    mockVacancySync
      .mockResolvedValueOnce(makePreview())
      .mockResolvedValueOnce(makePreview());
    renderPage();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1200' },
    });
    fireEvent.click(screen.getByRole('button', { name: /预览同步计划/ }));
    expect(await screen.findByText('识别明细')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1300' },
    });

    expect(mockVacancySync).toHaveBeenCalledTimes(1);
    await waitFor(
      () =>
        expect(mockVacancySync).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            mode: 'preview',
            raw_text: '测试路1号\n101单间1300',
          }),
        ),
      { timeout: 2500 },
    );
  });

  it('同步完成后可以开始下一份房表', async () => {
    const preview = makePreview();
    const applied = makePreview({
      mode: 'apply',
      applied: true,
      blocks: [
        {
          ...preview.blocks[0],
          building_match: {
            ...preview.blocks[0].building_match,
            status: 'created',
            building_id: 10,
            name: '测试路1号',
          },
        },
      ],
    });
    mockVacancySync
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(applied);
    renderPage();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n101单间1200' },
    });
    fireEvent.click(screen.getByRole('button', { name: /预览同步计划/ }));
    fireEvent.click(await screen.findByRole('button', { name: /执行同步/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: '确认执行同步' }),
    );

    expect(await screen.findByText('同步已完成')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '同步下一份' }));

    expect(screen.getByLabelText('房表内容')).toHaveValue('');
    expect(screen.queryByText('同步已完成')).not.toBeInTheDocument();
  });

  it('可以忽略错误行并自动重新预览', async () => {
    const errorLine: API.VacancySyncLineOut = {
      ...validLine,
      raw: '一房1750无遮挡',
      status: 'error',
      error_code: 'ROOM_NUMBER_MISSING',
      message: '缺少房号。',
      room_number: null,
      floor: null,
      asking_rent: null,
      bedrooms: null,
      living_rooms: null,
    };
    const error = {
      code: 'ROOM_NUMBER_MISSING',
      message: '缺少房号。',
      block_index: 0,
      line_number: 2,
    };
    const invalid = makePreview({
      can_apply: false,
      plan_hash: null,
      summary: {
        ...makePreview().summary,
        valid_lines: 0,
        error_lines: 1,
        create_houses: 0,
      },
      blocks: [
        {
          ...makePreview().blocks[0],
          lines: [errorLine],
          changes: {
            create_houses: [],
            update_houses: [],
            mark_vacant: [],
            mark_rented: [],
            preserve_special_status: [],
            inactive_conflicts: [],
          },
          errors: [error],
        },
      ],
      errors: [error],
    });
    const ignored = makePreview({
      summary: {
        ...makePreview().summary,
        valid_lines: 0,
        ignored_lines: 1,
        create_houses: 0,
      },
      blocks: [
        {
          ...makePreview().blocks[0],
          lines: [{ ...errorLine, status: 'ignored' }],
          changes: {
            create_houses: [],
            update_houses: [],
            mark_vacant: [],
            mark_rented: [],
            preserve_special_status: [],
            inactive_conflicts: [],
          },
        },
      ],
    });
    mockVacancySync
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(ignored);
    renderPage();

    fireEvent.change(screen.getByLabelText('房表内容'), {
      target: { value: '测试路1号\n一房1750无遮挡' },
    });
    fireEvent.click(screen.getByRole('button', { name: /预览同步计划/ }));
    expect((await screen.findAllByText('缺少房号。')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole('button', { name: /执行同步/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '忽略此行' }));

    await waitFor(() =>
      expect(mockVacancySync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ ignored_lines: [2] }),
      ),
    );
    expect(await screen.findByText('已忽略 1 行')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /执行同步/ }),
    ).toBeInTheDocument();
  });
});
