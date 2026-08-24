import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamTasksPage from './index';

const {
  mockGetTaskAssignment,
  mockGetTaskAssignmentSummary,
  mockGetTeamOperationsCapabilities,
  mockGetWorkTaskSummary,
  mockListTaskAssignments,
  mockListTaskAssignees,
  mockListWorkTasks,
  mockListTeams,
} = vi.hoisted(() => ({
  mockGetTaskAssignment: vi.fn(),
  mockGetTaskAssignmentSummary: vi.fn(),
  mockGetTeamOperationsCapabilities: vi.fn(),
  mockGetWorkTaskSummary: vi.fn(),
  mockListTaskAssignments: vi.fn(),
  mockListTaskAssignees: vi.fn(),
  mockListWorkTasks: vi.fn(),
  mockListTeams: vi.fn(),
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
  acceptTaskAssignment: vi.fn(),
  cancelWorkTask: vi.fn(),
  completeTaskAssignment: vi.fn(),
  createWorkTask: vi.fn(),
  getTaskAssignment: mockGetTaskAssignment,
  getTaskAssignmentSummary: mockGetTaskAssignmentSummary,
  getTeamOperationsCapabilities: mockGetTeamOperationsCapabilities,
  getWorkTaskSummary: mockGetWorkTaskSummary,
  getWorkTask: vi.fn(),
  listTaskAssignees: mockListTaskAssignees,
  listTaskAssignments: mockListTaskAssignments,
  listWorkTasks: mockListWorkTasks,
  rejectTaskAssignment: vi.fn(),
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('../shared', () => ({
  assignmentStatusColor: () => 'blue',
  invalidateTeamOperations: vi.fn(),
  priorityColor: () => 'blue',
  taskStatusColor: () => 'blue',
  teamOperationsQueryKeys: {
    assignmentSummary: (...args: unknown[]) => ['assignment-summary', ...args],
    assignments: (...args: unknown[]) => ['assignments', ...args],
    capabilities: () => ['capabilities'],
    taskSummary: (...args: unknown[]) => ['task-summary', ...args],
    tasks: (...args: unknown[]) => ['tasks', ...args],
  },
}));

vi.mock('./styles', () => ({
  useStyles: () => ({ styles: {} }),
}));

const assignment = {
  id: 2,
  task_id: 1,
  task_title: '测试任务',
  task_description: '测试说明',
  task_type: 'general',
  task_status: 'active',
  task_status__mapping: '进行中',
  priority: 'normal',
  priority__mapping: '普通',
  team_name: null,
  creator: { id: 3, username: 'creator', full_name: '创建人' },
  assignee: { id: 4, username: 'member', full_name: '执行人' },
  due_at: null,
  is_overdue: false,
  status: 'pending',
  status__mapping: '待处理',
  result: null,
  can_accept: true,
  can_complete: false,
  can_reject: true,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeamTasksPage />
    </QueryClientProvider>,
  );
}

describe('TeamTasksPage', () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      '',
      '/dashboard/rental/workbench/tasks?assignment_id=2',
    );
    mockGetTaskAssignment.mockResolvedValue(assignment);
    mockGetTaskAssignmentSummary.mockResolvedValue({
      pending: 3,
      in_progress: 2,
      due_soon: 1,
      overdue: 1,
    });
    mockGetWorkTaskSummary.mockResolvedValue({
      total: 8,
      active: 5,
      due_soon: 2,
      overdue: 1,
    });
    mockGetTeamOperationsCapabilities.mockResolvedValue({
      task_organization_manage: false,
      task_team_ids: [],
    });
    mockListTaskAssignments.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
    });
    mockListTaskAssignees.mockResolvedValue({ items: [] });
    mockListWorkTasks.mockResolvedValue({ items: [] });
    mockListTeams.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('分段选择器独立放置，搜索重置和新建任务位于筛选栏右侧', async () => {
    mockGetTeamOperationsCapabilities.mockResolvedValue({
      task_organization_manage: true,
      task_team_ids: [],
    });

    renderPage();

    const segmented = await screen.findByRole('radiogroup', {
      name: 'segmented control',
    });
    const toolbar = screen.getByRole('toolbar', { name: '团队任务工具栏' });
    const actions = await screen.findByRole('region', { name: '任务操作' });
    const createButton = within(actions).getByRole('button', {
      name: '新建任务',
    });

    expect(toolbar).toContainElement(segmented);
    expect(toolbar).not.toContainElement(createButton);
    expect(actions).toContainElement(createButton);
    expect(actions).toContainElement(
      within(actions).getByRole('searchbox', { name: '搜索任务' }),
    );
    expect(actions).toContainElement(
      within(actions).getByRole('button', { name: /重置/ }),
    );
    expect(toolbar.closest('.ant-card')).not.toBeInTheDocument();
  });

  it('我的任务显示对应统计卡，点击后联动状态筛选', async () => {
    renderPage();

    const pendingMetric = await screen.findByRole('button', {
      name: /待接受.*3/,
    });
    expect(within(pendingMetric).getByText('等待你确认')).toBeInTheDocument();
    expect(within(pendingMetric).getByText('项')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();

    fireEvent.click(pendingMetric);

    await waitFor(() => {
      expect(mockListTaskAssignments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'pending', page: 1 }),
      );
    });
  });

  it('切换到任务管理后展示全部任务统计并支持截止筛选', async () => {
    mockGetTeamOperationsCapabilities.mockResolvedValue({
      task_organization_manage: true,
      task_team_ids: [],
    });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: '任务管理' }));
    const dueSoonMetric = await screen.findByRole('button', {
      name: /24 小时内到期.*2/,
    });
    expect(screen.getByText('全部任务')).toBeInTheDocument();
    const taskTable = screen
      .getByRole('columnheader', { name: '任务标题' })
      .closest('table');
    expect(taskTable).not.toBeNull();
    expect(
      within(taskTable as HTMLElement).getByRole('columnheader', {
        name: '所属团队',
      }),
    ).toBeInTheDocument();
    expect(
      within(taskTable as HTMLElement).getByRole('columnheader', {
        name: '创建人',
      }),
    ).toBeInTheDocument();
    expect(
      within(taskTable as HTMLElement).queryByRole('columnheader', {
        name: '团队 / 创建人',
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(dueSoonMetric);

    await waitFor(() => {
      expect(mockListWorkTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'active',
          due_state: 'due_soon',
          page: 1,
        }),
      );
    });
  });

  it('没有任务管理权限时不显示新建任务按钮', async () => {
    renderPage();

    await screen.findByRole('toolbar', { name: '团队任务工具栏' });

    expect(
      screen.queryByRole('button', { name: '新建任务' }),
    ).not.toBeInTheDocument();
  });

  it('关闭 URL 指定的我的任务详情后不再重新打开', async () => {
    renderPage();

    const drawer = await screen.findByRole('dialog', {
      name: '我的任务详情',
    });
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '我的任务详情' }),
      ).not.toBeInTheDocument();
    });
    expect(window.location.search).not.toContain('assignment_id');
  });
});
