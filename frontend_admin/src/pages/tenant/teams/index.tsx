import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthMd, ResponsiveActions, toolbarControlStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiListMembers } from '@/services/openapi/organizationMembers';
import { appsTeamsApiCreateTeam, appsTeamsApiDeleteTeam, appsTeamsApiGetTeam, appsTeamsApiListTeams, appsTeamsApiPatchTeam } from '@/services/openapi/teams';
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, tenantQueryKeys, useTenantWorkspace } from '../shared';

const TenantTeamsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editingTeam, setEditingTeam] = useState<API.TeamOut | null>(null);
  const [detailTeamId, setDetailTeamId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<API.TeamPatchIn & API.TeamIn>();

  const teamsQuery = useQuery({
    queryKey: tenantQueryKeys.teams(workspace.selectedOrgSlug, page, q),
    queryFn: () => appsTeamsApiListTeams({ page, page_size: 10, q: q || undefined }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const membersQuery = useQuery({
    queryKey: ['tenant', 'team-member-options', workspace.selectedOrgSlug],
    queryFn: () => appsOrganizationsApiListMembers({ page: 1, page_size: 100 }),
    enabled: open && Boolean(workspace.selectedOrgSlug),
  });

  const detailQuery = useQuery({
    queryKey: ['tenant', 'team-detail', workspace.selectedOrgSlug, detailTeamId],
    queryFn: () => appsTeamsApiGetTeam({ team_id: detailTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && detailTeamId),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: API.TeamPatchIn & API.TeamIn) => {
      if (editingTeam) {
        return appsTeamsApiPatchTeam({ team_id: editingTeam.id }, payload);
      }
      return appsTeamsApiCreateTeam(payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingTeam(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.usage(workspace.selectedOrgSlug) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: number) => appsTeamsApiDeleteTeam({ team_id: teamId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
      await workspace.queryClient.invalidateQueries({ queryKey: tenantQueryKeys.usage(workspace.selectedOrgSlug) });
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

  const columns: ColumnsType<API.TeamOut> = useMemo(
    () => [
      {
        title: '团队名称',
        dataIndex: 'name',
        width: 220,
        render: (value) => <span style={wrapTextStyle}>{value}</span>,
      },
      {
        title: '成员',
        dataIndex: 'member_details',
        width: 360,
        render: (value: API.MemberDetailOut[]) => <span style={wrapTextStyle}>{value.map((item) => formatPersonLabel(item)).join('、') || '暂无成员'}</span>,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 170,
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 150,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setDetailTeamId(record.id)}>详情</a>
            <a
              onClick={() => {
                setEditingTeam(record);
                setOpen(true);
                form.setFieldsValue({ name: record.name, members: record.members });
              }}
            >
              编辑
            </a>
            <Popconfirm title="确认删除该团队？" onConfirm={() => void deleteMutation.mutateAsync(record.id)}>
              <a>删除</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, form],
  );

  return (
    <TenantSelectionGuard title="团队管理" subtitle="维护当前租户的团队和团队成员。">
      <Card
        title="团队列表"
        extra={
          <AdminToolbar>
            <Input.Search allowClear placeholder="搜索团队名" style={toolbarControlStyle} onSearch={(value) => { setPage(1); setQ(value); }} />
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
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="第一版集中承接团队列表、创建、编辑成员和删除这几条核心链路。" />
        <Table
          rowKey="id"
          loading={teamsQuery.isLoading}
          columns={columns}
          dataSource={teamsQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{
            current: teamsQuery.data?.page || page,
            pageSize: teamsQuery.data?.page_size || 10,
            total: teamsQuery.data?.total || 0,
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
          <Form.Item label="团队名称" name="name" rules={[{ required: true, message: '请输入团队名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="成员" name="members">
            <Select mode="multiple" allowClear options={memberOptions} placeholder="选择团队成员" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="团队详情" open={Boolean(detailTeamId)} onClose={() => setDetailTeamId(undefined)} width={drawerWidthMd}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="团队名称">{detailQuery.data?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="团队成员">
            <span style={wrapTextStyle}>{(detailQuery.data?.member_details || []).map((item) => formatPersonLabel(item)).join('、') || '暂无成员'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="成员 ID">{(detailQuery.data?.members || []).join('、') || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{detailQuery.data?.updated_at ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TenantTeamsPage;
