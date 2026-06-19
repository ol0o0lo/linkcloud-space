import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Drawer, Form, Image, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { adminTableScroll, codeWrapStyle, drawerWidthLg, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsAccountsApiApproveAdminRealName,
  appsAccountsApiGetAdminRealNameVerification,
  appsAccountsApiListAdminRealNameVerifications,
  appsAccountsApiMoveAdminRealNameToManualReview,
  appsAccountsApiRejectAdminRealName,
  appsAccountsApiRevokeAdminRealName,
} from '@/services/openapi/realNameAdmin';
import { IdentityText, NoteModal, StatusTag, personText, platformQueryKeys } from '../shared';

type ActionState = { row: API.AdminRealNameVerificationRowOut; action: 'approve' | 'reject' | 'manual' | 'revoke' } | null;

const RealNameAdminPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [detailId, setDetailId] = useState<number>();
  const [form] = Form.useForm<{ note: string }>();
  const listQuery = useQuery({
    queryKey: platformQueryKeys.realName(page),
    queryFn: () => appsAccountsApiListAdminRealNameVerifications({ page, page_size: 10 }),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'real-name-detail', detailId],
    queryFn: () => appsAccountsApiGetAdminRealNameVerification({ verification_id: detailId! }),
    enabled: Boolean(detailId),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ row, action, note }: { row: API.AdminRealNameVerificationRowOut; action: NonNullable<ActionState>['action']; note: string }) => {
      const params = { verification_id: row.id };
      const body = { note };
      if (action === 'approve') return appsAccountsApiApproveAdminRealName(params, body);
      if (action === 'reject') return appsAccountsApiRejectAdminRealName(params, body);
      if (action === 'manual') return appsAccountsApiMoveAdminRealNameToManualReview(params, body);
      return appsAccountsApiRevokeAdminRealName(params, body);
    },
    onSuccess: async () => {
      setActionState(null);
      form.resetFields();
      await listQuery.refetch();
    },
  });

  const openAction = (row: API.AdminRealNameVerificationRowOut, action: NonNullable<ActionState>['action']) => {
    form.setFieldsValue({ note: '' });
    setActionState({ row, action });
  };

  const columns: ColumnsType<API.AdminRealNameVerificationRowOut> = [
    { title: '用户', dataIndex: 'user', width: 160, render: (user) => personText(user) },
    { title: '姓名', dataIndex: 'real_name_masked', width: 220, render: (_value, record) => <IdentityText primary={record.real_name_masked} secondary={record.id_number_masked} /> },
    { title: '状态', dataIndex: 'status_label', width: 120, render: (_value, record) => <StatusTag value={record.status_label} /> },
    { title: '来源', dataIndex: 'source_label', width: 120 },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setDetailId(record.id)}>详情</a>
          <a onClick={() => openAction(record, 'approve')}>通过</a>
          <a onClick={() => openAction(record, 'reject')}>驳回</a>
          <a onClick={() => openAction(record, 'manual')}>转人工</a>
          <a onClick={() => openAction(record, 'revoke')}>撤销</a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <>
      <Card title="实名审核">
        <Table
          rowKey="id"
          loading={listQuery.isLoading}
          columns={columns}
          dataSource={listQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{ current: listQuery.data?.page || page, pageSize: listQuery.data?.page_size || 10, total: listQuery.data?.total || 0, onChange: setPage }}
        />
      </Card>
      <NoteModal
        open={Boolean(actionState)}
        title="实名审核操作"
        loading={actionMutation.isPending}
        form={form}
        onCancel={() => setActionState(null)}
        onOk={async () => {
          const values = await form.validateFields();
          if (actionState) await actionMutation.mutateAsync({ row: actionState.row, action: actionState.action, note: values.note || '' });
        }}
      />
      <Drawer title="实名详情" open={Boolean(detailId)} onClose={() => setDetailId(undefined)} width={drawerWidthLg}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户">{detailQuery.data ? personText(detailQuery.data.user) : '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{detailQuery.data?.status_label || '-'}</Descriptions.Item>
          <Descriptions.Item label="真实姓名">{detailQuery.data?.real_name || detailQuery.data?.real_name_masked || '-'}</Descriptions.Item>
          <Descriptions.Item label="证件号"><span style={wrapTextStyle}>{detailQuery.data?.id_number || detailQuery.data?.id_number_masked || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="证件图片">
            <Space wrap>
              {((detailQuery.data as any)?.id_card_media || []).map((item: any) => (
                <Space key={item.media_id} orientation="vertical" size={4}>
                  <Typography.Text>{item.label || item.side || '证件图片'}</Typography.Text>
                  <Image alt={item.label || item.side || '证件图片'} src={item.url} width={180} />
                </Space>
              ))}
              {!((detailQuery.data as any)?.id_card_media || []).length ? '-' : null}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="来源">{detailQuery.data?.source_label || '-'}</Descriptions.Item>
          <Descriptions.Item label="供应商">{detailQuery.data?.provider_label || '-'}</Descriptions.Item>
          <Descriptions.Item label="失败原因">{detailQuery.data?.failure_reason || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核备注">{detailQuery.data?.review_note || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核人">{detailQuery.data?.reviewed_by || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核时间">{detailQuery.data?.reviewed_at ? dayjs(detailQuery.data.reviewed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="供应商请求 ID"><span style={wrapTextStyle}>{detailQuery.data?.provider_request_id || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="供应商结果">
            <Typography.Text code style={codeWrapStyle}>{detailQuery.data?.provider_result ? JSON.stringify(detailQuery.data.provider_result) : '-'}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
        <Table
          style={{ marginTop: 16 }}
          rowKey="created_at"
          dataSource={detailQuery.data?.logs || []}
          pagination={false}
          scroll={adminTableScroll}
          columns={[
            { title: '动作', dataIndex: 'action_label', width: 160 },
            { title: '备注', dataIndex: 'note', width: 260, render: (value) => <span style={wrapTextStyle}>{value || '-'}</span> },
            { title: '时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
          ]}
        />
      </Drawer>
    </>
  );
};

export default RealNameAdminPage;
