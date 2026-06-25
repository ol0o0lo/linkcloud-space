import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { appsOrganizationsApiListMembers, appsOrganizationsApiSearchMembers } from '@/services/openapi/organizationMembers';
import { appsOrganizationsApiCreateInvite, appsOrganizationsApiDeleteInvite, appsOrganizationsApiGetInvite, appsOrganizationsApiListInvites, appsOrganizationsApiResendInvite } from '@/services/openapi/organizationInvites';
import { AdminToolbar, adminTableScroll, drawerWidthSm, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { TenantSectionHint, TenantSelectionGuard, useTenantWorkspace } from '../shared';
import { normalizeEmailLikeInput } from '@/utils/email';

type InviteGovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

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
      summary: '请先选择一条邀请，再判断这条邀请是普通入场、owner 预设，还是已经拖延过久。',
    };
  }

  if (invite.is_owner && waitDays >= staleInviteDays) {
    return {
      color: 'purple' as const,
      label: 'Owner 高风险待处理',
      summary: '这是一条预设 owner 的邀请，而且已经等待较久，建议优先确认是否继续保留这条高权限入口。',
    };
  }

  if (invite.is_owner) {
    return {
      color: 'purple' as const,
      label: 'Owner 预设',
      summary: '接受后会直接成为 owner，应该明确这是治理接班、共管还是临时授权，而不是随手开高权限入口。',
    };
  }

  if (waitDays >= staleInviteDays) {
    return {
      color: 'gold' as const,
      label: '长时间未处理',
      summary: '邀请已经停留较久，说明入场链路可能卡在邮箱触达、候选人确认或内部审批上。',
    };
  }

  return {
    color: 'blue' as const,
    label: '待入场',
    summary: '邀请已经发出，下一步应该确认候选人是否顺利入场，以及入场后由哪个团队和角色接住。',
  };
}

const TenantInvitesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInviteId, setDetailInviteId] = useState<number>();
  const [selectedInviteId, setSelectedInviteId] = useState<number>();
  const [inviteMode, setInviteMode] = useState<InviteMode>('email');
  const [searchKeyword, setSearchKeyword] = useState('');
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
    enabled: createOpen && inviteMode === 'internal' && searchKeyword.trim().length > 2,
  });

  const invites = invitesQuery.data?.items || [];
  React.useEffect(() => {
    const firstInviteId = invites[0]?.pk;
    if (!selectedInviteId && firstInviteId) {
      setSelectedInviteId(firstInviteId);
    }
  }, [invites, selectedInviteId]);

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
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    },
  });
  const resendMutation = useMutation({
    mutationFn: (inviteId: number) => appsOrganizationsApiResendInvite({ invite_id: inviteId }),
  });
  const deleteMutation = useMutation({
    mutationFn: (inviteId: number) => appsOrganizationsApiDeleteInvite({ invite_id: inviteId }),
    onSuccess: async (_result, inviteId) => {
      if (selectedInviteId === inviteId) {
        setSelectedInviteId(undefined);
      }
      if (detailInviteId === inviteId) {
        setDetailInviteId(undefined);
      }
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    },
  });

  const selectedInvite = useMemo(() => invites.find((item) => item.pk === selectedInviteId), [invites, selectedInviteId]);
  const selectedInviteStage = inviteStage(selectedInvite);

  const staleInvites = invites.filter((invite) => inviteWaitingDays(invite) >= staleInviteDays);
  const ownerInvites = invites.filter((invite) => invite.is_owner);
  const internalInvites = invites.filter((invite) => Boolean(invite.invitee) && !invite.invitee_email);
  const emailInvites = invites.filter((invite) => Boolean(invite.invitee_email));
  const currentMemberCount = membersQuery.data?.items?.length || 0;

  const closureSignals = useMemo<InviteGovernanceSignal[]>(
    () => [
      {
        key: 'owner',
        title: 'Owner 预设',
        emphasis: ownerInvites.length ? `${ownerInvites.length} 条 Owner 预设邀请` : '无 Owner 预设邀请',
        summary: ownerInvites.length
          ? `当前有 ${ownerInvites.length} 条邀请在接受后会直接成为 owner，这类邀请必须带着治理意图发送。`
          : '当前没有预设 owner 的邀请，高权限入口相对克制。',
        description: 'owner 邀请不是普通成员入场，它意味着空间级治理、规则修改权和异常收口权的潜在转移。',
        actionLabel: '查看租户资料',
        actionHref: '/dashboard/tenant/settings',
      },
      {
        key: 'stale',
        title: '待处理时长',
        emphasis: staleInvites.length ? `${staleInvites.length} 条长时间未处理` : '邀请处理及时',
        summary: staleInvites.length
          ? `当前有 ${staleInvites.length} 条邀请已经等待超过 ${staleInviteDays} 天，说明入场流程可能卡住了。`
          : '当前邀请都还在合理处理窗口内。',
        description: '长时间未处理的邀请要么重发，要么取消，避免邀请池越来越脏。',
        actionLabel: '处理邀请台账',
        actionHref: '/dashboard/tenant/invites',
      },
      {
        key: 'entry',
        title: '入场承接',
        emphasis: invites.length ? `${invites.length} 条待入场，当前成员 ${currentMemberCount} 人` : '当前没有待入场邀请',
        summary: invites.length
          ? '邀请不是终点，真正的目标是把候选人转成成员，再进一步纳入团队和职责承接。'
          : '当前没有待处理邀请，可以把重点放到成员治理和团队承接上。',
        description: '入场链路应该连到成员页、团队页和授权页，而不是停在“邮件发出去了”。',
        actionLabel: '查看成员管理',
        actionHref: '/dashboard/tenant/members',
      },
      {
        key: 'channel',
        title: '邀请方式',
        emphasis: internalInvites.length ? `${internalInvites.length} 条站内邀请` : `${emailInvites.length} 条邮箱邀请`,
        summary: internalInvites.length
          ? `当前已经开始使用站内用户邀请，适合对已有账号用户做更稳定的入场承接。`
          : '当前仍以邮箱邀请为主，如果大量候选人本身已有账号，建议直接使用站内用户邀请。',
        description: '邀请方式本身也是治理设计：外部候选人适合邮箱邀请，已存在账号用户更适合直接用站内邀请。',
        actionLabel: '新建邀请',
        actionHref: '/dashboard/tenant/invites',
      },
    ],
    [currentMemberCount, emailInvites.length, internalInvites.length, invites.length, ownerInvites.length, staleInvites.length],
  );

  const filteredInvites = invites;
  const pagedInvites = filteredInvites.slice((page - 1) * pageSize, page * pageSize);

  const candidateOptions = useMemo(
    () =>
      (candidateQuery.data || []).map((item) => ({
        label: `${[item.first_name, item.last_name].filter(Boolean).join(' ') || item.username} (${item.email || item.username})`,
        value: item.pk,
      })),
    [candidateQuery.data],
  );

  const columns: ColumnsType<API.InviteOut> = useMemo(
    () => [
      {
        title: '邀请目标',
        dataIndex: 'invitee_email',
        width: 260,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Space wrap size={[8, 8]}>
              <Typography.Text strong>{inviteTargetLabel(record)}</Typography.Text>
              {selectedInviteId === record.pk ? <Tag color="blue">当前治理焦点</Tag> : null}
            </Space>
            <Typography.Text type="secondary">{inviteSourceLabel(record)}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '权限预设',
        dataIndex: 'is_owner',
        width: 180,
        render: (value) => <Tag color={value ? 'purple' : 'default'}>{value ? '接受后为 Owner' : '普通成员入场'}</Tag>,
      },
      {
        title: '等待时长',
        dataIndex: 'created_at',
        width: 180,
        render: (_value, record) => {
          const waitDays = inviteWaitingDays(record);
          return (
            <Space orientation="vertical" size={4}>
              <Typography.Text>{waitDays} 天</Typography.Text>
              <Typography.Text type="secondary">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '治理状态',
        dataIndex: 'status',
        width: 320,
        render: (_value, record) => {
          const stage = inviteStage(record);
          return (
            <Space orientation="vertical" size={4}>
              <Tag color={stage.color}>{stage.label}</Tag>
              <Typography.Text type="secondary">{stage.summary}</Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 180,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setSelectedInviteId(record.pk)}>聚焦</a>
            <a onClick={() => setDetailInviteId(record.pk)}>详情</a>
            <a onClick={() => void resendMutation.mutateAsync(record.pk)}>重发</a>
            <Popconfirm title="确认取消该邀请？" onConfirm={() => void deleteMutation.mutateAsync(record.pk)}>
              <a>取消</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, resendMutation, selectedInviteId],
  );

  const detailStage = inviteStage(detailQuery.data);

  return (
    <TenantSelectionGuard title="邀请管理" subtitle="把邀请从邮件动作升级成成员入场、owner 预设和后续职责承接的治理入口。">
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Typography.Text strong>邀请治理焦点</Typography.Text>
            <TenantSectionHint text="先判断这条邀请是不是高权限入口、是不是拖太久，再决定重发、取消，还是继续推进成员入场承接。" />
          </div>
          <AdminToolbar>
            <Select
              aria-label="治理焦点邀请"
              loading={invitesQuery.isLoading}
              options={invites.map((invite) => ({ label: inviteTargetLabel(invite), value: invite.pk }))}
              placeholder="选择治理焦点邀请"
              value={selectedInviteId}
              onChange={setSelectedInviteId}
              style={{ width: 320, maxWidth: '100%' }}
            />
            <Button
              type="primary"
              onClick={() => {
                setCreateOpen(true);
                setInviteMode('email');
              }}
            >
              新建邀请
            </Button>
          </AdminToolbar>
          {selectedInvite ? (
            <Alert type="info" showIcon title={`${inviteTargetLabel(selectedInvite)}：${selectedInviteStage.label}`} description={selectedInviteStage.summary} />
          ) : (
            <Alert type="warning" showIcon title="当前还没有治理焦点邀请" description="如果还没有邀请，先创建一条成员入场邀请；如果已有邀请，先选择一条查看风险和承接建议。" />
          )}
        </Space>
      </Card>

      <Card loading={invitesQuery.isLoading || membersQuery.isLoading} style={{ marginTop: 16 }}>
        <div style={sectionStyle}>
          <Typography.Text strong>邀请治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待入场邀请" value={invites.length} />
                <Typography.Text type="secondary">当前空间里尚未处理完的邀请总数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="Owner 预设邀请" value={ownerInvites.length} />
                <Typography.Text type="secondary">{ownerInvites.length ? '这些邀请接受后会直接变成 owner。' : '当前没有高权限邀请。'}</Typography.Text>
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
                <Typography.Text type="secondary">用于和待入场邀请一起判断组织扩张节奏。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前邀请执行面</Typography.Text>
          {selectedInvite ? (
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="邀请方式" value={inviteSourceLabel(selectedInvite)} />
                  <Typography.Text type="secondary">{selectedInvite.invitee_email ? '适合未注册候选人或外部邮箱触达。' : '适合已存在账号用户的直接入场。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="Owner 预设" value={selectedInvite.is_owner ? '是' : '否'} />
                  <Typography.Text type="secondary">{selectedInvite.is_owner ? '接受后会直接进入高权限层。' : '当前只是普通成员入场。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="等待天数" value={inviteWaitingDays(selectedInvite)} />
                  <Typography.Text type="secondary">{inviteWaitingDays(selectedInvite) >= staleInviteDays ? '已进入需要清理或升级跟进的时段。' : '还在正常跟进窗口内。'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="治理状态" value={selectedInviteStage.label} />
                  <Typography.Text type="secondary">{selectedInviteStage.summary}</Typography.Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Empty description="请选择一个治理焦点邀请后，再查看当前邀请执行面。" style={{ marginTop: 16 }} />
          )}
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {closureSignals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>{signal.title}</Typography.Text>
                      <Tag color="blue">{signal.emphasis}</Tag>
                    </Space>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    <a href={signal.actionHref}>{signal.actionLabel}</a>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Card>

      <Card title="邀请治理台账" style={{ marginTop: 16 }}>
        <TenantSectionHint text="这里保留重发、取消和详情动作，但邀请不再只是收件箱记录，而是成员入场、owner 预设和后续权限承接的治理台账。" />
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
            total: filteredInvites.length,
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
        }}
        onOk={async () => {
          const values = await form.validateFields();
          const payload =
            inviteMode === 'email'
              ? {
                  invitee_email: values.invitee_email,
                  is_owner: values.is_owner,
                }
              : {
                  invitee: values.invitee,
                  is_owner: values.is_owner,
                };
          await createMutation.mutateAsync(payload);
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
            <>
              <Form.Item label="搜索候选用户" extra="输入 3 个以上字符后会调用后端搜索可邀请的站内用户。">
                <Input.Search allowClear onSearch={setSearchKeyword} placeholder="姓名、用户名或邮箱" />
              </Form.Item>
              <Form.Item label="选择站内用户" name="invitee" rules={[{ required: true, message: '请选择要邀请的站内用户' }]}>
                <Select showSearch filterOption={false} options={candidateOptions} onSearch={setSearchKeyword} placeholder="选择一个已有账号用户" />
              </Form.Item>
            </>
          )}

          <Form.Item label="接受后设为 Owner" name="is_owner" valuePropName="checked">
            <Switch />
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
          <Descriptions.Item label="治理状态">
            <Tag color={detailStage.color}>{detailStage.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="治理建议">
            <span style={wrapTextStyle}>{detailStage.summary}</span>
          </Descriptions.Item>
          <Descriptions.Item label="被邀请用户">{detailQuery.data?.invitee || '-'}</Descriptions.Item>
          <Descriptions.Item label="Owner">{detailQuery.data?.is_owner ? '是' : '否'}</Descriptions.Item>
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
