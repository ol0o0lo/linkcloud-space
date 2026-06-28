import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import {
  adminTableScroll,
  drawerWidthSm,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import {
  appsOrganizationsApiCreateInvite,
  appsOrganizationsApiDeleteInvite,
  appsOrganizationsApiGetInvite,
  appsOrganizationsApiListInvites,
  appsOrganizationsApiResendInvite,
} from '@/services/openapi/organizationInvites';
import { appsOrganizationsApiSearchMembers } from '@/services/openapi/organizationMembers';
import { normalizeEmailLikeInput } from '@/utils/email';
import { TenantSelectionGuard, useTenantWorkspace } from '../shared';

type InviteMode = 'email' | 'internal';

const pageSize = 10;
const staleInviteDays = 3;

function inviteTargetLabel(invite?: API.InviteOut | null) {
  if (!invite) {
    return '-';
  }
  if (invite.invitee_email) {
    return invite.invitee_email;
  }
  if (invite.invitee) {
    return `站内用户 #${invite.invitee}`;
  }
  return '未指定目标';
}

function inviteSourceLabel(invite?: API.InviteOut | null) {
  if (!invite) {
    return '未知';
  }
  if (invite.invitee_email) {
    return '邮箱邀请';
  }
  if (invite.invitee) {
    return '站内用户邀请';
  }
  return '未知';
}

function inviteWaitingDays(invite?: API.InviteOut | null) {
  if (!invite?.created_at) {
    return 0;
  }
  return Math.max(dayjs().diff(dayjs(invite.created_at), 'day'), 0);
}

function inviteStage(invite?: API.InviteOut | null) {
  const waitDays = inviteWaitingDays(invite);
  if (!invite) {
    return {
      color: 'default' as const,
      label: '未选择邀请',
    };
  }

  if (invite.is_owner && waitDays >= staleInviteDays) {
    return {
      color: 'purple' as const,
      label: '管理员邀请待确认',
    };
  }

  if (invite.is_owner) {
    return {
      color: 'purple' as const,
      label: '管理员预设',
    };
  }

  if (waitDays >= staleInviteDays) {
    return {
      color: 'gold' as const,
      label: '长时间未处理',
    };
  }

  return {
    color: 'blue' as const,
    label: '待入场',
  };
}

export function buildInvitePayload(
  inviteMode: InviteMode,
  values: API.InviteIn,
) {
  const payload = values.access_role ? { access_role: values.access_role } : {};
  return inviteMode === 'email'
    ? { ...payload, invitee_email: values.invitee_email }
    : { ...payload, invitee: values.invitee };
}

const TenantInvitesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInviteId, setDetailInviteId] = useState<number>();
  const [inviteMode, setInviteMode] = useState<InviteMode>('email');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [candidateSearchActive, setCandidateSearchActive] = useState(false);
  const [form] = Form.useForm<API.InviteIn>();

  const invitesQuery = useQuery({
    queryKey: ['tenant', 'invites', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsOrganizationsApiListInvites({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const candidateQuery = useQuery({
    queryKey: [
      'tenant',
      'invite-candidates',
      workspace.selectedOrgSlug,
      searchKeyword,
    ],
    queryFn: () => appsOrganizationsApiSearchMembers({ keyword: searchKeyword }),
    enabled: createOpen && inviteMode === 'internal' && candidateSearchActive,
  });
  const accessRolesQuery = useQuery({
    queryKey: ['tenant', 'invite-access-roles', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const invites = invitesQuery.data?.items || [];

  const detailQuery = useQuery({
    queryKey: [
      'tenant',
      'invite-detail',
      workspace.selectedOrgSlug,
      detailInviteId,
    ],
    queryFn: () =>
      appsOrganizationsApiGetInvite({ invite_id: detailInviteId ?? 0 }),
    enabled: Boolean(workspace.selectedOrgSlug && detailInviteId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.InviteIn) =>
      appsOrganizationsApiCreateInvite(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      setInviteMode('email');
      setSearchKeyword('');
      setCandidateSearchActive(false);
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'invites'],
      });
    },
  });
  const resendMutation = useMutation({
    mutationFn: (inviteId: number) =>
      appsOrganizationsApiResendInvite({ invite_id: inviteId }),
  });
  const deleteMutation = useMutation({
    mutationFn: (inviteId: number) =>
      appsOrganizationsApiDeleteInvite({ invite_id: inviteId }),
    onSuccess: async (_result, inviteId) => {
      if (detailInviteId === inviteId) {
        setDetailInviteId(undefined);
      }
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'invites'],
      });
    },
  });

  const pagedInvites = invites.slice((page - 1) * pageSize, page * pageSize);

  const candidateOptions = useMemo(
    () =>
      (candidateQuery.data || []).map((item) => ({
        label: `${[item.first_name, item.last_name].filter(Boolean).join(' ') || item.username} (${item.email || item.username})`,
        value: item.pk,
      })),
    [candidateQuery.data],
  );
  const accessRoleOptions = useMemo(
    () =>
      (accessRolesQuery.data || []).map((role) => ({
        label: role.name,
        value: role.id,
      })),
    [accessRolesQuery.data],
  );
  const accessRoleNameById = useMemo(
    () =>
      new Map(
        (accessRolesQuery.data || []).map((role) => [role.id, role.name]),
      ),
    [accessRolesQuery.data],
  );

  const invitePermissionLabel = useCallback(
    (invite?: API.InviteOut | null) => {
      if (!invite) {
        return '-';
      }
      if (invite.is_owner) {
        return '管理员';
      }
      if (invite.access_role) {
        return accessRoleNameById.get(invite.access_role) || '预设角色';
      }
      return '普通成员';
    },
    [accessRoleNameById],
  );

  const columns: ColumnsType<API.InviteOut> = useMemo(
    () => [
      {
        title: '邀请目标',
        dataIndex: 'invitee_email',
        width: 260,
        render: (_value, record) => (
          <Typography.Text strong>{inviteTargetLabel(record)}</Typography.Text>
        ),
      },
      {
        title: '权限',
        dataIndex: 'access_role',
        width: 120,
        render: (_value, record) => (
          <Tag
            color={
              record.is_owner
                ? 'purple'
                : record.access_role
                  ? 'blue'
                  : 'default'
            }
          >
            {invitePermissionLabel(record)}
          </Tag>
        ),
      },
      {
        title: '发送时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 180,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setDetailInviteId(record.pk)}>详情</a>
            <a onClick={() => void resendMutation.mutateAsync(record.pk)}>
              重发
            </a>
            <Popconfirm
              title="确认取消该邀请？"
              onConfirm={() => void deleteMutation.mutateAsync(record.pk)}
            >
              <a>取消</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, invitePermissionLabel, resendMutation],
  );

  const detailStage = inviteStage(detailQuery.data);

  return (
    <TenantSelectionGuard title="邀请管理">
      <Card
        title="邀请列表"
        extra={
          <Button
            type="primary"
            onClick={() => {
              setCreateOpen(true);
              setInviteMode('email');
            }}
          >
            新建邀请
          </Button>
        }
      >
        <Table
          rowKey="pk"
          loading={invitesQuery.isLoading}
          columns={columns}
          dataSource={pagedInvites}
          locale={{
            emptyText: (
              <Empty
                description="暂无邀请"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          scroll={adminTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: invites.length,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title="新建邀请"
        open={createOpen}
        confirmLoading={createMutation.isPending}
        onCancel={() => {
          setCreateOpen(false);
          setInviteMode('email');
          setSearchKeyword('');
          setCandidateSearchActive(false);
        }}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(
            buildInvitePayload(inviteMode, values),
          );
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="邀请方式">
            <Radio.Group
              value={inviteMode}
              onChange={(event) => {
                const nextMode = event.target.value as InviteMode;
                setInviteMode(nextMode);
                setSearchKeyword('');
                setCandidateSearchActive(false);
                form.setFieldsValue({
                  invitee_email: undefined,
                  invitee: undefined,
                });
              }}
            >
              <Radio.Button value="email">邮箱邀请</Radio.Button>
              <Radio.Button value="internal">站内用户邀请</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {inviteMode === 'email' ? (
            <Form.Item
              label="邀请邮箱"
              name="invitee_email"
              normalize={normalizeEmailLikeInput}
              rules={[
                { required: true, message: '请输入邀请邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input placeholder="member@example.com" />
            </Form.Item>
          ) : (
            <Form.Item
              label="邀请人员"
              name="invitee"
              rules={[{ required: true, message: '请选择要邀请的站内用户' }]}
            >
              <Select
                allowClear
                showSearch
                filterOption={false}
                loading={candidateQuery.isFetching}
                options={candidateOptions}
                onClear={() => {
                  setSearchKeyword('');
                  form.setFieldsValue({ invitee: undefined });
                }}
                onOpenChange={(open) => {
                  if (open) {
                    setCandidateSearchActive(true);
                  }
                }}
                onSearch={setSearchKeyword}
                placeholder="姓名、用户名或邮箱"
              />
            </Form.Item>
          )}

          <Form.Item label="预设权限" name="access_role">
            <Select
              allowClear
              loading={accessRolesQuery.isFetching}
              options={accessRoleOptions}
              placeholder="普通成员"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="邀请详情"
        open={Boolean(detailInviteId)}
        onClose={() => setDetailInviteId(undefined)}
        width={drawerWidthSm}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="邀请 ID">
            {detailQuery.data?.pk || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="邀请目标">
            <span style={wrapTextStyle}>
              {inviteTargetLabel(detailQuery.data)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="邀请方式">
            {inviteSourceLabel(detailQuery.data)}
          </Descriptions.Item>
          <Descriptions.Item label="邀请状态">
            <Tag color={detailStage.color}>{detailStage.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="被邀请用户">
            {detailQuery.data?.invitee || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预设权限">
            {invitePermissionLabel(detailQuery.data)}
          </Descriptions.Item>
          <Descriptions.Item label="等待天数">
            {inviteWaitingDays(detailQuery.data)} 天
          </Descriptions.Item>
          <Descriptions.Item label="Key">
            <span style={wrapTextStyle}>{detailQuery.data?.key || '-'}</span>
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
    </TenantSelectionGuard>
  );
};

export default TenantInvitesPage;
