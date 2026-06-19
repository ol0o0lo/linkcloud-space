import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthSm, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsOrganizationsApiCreateInvite, appsOrganizationsApiDeleteInvite, appsOrganizationsApiGetInvite, appsOrganizationsApiListInvites, appsOrganizationsApiResendInvite } from '@/services/openapi/organizationInvites';
import { normalizeEmailLikeInput } from '@/utils/email';
import { TenantSectionHint, TenantSelectionGuard, tenantQueryKeys, useTenantWorkspace } from '../shared';

const TenantInvitesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInviteId, setDetailInviteId] = useState<number>();
  const [form] = Form.useForm<API.InviteIn>();

  const invitesQuery = useQuery({
    queryKey: tenantQueryKeys.invites(workspace.selectedOrgSlug, page),
    queryFn: () => appsOrganizationsApiListInvites({ page, page_size: 10 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

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
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: number) => appsOrganizationsApiResendInvite({ invite_id: inviteId }),
  });

  const deleteMutation = useMutation({
    mutationFn: (inviteId: number) => appsOrganizationsApiDeleteInvite({ invite_id: inviteId }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    },
  });

  const columns: ColumnsType<API.InviteOut> = useMemo(
    () => [
      {
        title: '邀请邮箱',
        dataIndex: 'invitee_email',
        width: 260,
        render: (value) => <span style={wrapTextStyle}>{value || '站内用户邀请'}</span>,
      },
      {
        title: 'Owner',
        dataIndex: 'is_owner',
        width: 100,
        render: (value) => (value ? '是' : '否'),
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
            <a onClick={() => setDetailInviteId(record.pk)}>详情</a>
            <a onClick={() => void resendMutation.mutateAsync(record.pk)}>重发</a>
            <Popconfirm title="确认取消该邀请？" onConfirm={() => void deleteMutation.mutateAsync(record.pk)}>
              <a>取消</a>
            </Popconfirm>
          </ResponsiveActions>
        ),
      },
    ],
    [deleteMutation, resendMutation],
  );

  return (
    <TenantSelectionGuard title="邀请管理" subtitle="发送、重发和取消当前租户的邀请。">
      <Card
        title="租户邀请"
        extra={
          <AdminToolbar>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建邀请
            </Button>
          </AdminToolbar>
        }
      >
        <TenantSectionHint text="第一版先打通邮箱邀请主流程，后续再补站内用户邀请的更细粒度体验。" />
        <Table
          rowKey="pk"
          loading={invitesQuery.isLoading}
          columns={columns}
          dataSource={invitesQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{
            current: invitesQuery.data?.page || page,
            pageSize: invitesQuery.data?.page_size || 10,
            total: invitesQuery.data?.total || 0,
            onChange: setPage,
          }}
        />
      </Card>

      <Modal
        title="新建邀请"
        open={createOpen}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await createMutation.mutateAsync(values);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="邀请邮箱" name="invitee_email" normalize={normalizeEmailLikeInput} rules={[{ required: true, message: '请输入邀请邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="member@example.com" />
          </Form.Item>
          <Form.Item label="接受后设为 Owner" name="is_owner" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="邀请详情" open={Boolean(detailInviteId)} onClose={() => setDetailInviteId(undefined)} width={drawerWidthSm}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="邀请 ID">{detailQuery.data?.pk || '-'}</Descriptions.Item>
          <Descriptions.Item label="邀请邮箱"><span style={wrapTextStyle}>{detailQuery.data?.invitee_email || '站内用户邀请'}</span></Descriptions.Item>
          <Descriptions.Item label="被邀请用户">{detailQuery.data?.invitee || '-'}</Descriptions.Item>
          <Descriptions.Item label="Owner">{detailQuery.data?.is_owner ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="Key"><span style={wrapTextStyle}>{detailQuery.data?.key || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="创建时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{detailQuery.data?.updated_at ? dayjs(detailQuery.data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TenantInvitesPage;
