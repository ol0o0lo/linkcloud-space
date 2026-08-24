import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MineWorkbenchDataValue } from './data/MineWorkbenchData';
import { defaultWorkbenchLayout } from './layout/normalize';
import { MineWorkbenchContent } from './MineWorkbenchContent';
import { mineWidgetDefinitions } from './registry';

const accept = vi.fn();
const complete = vi.fn();

vi.mock('@/pages/space/shared', () => ({
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org' }),
}));

const data: MineWorkbenchDataValue = {
  dashboard: {
    pending_acceptance: 4,
    in_progress: 5,
    due_today: 8,
    overdue: 3,
    completed_today: 2,
    unacknowledged_announcements: 1,
    urgent_items: [
      {
        id: 11,
        task_id: 1,
        task_title: '确认房源发布资料',
        task_description: '',
        task_type: 'manual',
        priority: 'high',
        priority__mapping: '高',
        task_status: 'active',
        task_status__mapping: '进行中',
        team_name: '运营组',
        assignee: { id: 1, username: 'user', full_name: '测试用户' },
        status: 'pending',
        status__mapping: '待接受',
        due_at: '2026-08-17T14:00:00+08:00',
        is_overdue: false,
        result: '',
        created_at: '2026-08-17T09:00:00+08:00',
        updated_at: '2026-08-17T09:00:00+08:00',
      },
      {
        id: 12,
        task_id: 2,
        task_title: '完成租约审核',
        task_description: '',
        task_type: 'manual',
        priority: 'urgent',
        priority__mapping: '紧急',
        task_status: 'active',
        task_status__mapping: '进行中',
        team_name: null,
        assignee: { id: 1, username: 'user', full_name: '测试用户' },
        status: 'in_progress',
        status__mapping: '进行中',
        due_at: null,
        is_overdue: false,
        result: '',
        created_at: '2026-08-17T09:00:00+08:00',
        updated_at: '2026-08-17T09:00:00+08:00',
      },
    ],
  },
  dashboardLoading: false,
  dashboardError: false,
  retryDashboard: vi.fn(),
  announcements: [
    {
      id: 21,
      organization_id: 1,
      title: '房源发布规则调整通知',
      body: '正文',
      status: 'published',
      status__mapping: '已发布',
      require_acknowledgement: true,
      published_at: '2026-08-17T10:00:00+08:00',
      is_recipient: true,
      is_acknowledged: false,
      can_manage: false,
      recipient_count: 5,
      acknowledged_count: 2,
      created_at: '2026-08-17T09:00:00+08:00',
      updated_at: '2026-08-17T10:00:00+08:00',
    },
  ],
  announcementsLoading: false,
  announcementsError: false,
  retryAnnouncements: vi.fn(),
  acceptingId: undefined,
  completingId: undefined,
  accept,
  complete,
  isFetching: false,
  updatedAt: '14:30',
};

vi.mock('./data/MineWorkbenchData', () => ({
  MineWorkbenchDataProvider: ({ children }: PropsWithChildren) => children,
  useMineWorkbenchData: () => data,
}));

describe('MineWorkbenchContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the redesigned default widgets', () => {
    render(
      <MineWorkbenchContent
        layout={defaultWorkbenchLayout(mineWidgetDefinitions)}
      />,
    );

    expect(screen.getByText('待办概览')).toBeInTheDocument();
    expect(screen.getByText('优先处理')).toBeInTheDocument();
    expect(screen.getByText('任务进展')).toBeInTheDocument();
    expect(screen.getByText('公告摘要')).toBeInTheDocument();
    expect(screen.getByText('快捷操作')).toBeInTheDocument();
    expect(screen.getByText('房源发布规则调整通知')).toBeInTheDocument();
    expect(screen.getByTestId('mine-summary-rail')).toBeInTheDocument();
    expect(screen.getByTestId('mine-priority-queue')).toBeInTheDocument();
    expect(screen.getByTestId('mine-progress-ring')).toHaveTextContent(
      '今日完成率',
    );
    expect(screen.getByTestId('mine-announcement-note')).toHaveTextContent(
      '房源发布规则调整通知',
    );
    expect(screen.getByTestId('mine-quick-actions')).toBeInTheDocument();
  });

  it('keeps accept and complete task actions', () => {
    render(
      <MineWorkbenchContent
        layout={defaultWorkbenchLayout(mineWidgetDefinitions)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^接\s*受$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^完\s*成$/ }));
    expect(accept).toHaveBeenCalledWith(11);
    expect(complete).toHaveBeenCalledWith(12);
  });
});
