import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Empty,
  message,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import {
  adminTableScroll,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import {
  acceptTaskAssignment,
  completeTaskAssignment,
  getDailyTeamOperationsDashboard,
  type TaskAssignment,
} from '@/services/manual/teamOperations';
import {
  assignmentStatusColor,
  invalidateTeamOperations,
  priorityColor,
  teamOperationsQueryKeys,
} from '../shared';

const dashboardHref = (path: string) => `/dashboard${path}`;

const TeamOperationsWorkbenchPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const enabled = Boolean(workspace.selectedOrgSlug);

  const dashboardQuery = useQuery({
    queryKey: teamOperationsQueryKeys.dashboard(workspace.selectedOrgSlug),
    queryFn: () => getDailyTeamOperationsDashboard(),
    enabled,
  });

  const acceptMutation = useMutation({
    mutationFn: (assignmentId: number) => acceptTaskAssignment(assignmentId),
    onSuccess: async () => {
      message.success('任务已接受');
      await invalidateTeamOperations(queryClient);
    },
  });
  const completeMutation = useMutation({
    mutationFn: (assignmentId: number) => completeTaskAssignment(assignmentId),
    onSuccess: async () => {
      message.success('任务已完成');
      await invalidateTeamOperations(queryClient);
    },
  });

  const dashboard = dashboardQuery.data;
  const statistics = [
    {
      key: 'pending',
      title: '待接受任务',
      value: dashboard?.pending_acceptance || 0,
    },
    {
      key: 'in-progress',
      title: '进行中任务',
      value: dashboard?.in_progress || 0,
    },
    {
      key: 'due-today',
      title: '今日到期',
      value: dashboard?.due_today || 0,
    },
    {
      key: 'overdue',
      title: '已逾期',
      value: dashboard?.overdue || 0,
    },
    {
      key: 'completed',
      title: '今日完成',
      value: dashboard?.completed_today || 0,
    },
    {
      key: 'announcement',
      title: '待确认公告',
      value: dashboard?.unacknowledged_announcements || 0,
    },
  ];

  const columns: ColumnsType<TaskAssignment> = [
    {
      title: '重点任务',
      dataIndex: 'task_title',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.task_title}</Typography.Text>
          <Typography.Text type="secondary">
            {record.team_name || '组织级任务'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 110,
      render: (_value, record) => (
        <Tag color={priorityColor(record.priority)}>
          {record.priority__mapping}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_value, record) => (
        <Space size={4}>
          <Tag color={assignmentStatusColor(record.status)}>
            {record.status__mapping}
          </Tag>
          {record.is_overdue ? <Tag color="red">已逾期</Tag> : null}
        </Space>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'due_at',
      width: 180,
      render: (value) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未设置',
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 180,
      render: (_value, record) => (
        <ResponsiveActions>
          {record.status === 'pending' ? (
            <Button
              type="link"
              size="small"
              loading={acceptMutation.isPending}
              onClick={() => void acceptMutation.mutateAsync(record.id)}
            >
              接受
            </Button>
          ) : null}
          {record.status === 'in_progress' ? (
            <Button
              type="link"
              size="small"
              loading={completeMutation.isPending}
              onClick={() => void completeMutation.mutateAsync(record.id)}
            >
              完成
            </Button>
          ) : null}
          <a
            href={dashboardHref(
              `/tenant-operations/tasks?assignment_id=${record.id}`,
            )}
            onClick={(event) => {
              event.preventDefault();
              history.push(
                `/tenant-operations/tasks?assignment_id=${record.id}`,
              );
            }}
          >
            查看
          </a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <TenantSelectionGuard title="团队工作台">
      <Row gutter={[16, 16]}>
        {statistics.map((item) => (
          <Col key={item.key} xs={24} sm={12} xl={8} xxl={4}>
            <Card size="small">
              <Statistic title={item.title} value={item.value} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="我的重点任务"
        style={{ marginTop: 16 }}
        extra={
          <Button
            href={dashboardHref('/tenant-operations/tasks')}
            onClick={(event) => {
              event.preventDefault();
              history.push('/tenant-operations/tasks');
            }}
          >
            查看全部任务
          </Button>
        }
      >
        {!dashboardQuery.isLoading && !dashboard?.urgent_items?.length ? (
          <Empty description="当前没有紧急或即将到期的任务" />
        ) : (
          <Table<TaskAssignment>
            rowKey="id"
            loading={dashboardQuery.isLoading}
            columns={columns}
            dataSource={dashboard?.urgent_items || []}
            pagination={false}
            scroll={adminTableScroll}
          />
        )}
      </Card>
    </TenantSelectionGuard>
  );
};

export default TeamOperationsWorkbenchPage;
