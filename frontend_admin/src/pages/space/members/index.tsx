import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  drawerWidthSm,
  ResponsiveActions,
  toolbarControlStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import { appsAccessApiListOrganizationBindings } from '@/services/openapi/accessOrganizationBindings';
import { appsAccessApiListTeamBindingsView } from '@/services/openapi/accessTeamBindings';
import {
  appsOrganizationsApiCreateMember,
  appsOrganizationsApiDeleteMember,
  appsOrganizationsApiGetMember,
  appsOrganizationsApiListMembers,
  appsOrganizationsApiPatchMember,
  appsOrganizationsApiSearchMembers,
} from '@/services/openapi/organizationMembers';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import {
  formatPersonLabel,
  TenantSelectionGuard,
  useTenantWorkspace,
} from '../shared';

const pageSize = 10;

function roleNames(
  bindings: Array<API.OrganizationBindingOut | API.TeamBindingOut>,
) {
  return bindings.map((item) => item.role.name);
}

function uniqueRoleNames(
  bindings: Array<API.OrganizationBindingOut | API.TeamBindingOut>,
) {
  return Array.from(new Set(roleNames(bindings)));
}

const TenantMembersPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailMemberId, setDetailMemberId] = useState<number>();
  const [selectedMemberId, setSelectedMemberId] = useState<number>();
  const [form] = Form.useForm<API.MemberIn>();

  const membersQuery = useQuery({
    queryKey: ['tenant', 'members', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const teamsQuery = useQuery({
    queryKey: ['tenant', 'member-teams', workspace.selectedOrgSlug],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const orgBindingsQuery = useQuery({
    queryKey: ['tenant', 'member-org-bindings', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrganizationBindings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const members = membersQuery.data?.items || [];
  React.useEffect(() => {
    const firstMemberId = members[0]?.pk;
    if (!selectedMemberId && firstMemberId) {
      setSelectedMemberId(firstMemberId);
    }
  }, [members, selectedMemberId]);

  const teams = teamsQuery.data?.items || [];
  const teamBindingQueries = useQueries({
    queries: teams.map((team) => ({
      queryKey: [
        'tenant',
        'member-team-bindings',
        workspace.selectedOrgSlug,
        team.id,
      ],
      queryFn: () => appsAccessApiListTeamBindingsView({ team_id: team.id }),
      enabled: Boolean(workspace.selectedOrgSlug),
    })),
  });

  const candidateQuery = useQuery({
    queryKey: [
      'tenant',
      'member-candidates',
      workspace.selectedOrgSlug,
      searchKeyword,
    ],
    queryFn: () => appsOrganizationsApiSearchMembers({ keyword: searchKeyword }),
    enabled: createOpen && searchKeyword.trim().length > 2,
  });
  const detailQuery = useQuery({
    queryKey: [
      'tenant',
      'member-detail',
      workspace.selectedOrgSlug,
      detailMemberId,
    ],
    queryFn: () =>
      appsOrganizationsApiGetMember({ member_id: detailMemberId ?? 0 }),
    enabled: Boolean(workspace.selectedOrgSlug && detailMemberId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.MemberIn) =>
      appsOrganizationsApiCreateMember(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'teams'],
      });
    },
  });
  const ownerMutation = useMutation({
    mutationFn: ({
      memberId,
      isOwner,
    }: {
      memberId: number;
      isOwner: boolean;
    }) =>
      appsOrganizationsApiPatchMember(
        { member_id: memberId },
        { is_owner: isOwner },
      ),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (memberId: number) =>
      appsOrganizationsApiDeleteMember({ member_id: memberId }),
    onSuccess: async (_result, memberId) => {
      if (selectedMemberId === memberId) {
        setSelectedMemberId(undefined);
      }
      if (detailMemberId === memberId) {
        setDetailMemberId(undefined);
      }
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'teams'],
      });
    },
  });

  const memberOptions = useMemo(
    () =>
      members.map((item) => ({
        label: `${formatPersonLabel(item.user)} (${item.user.username})`,
        value: item.pk,
      })),
    [members],
  );

  const teamMapByUserId = useMemo(() => {
    const next = new Map<number, API.TeamOut[]>();
    teams.forEach((team) => {
      (team.members || []).forEach((userId) => {
        const items = next.get(userId) || [];
        items.push(team);
        next.set(userId, items);
      });
    });
    return next;
  }, [teams]);

  const orgBindingsByUserId = useMemo(() => {
    const next = new Map<number, API.OrganizationBindingOut[]>();
    (orgBindingsQuery.data || []).forEach((binding) => {
      const items = next.get(binding.user.id) || [];
      items.push(binding);
      next.set(binding.user.id, items);
    });
    return next;
  }, [orgBindingsQuery.data]);

  const teamBindings = useMemo(
    () =>
      teamBindingQueries.flatMap((query) => {
        const data = query.data || [];
        return data;
      }),
    [teamBindingQueries],
  );
  const teamBindingsByUserId = useMemo(() => {
    const next = new Map<number, API.TeamBindingOut[]>();
    teamBindings.forEach((binding) => {
      const items = next.get(binding.user.id) || [];
      items.push(binding);
      next.set(binding.user.id, items);
    });
    return next;
  }, [teamBindings]);

  const filteredMembers = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) {
      return members;
    }
    return members.filter((item) => {
      const haystack = [
        formatPersonLabel(item.user),
        item.user.username,
        item.user.email || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [members, q]);
  const pagedMembers = filteredMembers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const teamBindingsLoading = teamBindingQueries.some(
    (query) => query.isLoading,
  );
  const columns: ColumnsType<API.MemberOut> = useMemo(
    () => [
      {
        title: '成员',
        dataIndex: 'user',
        width: 240,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Space wrap size={[8, 8]}>
              <Typography.Text strong>
                {formatPersonLabel(record.user)}
              </Typography.Text>
              {selectedMemberId === record.pk ? (
                <Tag color="blue">当前选中</Tag>
              ) : null}
            </Space>
            <a href={`mailto:${record.user.email || ''}`}>
              {record.user.email || '无邮箱'}
            </a>
          </Space>
        ),
      },
      {
        title: '组织身份',
        dataIndex: 'is_owner',
        width: 260,
        render: (value, record) => {
          const bindings = orgBindingsByUserId.get(record.user.id) || [];
          return (
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Space wrap size={[8, 8]}>
                <Tag color={value ? 'purple' : 'default'}>
                  {value ? '所有者' : '普通成员'}
                </Tag>
                {uniqueRoleNames(bindings).map((name) => (
                  <Tag key={name} color="cyan">
                    {name}
                  </Tag>
                ))}
              </Space>
              <Switch
                checked={value}
                loading={ownerMutation.isPending}
                onChange={(checked) =>
                  void ownerMutation.mutateAsync({
                    memberId: record.pk,
                    isOwner: checked,
                  })
                }
              />
            </Space>
          );
        },
      },
      {
        title: '团队归属',
        dataIndex: 'teams',
        width: 260,
        render: (_value, record) => {
          const memberTeams = teamMapByUserId.get(record.user.id) || [];
          return (
            <Space wrap size={[8, 8]}>
              {memberTeams.length ? (
                memberTeams.map((team) => (
                  <Tag key={team.id} color="blue">
                    {team.name}
                  </Tag>
                ))
              ) : (
                <Tag color="gold">未入团队</Tag>
              )}
            </Space>
          );
        },
      },
      {
        title: '职责分配',
        dataIndex: 'bindings',
        width: 300,
        render: (_value, record) => {
          const orgBindings = orgBindingsByUserId.get(record.user.id) || [];
          const teamBindingsForUser =
            teamBindingsByUserId.get(record.user.id) || [];
          const roleTexts = [
            ...uniqueRoleNames(orgBindings),
            ...uniqueRoleNames(teamBindingsForUser),
          ];
          return (
            <Typography.Text>
              {roleTexts.length ? roleTexts.join('、') : '暂无职责'}
            </Typography.Text>
          );
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 160,
        align: 'center',
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setSelectedMemberId(record.pk)}>设为当前</a>
            <a onClick={() => setDetailMemberId(record.pk)}>详情</a>
            <Popconfirm
              title="确认移除该成员？"
              onConfirm={() => void deleteMutation.mutateAsync(record.pk)}
            >
              <a>移除</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [
      deleteMutation,
      orgBindingsByUserId,
      ownerMutation,
      selectedMemberId,
      teamBindingsByUserId,
      teamMapByUserId,
    ],
  );

  const detailMember = members.find((item) => item.pk === detailMemberId);
  const detailUserId = detailQuery.data?.user.id || detailMember?.user.id;
  const detailTeams = detailUserId
    ? teamMapByUserId.get(detailUserId) || []
    : [];
  const detailOrgBindings = detailUserId
    ? orgBindingsByUserId.get(detailUserId) || []
    : [];
  const detailTeamBindings = detailUserId
    ? teamBindingsByUserId.get(detailUserId) || []
    : [];

  return (
    <TenantSelectionGuard title="成员管理">
      <Card>
        <Flex align="center" justify="space-between" gap="small" wrap>
          <Typography.Text strong>当前成员</Typography.Text>
          <Flex align="center" gap="small" wrap>
            <Select
              aria-label="当前成员"
              loading={membersQuery.isLoading}
              options={memberOptions}
              placeholder="选择成员"
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              style={{ width: 320, maxWidth: '100%' }}
            />
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              添加成员
            </Button>
          </Flex>
        </Flex>
      </Card>

      <Card
        title="成员列表"
        style={{ marginTop: 16 }}
        extra={
          <AdminToolbar>
            <Input.Search
              allowClear
              placeholder="搜索姓名/邮箱"
              style={toolbarControlStyle}
              onSearch={(value) => {
                setPage(1);
                setQ(value);
              }}
            />
          </AdminToolbar>
        }
      >
        <Table
          rowKey="pk"
          loading={
            membersQuery.isLoading ||
            teamsQuery.isLoading ||
            orgBindingsQuery.isLoading ||
            teamBindingsLoading
          }
          columns={columns}
          dataSource={pagedMembers}
          locale={{
            emptyText: (
              <Empty
                description={members.length ? '没有匹配的成员' : '暂无成员'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          scroll={adminTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: filteredMembers.length,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title="添加成员"
        open={createOpen}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="搜索候选用户">
            <Input.Search
              allowClear
              onSearch={setSearchKeyword}
              placeholder="姓名、用户名或邮箱"
            />
          </Form.Item>
          <Form.Item
            label="选择成员"
            name="user"
            rules={[{ required: true, message: '请选择要添加的用户' }]}
          >
            <Select
              showSearch
              filterOption={false}
              options={(candidateQuery.data || []).map((item) => ({
                label: `${formatPersonLabel(item)} (${item.email || item.username})`,
                value: item.pk,
              }))}
              onSearch={setSearchKeyword}
            />
          </Form.Item>
          <Form.Item
            label="加入后设为所有者"
            name="is_owner"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="成员详情"
        open={Boolean(detailMemberId)}
        onClose={() => setDetailMemberId(undefined)}
        width={drawerWidthSm}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="成员">
            {detailQuery.data ? formatPersonLabel(detailQuery.data.user) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="用户名">
            {detailQuery.data?.user.username || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            <span style={wrapTextStyle}>
              {detailQuery.data?.user.email || '-'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="所有者">
            {detailQuery.data?.is_owner ? '是' : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="归属团队">
            <span style={wrapTextStyle}>
              {detailTeams.length
                ? detailTeams.map((team) => team.name).join('、')
                : '暂无团队归属'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="空间级职责">
            <span style={wrapTextStyle}>
              {detailOrgBindings.length
                ? uniqueRoleNames(detailOrgBindings).join('、')
                : '暂无空间级职责'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="团队级职责">
            <span style={wrapTextStyle}>
              {detailTeamBindings.length
                ? uniqueRoleNames(detailTeamBindings).join('、')
                : '暂无团队级职责'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="加入时间">
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

export default TenantMembersPage;
