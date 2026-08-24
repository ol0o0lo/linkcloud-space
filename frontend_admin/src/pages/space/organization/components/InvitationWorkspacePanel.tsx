import { ReloadOutlined, UserAddOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  message,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { adminTableScroll, drawerWidthSm } from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import {
  appsOrganizationsApiDeleteInvite,
  appsOrganizationsApiGetInvite,
  appsOrganizationsApiListInvites,
  appsOrganizationsApiResendInvite,
} from '@/services/openapi/organizationInvites';
import { organizationQueryKeys } from '../queryKeys';
import {
  OrganizationWorkspaceCard,
  type OrganizationWorkspaceCardContext,
} from './OrganizationWorkspaceCard';

export function inviteState(invite: API.InviteOut) {
  if (invite.is_expired) return 'expired';
  if (dayjs().diff(dayjs(invite.created_at), 'day') >= 3) return 'stale';
  return 'pending';
}

function inviteTarget(invite?: API.InviteOut | null) {
  if (!invite) return '-';
  return (
    invite.invitee_email ||
    invite.invitee_phone ||
    (invite.invitee ? `站内用户 #${invite.invitee}` : '未指定目标')
  );
}

function inviteSource(invite?: API.InviteOut | null) {
  if (invite?.invitee_email) return '邮箱邀请';
  if (invite?.invitee_phone) return '手机号邀请';
  if (invite?.invitee) return '站内用户邀请';
  return '未知';
}

export const InvitationWorkspacePanel: React.FC<{
  canManage: boolean;
  canViewRoles: boolean;
  onInvite: () => void;
  workspaceCard: OrganizationWorkspaceCardContext;
}> = ({ canManage, canViewRoles, onInvite, workspaceCard }) => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number>();
  const invitesQuery = useQuery({
    queryKey: organizationQueryKeys.invites(workspace.selectedOrgSlug, page),
    queryFn: () => appsOrganizationsApiListInvites({ page, page_size: 20 }),
    enabled: Boolean(workspace.selectedOrgSlug && canManage),
    refetchOnWindowFocus: true,
  });
  const rolesQuery = useQuery({
    queryKey: ['access', 'organization-roles', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug && canManage && canViewRoles),
  });
  const detailQuery = useQuery({
    queryKey: [
      'organization-workspace',
      workspace.selectedOrgSlug,
      'invite',
      detailId,
    ],
    queryFn: () => appsOrganizationsApiGetInvite({ invite_id: detailId ?? 0 }),
    enabled: Boolean(canManage && detailId),
  });

  const invalidate = async () => {
    await workspace.queryClient.invalidateQueries({
      queryKey: organizationQueryKeys.invites(workspace.selectedOrgSlug),
    });
    await workspace.queryClient.invalidateQueries({
      queryKey: organizationQueryKeys.navigation(workspace.selectedOrgSlug),
    });
  };
  const resendMutation = useMutation({
    mutationFn: (inviteId: number) =>
      appsOrganizationsApiResendInvite({ invite_id: inviteId }),
    onSuccess: async () => {
      message.success('邀请已重新发送，有效期已刷新');
      await invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (inviteId: number) =>
      appsOrganizationsApiDeleteInvite({ invite_id: inviteId }),
    onSuccess: async (_result, inviteId) => {
      message.success('邀请已取消');
      if (detailId === inviteId) setDetailId(undefined);
      await invalidate();
    },
  });

  const roleNameById = useMemo(
    () => new Map((rolesQuery.data || []).map((role) => [role.id, role.name])),
    [rolesQuery.data],
  );
  const columns: ProColumns<API.InviteOut>[] = [
    {
      title: '邀请对象',
      dataIndex: 'invitee_email',
      width: 260,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{inviteTarget(record)}</Typography.Text>
          <Typography.Text type="secondary">
            {inviteSource(record)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 150,
      render: (_value, record) => {
        const state = inviteState(record);
        return (
          <AppStatusTag name="organization-invite" state={state}>
            {state === 'expired'
              ? '已过期'
              : state === 'stale'
                ? '长时间未处理'
                : '待加入'}
          </AppStatusTag>
        );
      },
    },
    {
      title: '预设角色',
      dataIndex: 'access_role',
      width: 150,
      render: (_value, record) =>
        record.is_owner ? (
          <Tag color="gold">Owner</Tag>
        ) : record.access_role ? (
          roleNameById.get(record.access_role) || '组织角色'
        ) : (
          '普通成员'
        ),
    },
    {
      title: '发送时间',
      dataIndex: 'created_at',
      align: 'center',
      width: 170,
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      align: 'center',
      width: 210,
      render: (_value, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => setDetailId(record.pk)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            loading={
              resendMutation.isPending && resendMutation.variables === record.pk
            }
            onClick={() => resendMutation.mutateAsync(record.pk)}
          >
            重发
          </Button>
          <Popconfirm
            title="取消该邀请？"
            description="取消后原邀请链接将不可继续使用。"
            okText="确认取消"
            onConfirm={() => deleteMutation.mutateAsync(record.pk)}
          >
            <Button type="link" danger size="small">
              取消
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!canManage) {
    return (
      <OrganizationWorkspaceCard {...workspaceCard}>
        <Alert
          type="info"
          showIcon
          title="无法管理邀请"
          description="当前角色没有邀请成员权限。"
        />
      </OrganizationWorkspaceCard>
    );
  }

  return (
    <>
      <OrganizationWorkspaceCard
        {...workspaceCard}
        actions={
          <Button type="primary" icon={<UserAddOutlined />} onClick={onInvite}>
            邀请成员
          </Button>
        }
      >
        {invitesQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title="邀请列表加载失败"
            description={(invitesQuery.error as Error).message}
            action={
              <Button onClick={() => invitesQuery.refetch()}>重试</Button>
            }
          />
        ) : (
          <ProTable<API.InviteOut>
            rowKey="pk"
            cardProps={false}
            columns={columns}
            dataSource={invitesQuery.data?.items || []}
            loading={invitesQuery.isLoading}
            search={false}
            options={false}
            toolBarRender={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="当前没有邀请记录"
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize: 20,
              total: invitesQuery.data?.total || 0,
              showSizeChanger: false,
              onChange: setPage,
            }}
            scroll={adminTableScroll}
          />
        )}
      </OrganizationWorkspaceCard>

      <Drawer
        title="邀请详情"
        open={Boolean(detailId)}
        onClose={() => setDetailId(undefined)}
        size={drawerWidthSm}
      >
        <Descriptions bordered column={1}>
          <Descriptions.Item label="邀请对象">
            {inviteTarget(detailQuery.data)}
          </Descriptions.Item>
          <Descriptions.Item label="邀请方式">
            {inviteSource(detailQuery.data)}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {detailQuery.data
              ? (() => {
                  const state = inviteState(detailQuery.data);
                  return (
                    <AppStatusTag name="organization-invite" state={state}>
                      {state === 'expired'
                        ? '已过期'
                        : state === 'stale'
                          ? '长时间未处理'
                          : '待加入'}
                    </AppStatusTag>
                  );
                })()
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预设角色">
            {detailQuery.data?.access_role
              ? roleNameById.get(detailQuery.data.access_role) || '组织角色'
              : '普通成员'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {detailQuery.data?.created_at
              ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {detailQuery.data?.updated_at
              ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Drawer>
    </>
  );
};
