import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { appsOrganizationsApiListMembers, appsOrganizationsApiSearchMembers } from '@/services/openapi/organizationMembers';
import { appsOrganizationsApiCreateInvite, appsOrganizationsApiDeleteInvite, appsOrganizationsApiGetInvite, appsOrganizationsApiListInvites, appsOrganizationsApiResendInvite } from '@/services/openapi/organizationInvites';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import { adminTableScroll, drawerWidthSm, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '../shared';
import { normalizeEmailLikeInput } from '@/utils/email';

type InviteMode = 'email' | 'internal';

const pageSize = 10;
const staleInviteDays = 3;
const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};
const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

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
      summary: '请先选择一条邀请，再查看邀请对象、管理员预设和等待时长。',
    };
  }

  if (invite.is_owner && waitDays >= staleInviteDays) {
    return {
      color: 'purple' as const,
      label: '管理员邀请待确认',
      summary: '这是一条接受后会成为管理员的邀请，而且已经等待较久，建议尽快确认是否继续保留。',
    };
  }

  if (invite.is_owner) {
    return {
      color: 'purple' as const,
      label: '管理员预设',
      summary: '接受后会直接成为管理员，请确认对方确实需要管理空间。',
    };
  }

  if (waitDays >= staleInviteDays) {
    return {
      color: 'gold' as const,
      label: '长时间未处理',
      summary: '邀请已经等待较久，建议重发提醒、确认对方是否还要加入，或取消邀请。',
    };
  }

  return {
    color: 'blue' as const,
    label: '待入场',
    summary: '邀请已经发出，下一步确认对方是否加入，以及加入后进入哪个团队。',
  };
}

export function buildInvitePayload(inviteMode: InviteMode, values: API.InviteIn) {
  const payload = values.access_role ? { access_role: values.access_role } : {};
  return inviteMode === 'email' ? { ...payload, invitee_email: values.invitee_email } : { ...payload, invitee: values.invitee };
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
  const membersQuery = useQuery({
    queryKey: ['tenant', 'invite-members', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const candidateQuery = useQuery({
    queryKey: ['tenant', 'invite-candidates', workspace.selectedOrgSlug, searchKeyword],
    queryFn: () => appsOrganizationsApiSearchMembers({ q: searchKeyword }),
    enabled: createOpen && inviteMode === 'internal' && candidateSearchActive,
  });
  const accessRolesQuery = useQuery({
    queryKey: ['tenant', 'invite-access-roles', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const invites = invitesQuery.data?.items || [];

  const detailQuery = useQuery({
    queryKey: ['tenant', 'invite-detail', workspace.selectedOrgSlug, detailInviteId],
    queryFn: () => appsOrganizationsApiGetInvite({ invite_id: detailInviteId! }),
    enabled: Boolean(workspace.selectedOrgSlug && detailInviteId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.InviteIn) => appsOrganizationsApiCreateInvite(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      setInviteMode('email');
      setSearchKeyword('');
      setCandidateSearchActive(false);
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    },
  });
  const resendMutation = useMutation({
    mutationFn: (inviteId: number) => appsOrganizationsApiResendInvite({ invite_id: inviteId }),
  });
  const deleteMutation = useMutation({
    mutationFn: (inviteId: number) => appsOrganizationsApiDeleteInvite({ invite_id: inviteId }),
    onSuccess: async (_result, inviteId) => {
      if (detailInviteId === inviteId) {
        setDetailInviteId(undefined);
      }
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    },
  });

  const staleInvites = invites.filter((invite) => inviteWaitingDays(invite) >= staleInviteDays);
  const ownerInvites = invites.filter((invite) => invite.is_owner);
  const currentMemberCount = membersQuery.data?.items?.length || 0;

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
    () => (accessRolesQuery.data || []).map((role) => ({ label: role.name, value: role.id })),
    [accessRolesQuery.data],
  );
  const accessRoleNameById = useMemo(
    () => new Map((accessRolesQuery.data || []).map((role) => [role.id, role.name])),
    [accessRolesQuery.data],
  );

  const invitePermissionLabel = useCallback((invite?: API.InviteOut | null) => {
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
  }, [accessRoleNameById]);

  const columns: ColumnsType<API.InviteOut> = useMemo(
    () => [
      {
        title: '邀请目标',
        dataIndex: 'invitee_email',
        width: 260,
        render: (_value, record) => <Typography.Text strong>{inviteTargetLabel(record)}</Typography.Text>,
      },
      {
        title: '权限',
        dataIndex: 'access_role',
        width: 120,
        render: (_value, record) => <Tag color={record.is_owner ? 'purple' : record.access_role ? 'blue' : 'default'}>{invitePermissionLabel(record)}</Tag>,
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
            <a onClick={() => void resendMutation.mutateAsync(record.pk)}>重发</a>
            <Popconfirm title="确认取消该邀请？" onConfirm={() => void deleteMutation.mutateAsync(record.pk)}>
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
    <TenantSelectionGuard title="邀请管理" subtitle="管理成员邀请、管理员预设和待处理邀请。">
      <Card loading={invitesQuery.isLoading || membersQuery.isLoading}>
        <div style={sectionStyle}>
          <Typography.Text strong>邀请概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待入场邀请" value={invites.length} />
                <Typography.Text type="secondary">当前空间里尚未处理完的邀请总数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="管理员预设邀请" value={ownerInvites.length} />
                <Typography.Text type="secondary">{ownerInvites.length ? '这些邀请接受后会直接成为管理员。' : '当前没有高权限邀请。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="长时间未处理" value={staleInvites.length} />
                <Typography.Text type="secondary">{staleInvites.length ? `这些邀请等待已超过 ${staleInviteDays} 天。` : '当前邀请处理时效正常。'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前成员数" value={currentMemberCount} />
                <Typography.Text type="secondary">用于和待入场邀请一起判断空间成员增长情况。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>
      </Card>

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
        style={{ marginTop: 16 }}
      >
        <Table
          rowKey="pk"
          loading={invitesQuery.isLoading}
          columns={columns}
          dataSource={pagedInvites}
          locale={{
            emptyText: <Empty description="当前还没有待处理邀请，可以直接新建一条入场邀请。" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
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
          await createMutation.mutateAsync(buildInvitePayload(inviteMode, values));
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
                form.setFieldsValue({ invitee_email: undefined, invitee: undefined });
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
              rules={[{ required: true, message: '请输入邀请邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
            >
              <Input placeholder="member@example.com" />
            </Form.Item>
          ) : (
            <Form.Item label="邀请人员" name="invitee" extra="点开后显示候选用户，也可输入姓名、用户名或邮箱搜索。" rules={[{ required: true, message: '请选择要邀请的站内用户' }]}>
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

          <Form.Item label="预设权限" name="access_role" extra="不选择时，接受邀请后为普通成员；需要更多权限时选择一个已有角色。">
            <Select allowClear loading={accessRolesQuery.isFetching} options={accessRoleOptions} placeholder="普通成员" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="邀请详情" open={Boolean(detailInviteId)} onClose={() => setDetailInviteId(undefined)} width={drawerWidthSm}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="邀请 ID">{detailQuery.data?.pk || '-'}</Descriptions.Item>
          <Descriptions.Item label="邀请目标">
            <span style={wrapTextStyle}>{inviteTargetLabel(detailQuery.data)}</span>
          </Descriptions.Item>
          <Descriptions.Item label="邀请方式">{inviteSourceLabel(detailQuery.data)}</Descriptions.Item>
          <Descriptions.Item label="邀请状态">
            <Tag color={detailStage.color}>{detailStage.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="处理建议">
            <span style={wrapTextStyle}>{detailStage.summary}</span>
          </Descriptions.Item>
          <Descriptions.Item label="被邀请用户">{detailQuery.data?.invitee || '-'}</Descriptions.Item>
          <Descriptions.Item label="预设权限">{invitePermissionLabel(detailQuery.data)}</Descriptions.Item>
          <Descriptions.Item label="等待天数">{inviteWaitingDays(detailQuery.data)} 天</Descriptions.Item>
          <Descriptions.Item label="Key">
            <span style={wrapTextStyle}>{detailQuery.data?.key || '-'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{detailQuery.data?.updated_at ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TenantInvitesPage;
