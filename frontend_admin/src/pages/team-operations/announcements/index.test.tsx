import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Modal } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamAnnouncementsPage from './index';

const {
  mockCreateTeamAnnouncement,
  mockGetTeamAnnouncement,
  mockGetTeamOperationsCapabilities,
  mockListTeamAnnouncements,
  mockListTeams,
  mockPublishTeamAnnouncement,
} = vi.hoisted(() => ({
  mockCreateTeamAnnouncement: vi.fn(),
  mockGetTeamAnnouncement: vi.fn(),
  mockGetTeamOperationsCapabilities: vi.fn(),
  mockListTeamAnnouncements: vi.fn(),
  mockListTeams: vi.fn(),
  mockPublishTeamAnnouncement: vi.fn(),
}));

vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>();

  return {
    ...antd,
    Drawer: ({ children, onClose, open, title }: any) =>
      open ? (
        <section aria-label={title} role="dialog">
          <button onClick={onClose} type="button">
            关闭
          </button>
          {children}
        </section>
      ) : null,
  };
});

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) =>
    children,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'test-org' }),
}));

vi.mock('@/services/manual/teamOperations', () => ({
  acknowledgeTeamAnnouncement: vi.fn(),
  createTeamAnnouncement: mockCreateTeamAnnouncement,
  getTeamAnnouncement: mockGetTeamAnnouncement,
  getTeamOperationsCapabilities: mockGetTeamOperationsCapabilities,
  listTeamAnnouncements: mockListTeamAnnouncements,
  publishTeamAnnouncement: mockPublishTeamAnnouncement,
  withdrawTeamAnnouncement: vi.fn(),
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('../shared', () => ({
  announcementStatusColor: () => 'blue',
  invalidateTeamOperations: vi.fn(),
  teamOperationsQueryKeys: {
    announcements: (...args: unknown[]) => ['announcements', ...args],
    capabilities: () => ['capabilities'],
  },
}));

vi.mock('./styles', () => ({
  useStyles: () => ({ styles: {} }),
}));

const announcement = {
  id: 5,
  organization_id: 1,
  team_id: null,
  team_name: null,
  title: '节假日值班安排',
  body: '请按排班表完成值班。',
  status: 'draft',
  status__mapping: '草稿',
  require_acknowledgement: false,
  published_by: null,
  published_at: null,
  expires_at: null,
  is_recipient: false,
  is_acknowledged: false,
  can_manage: true,
  recipient_count: 0,
  acknowledged_count: 0,
  created_at: '2026-09-09T08:00:00+08:00',
  updated_at: '2026-09-09T08:00:00+08:00',
} as const;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeamAnnouncementsPage />
    </QueryClientProvider>,
  );
}

describe('TeamAnnouncementsPage', () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      '',
      '/dashboard/rental/workbench/announcements',
    );
    mockCreateTeamAnnouncement.mockResolvedValue(announcement);
    mockGetTeamAnnouncement.mockResolvedValue(announcement);
    mockGetTeamOperationsCapabilities.mockResolvedValue({
      announcement_organization_manage: true,
      announcement_team_ids: [],
    });
    mockListTeamAnnouncements.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
    });
    mockListTeams.mockResolvedValue({ items: [] });
    mockPublishTeamAnnouncement.mockResolvedValue({
      ...announcement,
      status: 'published',
      status__mapping: '已发布',
    });
  });

  afterEach(() => {
    Modal.destroyAll();
    vi.clearAllMocks();
  });

  it('从 URL 恢复页码、筛选和公告详情', async () => {
    window.history.replaceState(
      null,
      '',
      '/dashboard/rental/workbench/announcements?page=3&status=published&keyword=%E5%88%B6%E5%BA%A6&announcement_id=5',
    );

    renderPage();

    await waitFor(() => {
      expect(mockListTeamAnnouncements).toHaveBeenCalledWith({
        page: 3,
        page_size: 10,
        status: 'published',
        keyword: '制度',
      });
      expect(mockGetTeamAnnouncement).toHaveBeenCalledWith(5);
    });
    expect(
      await screen.findByRole('dialog', { name: '公告详情' }),
    ).toBeInTheDocument();
  });

  it('从列表打开和关闭详情时同步公告 ID', async () => {
    mockListTeamAnnouncements.mockResolvedValue({
      items: [announcement],
      page: 1,
      page_size: 10,
      total: 1,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '详情' }));
    await waitFor(() => {
      expect(
        new URLSearchParams(window.location.search).get('announcement_id'),
      ).toBe('5');
    });

    const drawer = screen.getByRole('dialog', { name: '公告详情' });
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭' }));
    await waitFor(() => {
      expect(window.location.search).not.toContain('announcement_id');
    });
  });

  it('列表加载失败时显示错误状态并可重试', async () => {
    mockListTeamAnnouncements
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        items: [],
        page: 1,
        page_size: 10,
        total: 0,
      });
    renderPage();

    expect(await screen.findByText('公告列表加载失败')).toBeInTheDocument();
    expect(screen.getByText('公告数据未加载')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => {
      expect(mockListTeamAnnouncements).toHaveBeenCalledTimes(2);
    });
  });

  it('新建公告有输入时关闭会确认是否放弃', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '新建公告' }));
    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '新的公告' },
    });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(
      (await screen.findAllByText('放弃未保存的公告？')).length,
    ).toBeGreaterThan(0);
  });

  it('发布失败时给出明确操作反馈', async () => {
    mockListTeamAnnouncements.mockResolvedValue({
      items: [announcement],
      page: 1,
      page_size: 10,
      total: 1,
    });
    mockPublishTeamAnnouncement.mockRejectedValue(new Error('network'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '发布' }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));

    expect(
      await screen.findByText('公告发布失败，请稍后重试'),
    ).toBeInTheDocument();
  });
});
