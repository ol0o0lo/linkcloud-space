import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  message,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll } from '@/pages/_shared/adminLayout';
import { formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import {
  getWorkspaceMemberEmployeeName,
  getWorkspaceMemberJobTitle,
} from '@/services/manual/organizationMembers';
import {
  appsOrganizationsApiCreateMember,
  appsOrganizationsApiSearchMembers,
} from '@/services/openapi/organizationMembers';
import { appsOrganizationsWorkspaceApiListWorkspaceMembers } from '@/services/openapi/organizationWorkspace';
import { organizationQueryKeys } from '../queryKeys';
import {
  OrganizationWorkspaceCard,
  type OrganizationWorkspaceCardContext,
} from './OrganizationWorkspaceCard';

const PAGE_SIZE = 20;

export const AllMembersPanel: React.FC<{
  mode?: 'all' | 'ungrouped';
  canManageMembers: boolean;
  onOpenMember: (
    memberId: number,
    tab: 'profile' | 'access' | 'responsibilities',
  ) => void;
  workspaceCard: OrganizationWorkspaceCardContext;
}> = ({ canManageMembers, mode = 'all', onOpenMember, workspaceCard }) => {
  const workspace = useTenantWorkspace();
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.sm;
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState<string>();
  const [searchDraft, setSearchDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [form] = Form.useForm<{ user: number }>();

  const membersQuery = useQuery({
    queryKey: organizationQueryKeys.members(workspace.selectedOrgSlug, {
      page,
      keyword,
      ungrouped: mode === 'ungrouped',
    }),
    queryFn: () =>
      appsOrganizationsWorkspaceApiListWorkspaceMembers({
        page,
        page_size: PAGE_SIZE,
        keyword,
        ungrouped: mode === 'ungrouped' || undefined,
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const candidatesQuery = useQuery({
    queryKey: [
      'organization-workspace',
      workspace.selectedOrgSlug,
      'member-candidates',
      candidateKeyword,
    ],
    queryFn: () =>
      appsOrganizationsApiSearchMembers({ keyword: candidateKeyword }),
    enabled:
      canManageMembers && createOpen && candidateKeyword.trim().length > 2,
  });
  const createMutation = useMutation({
    mutationFn: (values: { user: number }) =>
      appsOrganizationsApiCreateMember({ user: values.user }),
    onSuccess: async () => {
      message.success('成员已加入组织');
      setCreateOpen(false);
      setCandidateKeyword('');
      form.resetFields();
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.root(workspace.selectedOrgSlug),
      });
    },
  });

  const columns: ProColumns<API.WorkspaceMemberOut>[] = useMemo(
    () => [
      {
        title: '成员',
        dataIndex: 'user',
        width: 220,
        render: (_value, record) => (
          <Space>
            <Avatar src={record.user.avatar_url}>
              {(
                getWorkspaceMemberEmployeeName(record) ||
                formatPersonLabel(record.user)
              ).slice(0, 1)}
            </Avatar>
            <Space orientation="vertical" size={0}>
              <Space size={6} wrap>
                <Typography.Text strong>
                  {getWorkspaceMemberEmployeeName(record) ||
                    formatPersonLabel(record.user)}
                </Typography.Text>
                {record.is_owner ? <Tag color="gold">所有者</Tag> : null}
              </Space>
              <Typography.Text type="secondary">
                {[
                  getWorkspaceMemberJobTitle(record),
                  record.user.email || record.user.username,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography.Text>
            </Space>
          </Space>
        ),
      },
      {
        title: '所属团队',
        dataIndex: 'teams',
        width: 200,
        responsive: ['md'],
        render: (_value, record) =>
          record.teams.length ? (
            <Space size={[4, 4]} wrap>
              {record.teams.map((team) => (
                <Tag key={team.id}>{team.name}</Tag>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">未分组</Typography.Text>
          ),
      },
      {
        title: '房源分工',
        dataIndex: 'has_responsibility',
        width: 110,
        align: 'center',
        render: (_value, record) => (
          <Tag color={record.has_responsibility ? 'success' : 'warning'}>
            {record.has_responsibility ? '已配置' : '未配置'}
          </Tag>
        ),
      },
      {
        title: '加入时间',
        dataIndex: 'created_at',
        width: 150,
        align: 'center',
        responsive: ['xxl'],
        render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 100,
        align: 'center',
        fixed: 'right',
        render: (_value, record) => (
          <Button
            type="link"
            size="small"
            onClick={() => onOpenMember(record.member_id, 'profile')}
          >
            查看
          </Button>
        ),
      },
    ],
    [onOpenMember],
  );

  const closeCreate = () => {
    setCreateOpen(false);
    setCandidateKeyword('');
    form.resetFields();
  };

  const memberActions = (
    <AdminToolbar>
      <Input.Search
        allowClear
        placeholder="搜索姓名 / 职位 / 用户名 / 邮箱"
        value={searchDraft}
        onChange={(event) => {
          setSearchDraft(event.target.value);
          if (!event.target.value && keyword) {
            setKeyword(undefined);
            setPage(1);
          }
        }}
        onSearch={(value) => {
          setKeyword(value.trim() || undefined);
          setPage(1);
        }}
        style={{ width: isNarrow ? '100%' : 280 }}
      />
      {canManageMembers ? (
        <Button
          block={isNarrow}
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          添加已有用户
        </Button>
      ) : null}
    </AdminToolbar>
  );

  return (
    <OrganizationWorkspaceCard {...workspaceCard} actions={memberActions}>
      {membersQuery.isError ? (
        <Alert
          type="error"
          showIcon
          title="成员目录加载失败"
          description={(membersQuery.error as Error).message}
          action={<Button onClick={() => membersQuery.refetch()}>重试</Button>}
        />
      ) : (
        <ProTable<API.WorkspaceMemberOut>
          rowKey="member_id"
          cardProps={false}
          columns={columns}
          dataSource={membersQuery.data?.items || []}
          loading={membersQuery.isLoading}
          search={false}
          options={false}
          toolBarRender={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  keyword
                    ? '没有找到匹配的成员'
                    : mode === 'ungrouped'
                      ? '当前没有未分组成员'
                      : '当前组织还没有成员'
                }
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: membersQuery.data?.total || 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          scroll={{
            ...adminTableScroll,
            y: 'max(240px, calc(100dvh - 320px))',
          }}
        />
      )}

      {canManageMembers ? (
        <Modal
          title="添加已有用户"
          open={createOpen}
          okText="添加成员"
          confirmLoading={createMutation.isPending}
          onCancel={closeCreate}
          onOk={async () =>
            createMutation.mutateAsync(await form.validateFields())
          }
        >
          <Typography.Paragraph type="secondary">
            搜索尚未加入当前组织的站内用户。所有者身份需要通过组织概览中的所有者
            转移流程管理。
          </Typography.Paragraph>
          <Form form={form} layout="vertical">
            <Form.Item
              label="用户"
              name="user"
              rules={[{ required: true, message: '请选择用户' }]}
            >
              <Select
                showSearch={{
                  filterOption: false,
                  onSearch: setCandidateKeyword,
                }}
                placeholder="输入至少 3 个字符搜索"
                loading={candidatesQuery.isFetching}
                options={(candidatesQuery.data || []).map((item) => ({
                  value: item.pk,
                  label: `${formatPersonLabel(item)} (${item.email || item.username})`,
                }))}
              />
            </Form.Item>
          </Form>
        </Modal>
      ) : null}
    </OrganizationWorkspaceCard>
  );
};
