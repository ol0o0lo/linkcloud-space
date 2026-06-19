import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthSm, ResponsiveActions, toolbarControlStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiCreateMember, appsOrganizationsApiDeleteMember, appsOrganizationsApiGetMember, appsOrganizationsApiListMembers, appsOrganizationsApiPatchMember, appsOrganizationsApiSearchMembers } from '@/services/openapi/organizationMembers';
import { TenantSectionHint, TenantSelectionGuard, formatPersonLabel, tenantQueryKeys, useTenantWorkspace } from '../shared';

const TenantMembersPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailMemberId, setDetailMemberId] = useState<number>();
  const [form] = Form.useForm<API.MemberIn>();

  const membersQuery = useQuery({
    queryKey: tenantQueryKeys.members(workspace.selectedOrgSlug, page, q),
    queryFn: () => appsOrganizationsApiListMembers({ page, page_size: 10, q: q || undefined }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const candidateQuery = useQuery({
    queryKey: ['tenant', 'member-candidates', workspace.selectedOrgSlug, searchKeyword],
    queryFn: () => appsOrganizationsApiSearchMembers({ q: searchKeyword }),
    enabled: createOpen && searchKeyword.trim().length > 2,
  });

  const detailQuery = useQuery({
    queryKey: ['tenant', 'member-detail', workspace.selectedOrgSlug, detailMemberId],
    queryFn: () => appsOrganizationsApiGetMember({ member_id: detailMemberId! }),
    enabled: Boolean(workspace.selectedOrgSlug && detailMemberId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: API.MemberIn) => appsOrganizationsApiCreateMember(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    },
  });

  const ownerMutation = useMutation({
    mutationFn: ({ memberId, isOwner }: { memberId: number; isOwner: boolean }) => appsOrganizationsApiPatchMember({ member_id: memberId }, { is_owner: isOwner }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (memberId: number) => appsOrganizationsApiDeleteMember({ member_id: memberId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    },
  });

  const columns: ColumnsType<API.MemberOut> = useMemo(
    () => [
      {
        title: '成员',
        dataIndex: 'user',
        width: 260,
        render: (_value, record) => (
          <Space orientation="vertical" size={0}>
            <span>{formatPersonLabel(record.user)}</span>
            <a href={`mailto:${record.user.email || ''}`}>{record.user.email || '无邮箱'}</a>
          </Space>
        ),
      },
      {
        title: 'Owner',
        dataIndex: 'is_owner',
        width: 100,
        render: (value, record) => (
          <Switch
            checked={value}
            loading={ownerMutation.isPending}
            onChange={(checked) => void ownerMutation.mutateAsync({ memberId: record.pk, isOwner: checked })}
          />
        ),
      },
      {
        title: '加入时间',
        dataIndex: 'created_at',
        width: 170,
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 120,
        render: (_value, record) => (
          <ResponsiveActions>
            <a onClick={() => setDetailMemberId(record.pk)}>详情</a>
            <Popconfirm title="确认移除该成员？" onConfirm={() => void deleteMutation.mutateAsync(record.pk)}>
              <a>移除</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, ownerMutation],
  );

  return (
    <TenantSelectionGuard title="成员管理" subtitle="管理当前租户成员、owner 身份和新增成员。">
      <Card
        title="租户成员"
        extra={
          <AdminToolbar>
            <Input.Search allowClear placeholder="搜索姓名/邮箱" style={toolbarControlStyle} onSearch={(value) => { setPage(1); setQ(value); }} />
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              添加成员
            </Button>
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="成员列表、owner 切换和成员新增/移除都直接走后端租户成员接口。" />
        <Table
          rowKey="pk"
          loading={membersQuery.isLoading}
          columns={columns}
          dataSource={membersQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{
            current: membersQuery.data?.page || page,
            pageSize: membersQuery.data?.page_size || 10,
            total: membersQuery.data?.total || 0,
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
          <Form.Item label="搜索候选用户" extra="输入 3 个以上字符后会调用后端搜索可添加成员接口。">
            <Input.Search allowClear onSearch={setSearchKeyword} placeholder="姓名、用户名或邮箱" />
          </Form.Item>
          <Form.Item label="选择成员" name="user" rules={[{ required: true, message: '请选择要添加的用户' }]}>
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
          <Form.Item label="加入后设为 Owner" name="is_owner" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="成员详情" open={Boolean(detailMemberId)} onClose={() => setDetailMemberId(undefined)} width={drawerWidthSm}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="成员">{detailQuery.data ? formatPersonLabel(detailQuery.data.user) : '-'}</Descriptions.Item>
          <Descriptions.Item label="用户名">{detailQuery.data?.user.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱"><span style={wrapTextStyle}>{detailQuery.data?.user.email || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="Owner">{detailQuery.data?.is_owner ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="加入时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{detailQuery.data?.updated_at ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TenantMembersPage;
