import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Image,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import {
  adminTableScroll,
  codeWrapStyle,
  drawerWidthLg,
  fullWidthStyle,
  ResponsiveActions,
  toolbarSelectPopupWidth,
  toolbarShortSelectStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  appsAccountsApiApproveAdminRealName,
  appsAccountsApiGetAdminRealNameVerification,
  appsAccountsApiListAdminRealNameVerifications,
  appsAccountsApiMoveAdminRealNameToManualReview,
  appsAccountsApiRejectAdminRealName,
  appsAccountsApiRevokeAdminRealName,
} from '@/services/openapi/realNameAdmin';
import { IdentityText, NoteModal, personText, StatusTag } from '../shared';

type ReviewAction = 'approve' | 'reject' | 'manual' | 'revoke';
type ActionState = { row: RealNameInsight; action: ReviewAction } | null;
type RealNameLogWithMapping = API.RealNameLogOut & {
  action__mapping?: string;
  from_status__mapping?: string;
  to_status__mapping?: string;
};
type RealNameWithMapping = API.RealNameVerificationOut & {
  status__mapping?: string;
  source__mapping?: string;
  provider__mapping?: string;
};
type AdminRealNameRowWithMapping = API.AdminRealNameVerificationRowOut &
  RealNameWithMapping;
type RealNameDetailWithMapping = API.RealNameVerificationDetailOut &
  RealNameWithMapping & {
    logs: RealNameLogWithMapping[];
  };
type RealNameInsight = AdminRealNameRowWithMapping & {
  stage_color: string;
};
type RealNameSearchParams = {
  current?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
};

const trimParam = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function buildPhoneLabel(user?: Record<string, any>) {
  const countryCode = user?.phone_country_code || '';
  const nationalNumber = user?.phone_national_number || user?.phone || '';

  if (!nationalNumber) {
    return '';
  }
  return `${countryCode} ${nationalNumber}`.trim();
}

function buildUserSecondary(user?: Record<string, any>) {
  return user?.email || buildPhoneLabel(user) || undefined;
}

function buildRealNameInsight(
  row: AdminRealNameRowWithMapping,
): RealNameInsight {
  if (row.status === 'verified') {
    return {
      ...row,
      stage_color: 'green',
    };
  }

  if (row.status === 'manual_review') {
    return {
      ...row,
      stage_color: 'gold',
    };
  }

  if (row.status === 'rejected') {
    return {
      ...row,
      stage_color: 'volcano',
    };
  }

  if (row.status === 'revoked') {
    return {
      ...row,
      stage_color: 'default',
    };
  }

  return {
    ...row,
    stage_color: 'blue',
  };
}

function getIdCardSideLabel(side?: string) {
  return side === 'front'
    ? '身份证人像面'
    : side === 'back'
      ? '身份证国徽面'
      : '证件图片';
}

function getActionMeta(action: ReviewAction, row: RealNameInsight) {
  if (action === 'approve') {
    return {
      label: row.status === 'rejected' ? '重新通过' : '通过实名',
      title: row.status === 'rejected' ? '重新通过实名' : '通过实名',
    };
  }
  if (action === 'reject') {
    return {
      label: '驳回实名',
      title: '驳回实名',
    };
  }
  if (action === 'manual') {
    return {
      label: row.status === 'rejected' ? '转回人工' : '转人工复核',
      title: row.status === 'rejected' ? '转回人工复核' : '转人工复核',
    };
  }
  return {
    label: '撤销实名',
    title: '撤销实名',
  };
}

function getAllowedActions(row: RealNameInsight): ReviewAction[] {
  if (row.status === 'verified') {
    return ['revoke'];
  }
  if (row.status === 'rejected') {
    return ['approve', 'manual'];
  }
  if (row.status === 'manual_review') {
    return ['approve', 'reject'];
  }
  if (row.status === 'revoked') {
    return [];
  }
  return ['approve', 'reject', 'manual'];
}

const RealNameAdminPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>();
  const [actionState, setActionState] = useState<ActionState>(null);
  const [detailId, setDetailId] = useState<number>();
  const tableActionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<{ note: string }>();
  const realNameEnums = useEnums(['accounts.real_name_status']);
  const tableParams = React.useMemo(
    () => ({ status: statusFilter }),
    [statusFilter],
  );

  const detailQuery = useQuery({
    queryKey: ['platform-management', 'real-name-detail', detailId],
    queryFn: () =>
      appsAccountsApiGetAdminRealNameVerification({
        verification_id: detailId || 0,
      }) as Promise<RealNameDetailWithMapping>,
    enabled: Boolean(detailId),
  });
  const actionMutation = useMutation({
    mutationFn: async ({
      row,
      action,
      note,
    }: {
      row: RealNameInsight;
      action: ReviewAction;
      note: string;
    }) => {
      const params = { verification_id: row.id };
      const body = { note };
      if (action === 'approve')
        return appsAccountsApiApproveAdminRealName(params, body);
      if (action === 'reject')
        return appsAccountsApiRejectAdminRealName(params, body);
      if (action === 'manual')
        return appsAccountsApiMoveAdminRealNameToManualReview(params, body);
      return appsAccountsApiRevokeAdminRealName(params, body);
    },
    onSuccess: async () => {
      setActionState(null);
      form.resetFields();
      tableActionRef.current?.reload();
    },
  });

  const detailData = detailQuery.data as RealNameDetailWithMapping | undefined;

  const columns: ProColumns<RealNameInsight>[] = [
    {
      title: '用户身份',
      dataIndex: 'user',
      width: 220,
      render: (_value, record) => (
        <IdentityText
          primary={personText(record.user)}
          secondary={buildUserSecondary(record.user)}
        />
      ),
    },
    {
      title: '实名主体',
      dataIndex: 'real_name_masked',
      width: 220,
      render: (_value, record) => (
        <IdentityText
          primary={record.real_name_masked}
          secondary={record.id_number_masked}
        />
      ),
    },
    {
      title: '审核阶段',
      dataIndex: 'status__mapping',
      width: 140,
      render: (_value, record) => (
        <Tag color={record.stage_color}>
          {enumMapping(record.status, record.status__mapping)}
        </Tag>
      ),
    },
    {
      title: '来源与处理',
      dataIndex: 'source__mapping',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            {enumMapping(record.source, record.source__mapping)}
          </Typography.Text>
          <Typography.Text type="secondary">
            {enumMapping(record.provider, record.provider__mapping)}
          </Typography.Text>
          {record.failure_reason || record.review_note ? (
            <Typography.Text type="secondary">
              {record.failure_reason || record.review_note}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '最近处理',
      dataIndex: 'reviewed_at',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Typography.Text>
            {record.reviewed_at
              ? `${record.reviewed_by || '系统'} ${dayjs(record.reviewed_at).format('YYYY-MM-DD HH:mm')}`
              : '-'}
          </Typography.Text>
          <Typography.Text type="secondary">{`提交于 ${dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 280,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setDetailId(record.id)}>详情</a>
          {getAllowedActions(record).map((action) => (
            <a
              key={action}
              onClick={() => setActionState({ row: record, action })}
            >
              {getActionMeta(action, record).label}
            </a>
          ))}
        </ResponsiveActions>
      ),
    },
  ];

  const currentActionMeta = actionState
    ? getActionMeta(actionState.action, actionState.row)
    : null;

  return (
    <PageContainer title="实名审核">
      <Card>
        <ProTable<RealNameInsight>
          actionRef={tableActionRef}
          rowKey="id"
          headerTitle="实名列表"
          columns={columns}
          request={async (params: RealNameSearchParams) => {
            const result = await appsAccountsApiListAdminRealNameVerifications({
              page: params.current || 1,
              page_size: params.pageSize || 10,
              keyword: trimParam(params.keyword),
              status: params.status || undefined,
            });
            return {
              data: ((result.items || []) as AdminRealNameRowWithMapping[]).map(
                (item) => buildRealNameInsight(item),
              ),
              total: result.total || 0,
              success: true,
            };
          }}
          params={tableParams}
          search={false}
          options={{
            density: true,
            reload: false,
            search: {
              name: 'keyword',
              placeholder: '按用户名、邮箱、手机号、实名搜索',
            },
            setting: true,
          }}
          toolBarRender={() => [
            <Select
              key="status"
              allowClear
              placeholder="按实名状态筛选"
              style={toolbarShortSelectStyle}
              popupMatchSelectWidth={toolbarSelectPopupWidth}
              options={enumSelectOptions(
                realNameEnums.data,
                'accounts.real_name_status',
              )}
              onChange={(value) => setStatusFilter(value || undefined)}
            />,
            <Button key="back" href="/dashboard/super-admin/users">
              返回用户列表
            </Button>,
          ]}
          ghost
          scroll={adminTableScroll}
          pagination={{ defaultPageSize: 10 }}
        />
      </Card>

      <NoteModal
        open={Boolean(actionState)}
        title={currentActionMeta?.title || '实名审核操作'}
        loading={actionMutation.isPending}
        form={form}
        onCancel={() => setActionState(null)}
        onOk={async () => {
          const values = await form.validateFields();
          if (actionState)
            await actionMutation.mutateAsync({
              row: actionState.row,
              action: actionState.action,
              note: values.note || '',
            });
        }}
      />

      <Drawer
        title="实名详情"
        open={Boolean(detailId)}
        onClose={() => setDetailId(undefined)}
        width={drawerWidthLg}
      >
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户">
              {detailData ? personText(detailData.user) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              {detailData ? (
                <StatusTag
                  value={enumMapping(
                    detailData.status,
                    detailData.status__mapping,
                  )}
                />
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="真实姓名">
              {detailData?.real_name || detailData?.real_name_masked || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="证件号">
              <span style={wrapTextStyle}>
                {detailData?.id_number || detailData?.id_number_masked || '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="证件图片">
              <Space wrap>
                {(detailData?.id_card_media || []).map((item: any) => (
                  <Space key={item.media_id} orientation="vertical" size={4}>
                    <Typography.Text>
                      {getIdCardSideLabel(item.side)}
                    </Typography.Text>
                    <Image
                      alt={getIdCardSideLabel(item.side)}
                      src={item.url}
                      width={180}
                    />
                  </Space>
                ))}
                {!(detailData?.id_card_media || []).length ? '-' : null}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              {detailData
                ? enumMapping(detailData.source, detailData.source__mapping)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="供应商">
              {detailData
                ? enumMapping(detailData.provider, detailData.provider__mapping)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="失败原因">
              {detailData?.failure_reason || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核备注">
              {detailData?.review_note || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核人">
              {detailData?.reviewed_by || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核时间">
              {detailData?.reviewed_at
                ? dayjs(detailData.reviewed_at).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="供应商请求 ID">
              <span style={wrapTextStyle}>
                {detailData?.provider_request_id || '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="供应商结果">
              <Typography.Text code style={codeWrapStyle}>
                {detailData?.provider_result
                  ? JSON.stringify(detailData.provider_result)
                  : '-'}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="created_at"
            dataSource={detailData?.logs || []}
            pagination={false}
            scroll={adminTableScroll}
            columns={[
              {
                title: '动作',
                dataIndex: 'action__mapping',
                width: 160,
                render: (_value, record) =>
                  enumMapping(record.action, record.action__mapping),
              },
              {
                title: '备注',
                dataIndex: 'note',
                width: 280,
                render: (value) => (
                  <span style={wrapTextStyle}>{value || '-'}</span>
                ),
              },
              {
                title: '时间',
                dataIndex: 'created_at',
                width: 170,
                render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
              },
            ]}
          />
        </Space>
      </Drawer>
    </PageContainer>
  );
};

export default RealNameAdminPage;
