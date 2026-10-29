import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MigrationBatch } from '@/services/manual/dataMigration';
import DataMigrationPage from './index';

const { api, currentWorkspace } = vi.hoisted(() => ({
  api: {
    options: vi.fn(),
    batches: vi.fn(),
    batch: vi.fn(),
    upload: vi.fn(),
    preview: vi.fn(),
    confirm: vi.fn(),
    retry: vi.fn(),
    records: vi.fn(),
    assets: vi.fn(),
    archives: vi.fn(),
    archive: vi.fn(),
    report: vi.fn(),
  },
  currentWorkspace: { selectedOrgSlug: 'target' },
}));
vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
  useTenantWorkspace: () => currentWorkspace,
}));
vi.mock('@/services/manual/dataMigration', () => ({ dataMigrationApi: api }));
vi.mock('@umijs/max', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const batch: MigrationBatch = {
  id: 'batch-1',
  source_team_name: '旧团队',
  source_team_id: '10',
  status: 'awaiting_confirmation',
  media_status: 'pending',
  created_at: '2026-10-25T00:00:00Z',
  updated_at: '2026-10-25T00:00:00Z',
  error_message: '',
  summary: { total: 2, pending: 2 },
  media_summary: {
    total: 0,
    succeeded: 0,
    failed: 0,
    missing: 0,
    processing: 0,
    pending: 0,
  },
  preview: {
    version: 'preview-v1',
    summary: { total: 2, created: 1, archived: 1 },
    issues: [],
    decisions: { overrides: [], mappings: [], member_mappings: {} },
  },
};

const clients: QueryClient[] = [];
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <DataMigrationPage />
    </QueryClientProvider>,
  );
}

describe('管理端数据迁移', () => {
  afterEach(() => {
    cleanup();
    clients.forEach((client) => {
      client.clear();
    });
    clients.length = 0;
  });
  beforeEach(() => {
    vi.clearAllMocks();
    currentWorkspace.selectedOrgSlug = 'target';
    api.options.mockResolvedValue({
      organization: { id: 1, name: '目标组织', slug: 'target' },
      members: [],
      can_manage: true,
    });
    api.batches.mockResolvedValue({
      items: [batch],
      total: 1,
      page: 1,
      page_size: 20,
    });
    api.batch.mockResolvedValue(batch);
    api.records.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });
    api.confirm.mockResolvedValue({ ...batch, status: 'importing' });
  });

  it('无组织所有者权限时不请求批次或提供上传入口', async () => {
    api.options.mockResolvedValue({ can_manage: false });
    renderPage();
    expect(await screen.findByText('仅组织所有者可以迁移数据')).toBeTruthy();
    expect(api.batches).not.toHaveBeenCalled();
    expect(screen.queryByText('上传并开始预检')).toBeNull();
  });

  it('明确目标组织并分别展示业务与媒体进度，确认携带预检版本', async () => {
    renderPage();
    await screen.findByText('目标组织：目标组织');
    fireEvent.click(
      await screen.findByText('查看与处理', {}, { timeout: 5000 }),
    );
    expect(await screen.findByText('业务数据：待确认导入')).toBeTruthy();
    expect(screen.getByText('尚未建立资源清单，暂无媒体进度')).toBeTruthy();
    fireEvent.click(screen.getByText('核对完成，确认导入'));
    fireEvent.click(await screen.findByText('确认导入到此组织'));
    await waitFor(() =>
      expect(api.confirm).toHaveBeenCalledWith(
        'target',
        'batch-1',
        'preview-v1',
        expect.any(AbortSignal),
      ),
    );
  });

  it('补全未保存时禁用导入，保存实际数值字段', async () => {
    api.batch.mockResolvedValue({
      ...batch,
      preview: {
        ...batch.preview,
        issues: [
          {
            entity_type: 'buildings',
            source_id: '10',
            field: 'floors',
            code: 'required',
            message: '总层数待补全',
          },
        ],
      },
    });
    api.preview.mockResolvedValue(batch);
    renderPage();
    fireEvent.click(
      await screen.findByText('查看与处理', {}, { timeout: 5000 }),
    );
    fireEvent.change(await screen.findByLabelText('楼栋 10 楼栋总层数'), {
      target: { value: '6' },
    });
    expect(
      screen.getByText('核对完成，确认导入').closest('button')?.disabled,
    ).toBe(true);
    fireEvent.click(screen.getByText('保存补全并重新预检'));
    await waitFor(() =>
      expect(api.preview).toHaveBeenCalledWith(
        'target',
        'batch-1',
        {
          overrides: [
            {
              entity_type: 'buildings',
              source_id: '10',
              fields: { floors: 6 },
            },
          ],
          mappings: [],
          member_mappings: {},
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it('默认保留组织资料，只有勾选后才提交旧团队名称应用决定', async () => {
    api.preview.mockResolvedValue(batch);
    renderPage();
    fireEvent.click(
      await screen.findByText('查看与处理', {}, { timeout: 5000 }),
    );
    const applyName = await screen.findByLabelText(
      '将旧团队名称应用到当前组织',
    );
    expect(applyName).not.toBeChecked();
    expect(
      screen.getByLabelText('将旧团队标志应用到当前组织'),
    ).not.toBeChecked();
    fireEvent.click(applyName);
    fireEvent.click(screen.getByText('保存补全并重新预检'));
    await waitFor(() =>
      expect(api.preview).toHaveBeenCalledWith(
        'target',
        'batch-1',
        {
          overrides: [
            {
              entity_type: 'team',
              source_id: '10',
              fields: { apply_name: true },
            },
          ],
          mappings: [],
          member_mappings: {},
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it('已完成任务可以调整历史员工绑定并用新预检版本确认', async () => {
    let current = { ...batch, status: 'completed', media_status: 'completed' };
    api.options.mockResolvedValue({
      organization: { id: 1, name: '目标组织', slug: 'target' },
      members: [{ id: 12, name: '新成员甲' }],
      can_manage: true,
    });
    api.batch.mockImplementation(async () => current);
    api.records.mockResolvedValue({
      items: [
        {
          id: 7,
          entity_type: 'staff',
          source_id: 'old-7',
          data: { realName: '旧员工甲' },
          source_deleted: false,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    api.preview.mockImplementation(async (_slug, _id, decisions) => {
      current = {
        ...current,
        status: 'awaiting_confirmation',
        preview: {
          version: 'binding-v2',
          summary: batch.preview?.summary || {},
          issues: [],
          decisions,
        },
      };
      return current;
    });
    renderPage();
    fireEvent.click(
      await screen.findByText('查看与处理', {}, { timeout: 5000 }),
    );
    fireEvent.click(await screen.findByText('调整员工绑定'));
    await screen.findByText('旧员工甲');
    expect(screen.queryByLabelText('将旧团队名称应用到当前组织')).toBeNull();
    fireEvent.mouseDown(screen.getByLabelText('旧员工 old-7 绑定成员'));
    fireEvent.click(await screen.findByText('新成员甲'));
    fireEvent.click(screen.getByText('保存绑定并重新预检'));
    await waitFor(() =>
      expect(api.preview).toHaveBeenCalledWith(
        'target',
        'batch-1',
        expect.objectContaining({ member_mappings: { 'old-7': 12 } }),
        expect.any(AbortSignal),
      ),
    );
    fireEvent.click(await screen.findByText('核对完成，确认员工绑定'));
    fireEvent.click(await screen.findByText('确认应用员工绑定'));
    await waitFor(() =>
      expect(api.confirm).toHaveBeenCalledWith(
        'target',
        'batch-1',
        'binding-v2',
        expect.any(AbortSignal),
      ),
    );
  });
});
