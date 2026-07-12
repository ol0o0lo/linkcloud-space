import { useMutation, useQuery } from '@tanstack/react-query';
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
  drawerWidthMd,
  ResponsiveActions,
  toolbarControlStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import {
  appsTeamsApiCreateTeam,
  appsTeamsApiDeleteTeam,
  appsTeamsApiGetTeam,
  appsTeamsApiListTeams,
  appsTeamsApiPatchTeam,
} from '@/services/openapi/teams';
import {
  formatPersonLabel,
  TenantSelectionGuard,
  useTenantWorkspace,
} from '../shared';

type TeamLike = Pick<API.TeamOut, 'members' | 'member_details'> &
  Partial<Pick<API.TeamOut, 'id' | 'name' | 'created_at' | 'updated_at'>>;

const pageSize = 10;

function memberCountOfTeam(team?: TeamLike | null) {
  return team?.member_details?.length || team?.members?.length || 0;
}

function renderMemberPreview(team?: TeamLike | null) {
  const preview = (team?.member_details || [])
    .slice(0, 3)
    .map((item: API.MemberDetailOut) => formatPersonLabel(item));
  if (!preview.length) {
    return '暂无成员';
  }
  return preview.join('、');
}

const TenantTeamsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editingTeam, setEditingTeam] = useState<API.TeamOut | null>(null);
  const [detailTeamId, setDetailTeamId] = useState<number>();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.TeamPatchIn & API.TeamIn>();

  const teamsQuery = useQuery({
    queryKey: ['tenant', 'teams', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const membersQuery = useQuery({
    queryKey: ['tenant', 'members', workspace.selectedOrgSlug, 'governance'],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const teams = teamsQuery.data?.items || [];
  React.useEffect(() => {
    const firstTeamId = teams[0]?.id;
    if (!selectedTeamId && firstTeamId) {
      setSelectedTeamId(firstTeamId);
    }
  }, [selectedTeamId, teams]);

  const detailQuery = useQuery({
    queryKey: [
      'tenant',
      'team-detail',
      workspace.selectedOrgSlug,
      detailTeamId,
    ],
    queryFn: () => appsTeamsApiGetTeam({ team_id: detailTeamId ?? 0 }),
    enabled: Boolean(workspace.selectedOrgSlug && detailTeamId),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: API.TeamPatchIn & API.TeamIn) => {
      if (editingTeam) {
        return appsTeamsApiPatchTeam({ team_id: editingTeam.id }, payload);
      }
      return appsTeamsApiCreateTeam(payload);
    },
    onSuccess: async (nextTeam) => {
      setOpen(false);
      setEditingTeam(null);
      form.resetFields();
      if (nextTeam?.id) {
        setSelectedTeamId(nextTeam.id);
      }
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'teams'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'usage'],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: number) => appsTeamsApiDeleteTeam({ team_id: teamId }),
    onSuccess: async (_result, teamId) => {
      if (selectedTeamId === teamId) {
        setSelectedTeamId(undefined);
      }
      if (detailTeamId === teamId) {
        setDetailTeamId(undefined);
      }
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'teams'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['tenant', 'usage'],
      });
    },
  });

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.items || []).map((item) => ({
        label: `${formatPersonLabel(item.user)} (${item.user.username})`,
        value: item.user.id,
      })),
    [membersQuery.data],
  );

  const filteredTeams = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) {
      return teams;
    }
    return teams.filter((team) => team.name.toLowerCase().includes(keyword));
  }, [q, teams]);
  const pagedTeams = filteredTeams.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const columns: ColumnsType<API.TeamOut> = useMemo(
    () => [
      {
        title: '团队',
        dataIndex: 'name',
        width: 220,
        render: (_value, record) => (
          <Space orientation="vertical" size={4}>
            <Space wrap size={[8, 8]}>
              <Typography.Text strong>{record.name}</Typography.Text>
              {selectedTeamId === record.id ? (
                <Tag color="blue">当前选中</Tag>
              ) : null}
            </Space>
            <Typography.Text type="secondary">
              创建于 {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '成员结构',
        dataIndex: 'member_details',
        width: 300,
        render: (_value, record) => (
          <Space wrap size={[8, 8]}>
            <Tag color={memberCountOfTeam(record) ? 'green' : 'gold'}>
              {memberCountOfTeam(record)} 人
            </Tag>
            <Typography.Text>{renderMemberPreview(record)}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 180,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setSelectedTeamId(record.id)}>设为当前</a>
            <a onClick={() => setDetailTeamId(record.id)}>详情</a>
            <a
              onClick={() => {
                setEditingTeam(record);
                setOpen(true);
                form.setFieldsValue({
                  name: record.name,
                  members: record.members,
                });
              }}
            >
              编辑
            </a>
            <Popconfirm
              title="确认删除该团队？"
              onConfirm={() => void deleteMutation.mutateAsync(record.id)}
            >
              <a>删除</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, form, selectedTeamId],
  );

  return (
    <TenantSelectionGuard
      title="团队管理"
      extra={
        <Flex align="center" gap="small" wrap>
            <Select
              aria-label="当前团队"
              loading={teamsQuery.isLoading}
              options={teams.map((team) => ({
                label: team.name,
                value: team.id,
              }))}
              placeholder="选择团队"
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              style={{ width: 320, maxWidth: '100%' }}
            />
            <Button
              type="primary"
              onClick={() => {
                setEditingTeam(null);
                form.resetFields();
                setOpen(true);
              }}
            >
              新建团队
            </Button>
        </Flex>
      }
    >

      <Card
        title="团队列表"
        style={{ marginTop: 16 }}
        extra={
          <AdminToolbar>
            <Input.Search
              allowClear
              placeholder="搜索团队名"
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
          rowKey="id"
          loading={teamsQuery.isLoading}
          columns={columns}
          dataSource={pagedTeams}
          locale={{
            emptyText: (
              <Empty
                description={teams.length ? '没有匹配的团队' : '暂无团队'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          scroll={adminTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: filteredTeams.length,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title={editingTeam ? '编辑团队' : '新建团队'}
        open={open}
        confirmLoading={saveMutation.isPending}
        onCancel={() => {
          setOpen(false);
          setEditingTeam(null);
        }}
        onOk={async () => {
          const values = await form.validateFields();
          await saveMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="团队名称"
            name="name"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="成员" name="members">
            <Select
              mode="multiple"
              allowClear
              options={memberOptions}
              placeholder="选择团队成员"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="团队详情"
        open={Boolean(detailTeamId)}
        onClose={() => setDetailTeamId(undefined)}
        width={drawerWidthMd}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="团队名称">
            {detailQuery.data?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="团队成员">
            <span style={wrapTextStyle}>
              {(detailQuery.data?.member_details || [])
                .map((item) => formatPersonLabel(item))
                .join('、') || '暂无成员'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="成员 ID">
            {(detailQuery.data?.members || []).join('、') || '-'}
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

export default TenantTeamsPage;
