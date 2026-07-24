import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  completeTaskAssignment,
  createTeamAnnouncement,
  createWorkTask,
  getTaskAssignment,
  getTeamAnnouncement,
  getTeamOperationsCapabilities,
  getWorkTask,
  listTaskAssignees,
  listTaskAssignments,
  publishTeamAnnouncement,
} from './teamOperations';

describe('team operations client', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({});
  });

  it('创建并发布团队公告', async () => {
    await createTeamAnnouncement({
      team_id: 8,
      title: '今日安排',
      body: '请确认任务',
      require_acknowledgement: true,
    });
    await publishTeamAnnouncement(12);

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/team-operations/announcements/',
      {
        method: 'POST',
        data: {
          team_id: 8,
          title: '今日安排',
          body: '请确认任务',
          require_acknowledgement: true,
        },
      },
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/team-operations/announcements/12/publish/',
      { method: 'POST' },
    );
  });

  it('创建任务并提交完成结果', async () => {
    await createWorkTask({
      title: '核对房源资料',
      priority: 'high',
      assignee_ids: [3, 5],
    });
    await completeTaskAssignment(21, '资料已经补齐');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/team-operations/tasks/',
      {
        method: 'POST',
        data: {
          title: '核对房源资料',
          priority: 'high',
          assignee_ids: [3, 5],
        },
      },
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/team-operations/task-assignments/21/complete/',
      { method: 'POST', data: { result: '资料已经补齐' } },
    );
  });

  it('按状态和逾期条件查询我的任务', async () => {
    await listTaskAssignments({
      page: 2,
      page_size: 10,
      status: 'in_progress',
      overdue: true,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/team-operations/task-assignments/',
      {
        method: 'GET',
        params: {
          page: 2,
          page_size: 10,
          status: 'in_progress',
          overdue: true,
        },
      },
    );
  });

  it('按通知目标读取公告、任务和任务分配详情', async () => {
    await getTeamAnnouncement(12);
    await getWorkTask(18);
    await getTaskAssignment(21);

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/team-operations/announcements/12/',
      { method: 'GET' },
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/team-operations/tasks/18/',
      { method: 'GET' },
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      3,
      '/api/team-operations/task-assignments/21/',
      { method: 'GET' },
    );
  });

  it('读取权限范围和团队任务候选人', async () => {
    await getTeamOperationsCapabilities();
    await listTaskAssignees({ team_id: 8, page: 1, page_size: 100 });

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/team-operations/capabilities/',
      { method: 'GET' },
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/team-operations/task-assignees/',
      {
        method: 'GET',
        params: { team_id: 8, page: 1, page_size: 100 },
      },
    );
  });
});
