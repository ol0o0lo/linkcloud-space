import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
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
  codeWrapStyle,
  drawerWidthLg,
  fullWidthStyle,
  ResponsiveActions,
  toolbarControlStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsAccountsApiApproveAdminRealName,
  appsAccountsApiGetAdminRealNameVerification,
  appsAccountsApiListAdminRealNameVerifications,
  appsAccountsApiMoveAdminRealNameToManualReview,
  appsAccountsApiRejectAdminRealName,
  appsAccountsApiRevokeAdminRealName,
} from '@/services/openapi/realNameAdmin';
import { enumMapping, getEnumRegistry, toSelectOptions } from '@/services/manual/enums';
import {
  IdentityText,
  NoteModal,
  StatusTag,
  personText,
  platformQueryKeys,
} from '../shared';

type ReviewAction = 'approve' | 'reject' | 'manual' | 'revoke';
type ActionState = { row: RealNameInsight; action: ReviewAction } | null;
type RealNameRecord = API.AdminRealNameVerificationRowOut & {
  status__mapping?: string;
  source__mapping?: string;
  provider__mapping?: string;
};
type RealNameDetailRecord = API.RealNameVerificationDetailOut & {
  status__mapping?: string;
  source__mapping?: string;
  provider__mapping?: string;
  logs?: Array<
    API.RealNameLogOut & {
      action__mapping?: string;
    }
  >;
};
type RealNameInsight = RealNameRecord & {
  stage_color: string;
  stage_summary: string;
  governance_hint: string;
  source_summary: string;
  review_summary: string;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

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
  row: RealNameRecord,
): RealNameInsight {
  const sourceSummary = `来源 ${enumMapping(row.source, row.source__mapping || row.source_label)}，当前由 ${enumMapping(row.provider, row.provider__mapping || row.provider_label)} 处理。`;
  const reviewSummary = row.reviewed_at
    ? `${row.reviewed_by || '系统'} 于 ${dayjs(row.reviewed_at).format('YYYY-MM-DD HH:mm')} 给出处理结论。`
    : `记录创建于 ${dayjs(row.created_at).format('YYYY-MM-DD HH:mm')}，当前还没有最终处理时间。`;

  if (row.status === 'verified') {
    return {
      ...row,
      stage_color: 'green',
      stage_summary: '实名已经生效，后续重点转为撤销审慎、资格影响和留痕清晰。',
      governance_hint:
        '已实名记录不能只看“通过了没有”，还要考虑后续撤销是否影响高权限或业务资格。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  if (row.status === 'manual_review') {
    return {
      ...row,
      stage_color: 'gold',
      stage_summary: '自动流程没有完成，当前需要后台明确给出通过或驳回结论。',
      governance_hint:
        '人工复核不该淹没在表格里，它代表的是仍在占用审核带宽的待决事项。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  if (row.status === 'rejected') {
    return {
      ...row,
      stage_color: 'volcano',
      stage_summary:
        '记录已经驳回，后续重点是失败原因是否可解释、是否可能再次回流。',
      governance_hint:
        '驳回不是终点，能否讲清拒绝原因，决定了后续申诉和重提成本。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  if (row.status === 'revoked') {
    return {
      ...row,
      stage_color: 'default',
      stage_summary:
        '实名曾经生效但已被撤销，需要继续确认受影响的权限和业务资格。',
      governance_hint: '撤销实名往往带着更高的业务和合规影响，应该谨慎处理。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  return {
    ...row,
    stage_color: 'blue',
    stage_summary: '记录仍在待校验阶段，优先判断能否自动完成或是否需要转人工。',
    governance_hint:
      '待校验积压过多时，平台侧最容易出现审核排队和业务入口被卡住的问题。',
    source_summary: sourceSummary,
    review_summary: reviewSummary,
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
      guidance:
        row.status === 'rejected'
          ? '这条记录已经被驳回过，重新通过前最好确认失败原因是否已经处理。'
          : '通过后会直接把账号同步到已实名状态，后续资金与权限链路会按实名生效。',
    };
  }
  if (action === 'reject') {
    return {
      label: '驳回实名',
      title: '驳回实名',
      guidance:
        '驳回原因需要给得足够清楚，否则后续申诉和再次提交会把审核链路拖得更长。',
    };
  }
  if (action === 'manual') {
    return {
      label: row.status === 'rejected' ? '转回人工' : '转人工复核',
      title: row.status === 'rejected' ? '转回人工复核' : '转人工复核',
      guidance:
        '转人工意味着这条记录不再等待自动处理，应该由后台明确给出处理结论。',
    };
  }
  return {
    label: '撤销实名',
    title: '撤销实名',
    guidance:
      '撤销会直接影响账号的实名可用状态，尤其要留意它对提现、激励资格和高权限账号的后续影响。',
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
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [actionState, setActionState] = useState<ActionState>(null);
  const [detailId, setDetailId] = useState<number>();
  const [form] = Form.useForm<{ note: string }>();
  const enumQuery = useQuery({
    queryKey: ['enum-registry'],
    queryFn: getEnumRegistry,
  });

  const listQuery = useQuery({
    queryKey: platformQueryKeys.realName(page, keyword, statusFilter),
    queryFn: () =>
      appsAccountsApiListAdminRealNameVerifications({
        page,
        page_size: 10,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      }),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'real-name-detail', detailId],
    queryFn: () =>
      appsAccountsApiGetAdminRealNameVerification({
        verification_id: detailId!,
      }) as Promise<RealNameDetailRecord>,
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
      await listQuery.refetch();
    },
  });

  const insights = useMemo(
    () => (listQuery.data?.items || []).map(buildRealNameInsight),
    [listQuery.data?.items],
  );

  const columns: ColumnsType<RealNameInsight> = [
    {
      title: '用户身份',
      dataIndex: 'user',
      width: 220,
      render: (user) => (
        <IdentityText
          primary={personText(user)}
          secondary={buildUserSecondary(user)}
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
      dataIndex: 'status_label',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.stage_color}>{enumMapping(record.status, record.status__mapping || record.status_label)}</Tag>
          <Typography.Text type="secondary">
            {record.stage_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '来源与处理',
      dataIndex: 'source_label',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Typography.Text>{record.source_summary}</Typography.Text>
          <Typography.Text type="secondary">
            {record.governance_hint}
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
          <Typography.Text>{record.review_summary}</Typography.Text>
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
    <PageContainer title="实名审核" subTitle="处理用户实名状态与审核记录。">
      <Card
        extra={
          <AdminToolbar>
            <Input.Search
              allowClear
              placeholder="按用户名、邮箱、手机号、实名或证件搜索"
              style={toolbarControlStyle}
              onSearch={(value) => {
                setPage(1);
                setKeyword(value.trim());
              }}
            />
            <Select
              allowClear
              placeholder="按实名状态筛选"
              style={toolbarControlStyle}
              options={toSelectOptions(enumQuery.data?.['accounts.real_name_status'])}
              onChange={(value) => {
                setPage(1);
                setStatusFilter(value || undefined);
              }}
            />
            <Button href="/dashboard/super-admin/users">返回用户列表</Button>
          </AdminToolbar>
        }
      >
        <div style={sectionStyle}>
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>实名列表</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginBottom: 0, marginTop: 8 }}
              >
                实名页不该只是审核动作清单，它应该同时解释这条记录处在什么阶段、为什么还没收口，以及它会影响哪些平台链路。
              </Typography.Paragraph>
            </div>
            <Table
              rowKey="id"
              loading={listQuery.isLoading}
              columns={columns}
              dataSource={insights}
              scroll={adminTableScroll}
              pagination={{
                current: listQuery.data?.page || page,
                pageSize: listQuery.data?.page_size || 10,
                total: listQuery.data?.total || 0,
                onChange: setPage,
              }}
            />
          </Space>
        </div>
      </Card>

      <NoteModal
        open={Boolean(actionState)}
        title={currentActionMeta?.title || '实名审核操作'}
        loading={actionMutation.isPending}
        description={currentActionMeta?.guidance}
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
          <Alert
            type="info"
            showIcon
            title="实名详情要同时看来源、处理结论、证件材料和状态流转日志，不能只盯着身份证图片。"
          />
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户">
              {detailQuery.data ? personText(detailQuery.data.user) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              {detailQuery.data ? (
                <StatusTag value={enumMapping(detailQuery.data.status, detailQuery.data.status__mapping || detailQuery.data.status_label)} />
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="真实姓名">
              {detailQuery.data?.real_name ||
                detailQuery.data?.real_name_masked ||
                '-'}
            </Descriptions.Item>
            <Descriptions.Item label="证件号">
              <span style={wrapTextStyle}>
                {detailQuery.data?.id_number ||
                  detailQuery.data?.id_number_masked ||
                  '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="证件图片">
              <Space wrap>
                {((detailQuery.data as any)?.id_card_media || []).map(
                  (item: any) => (
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
                  ),
                )}
                {!((detailQuery.data as any)?.id_card_media || []).length
                  ? '-'
                  : null}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              {detailQuery.data ? enumMapping(detailQuery.data.source, detailQuery.data.source__mapping || detailQuery.data.source_label) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="供应商">
              {detailQuery.data ? enumMapping(detailQuery.data.provider, detailQuery.data.provider__mapping || detailQuery.data.provider_label) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="失败原因">
              {detailQuery.data?.failure_reason || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核备注">
              {detailQuery.data?.review_note || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核人">
              {detailQuery.data?.reviewed_by || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核时间">
              {detailQuery.data?.reviewed_at
                ? dayjs(detailQuery.data.reviewed_at).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="供应商请求 ID">
              <span style={wrapTextStyle}>
                {detailQuery.data?.provider_request_id || '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="供应商结果">
              <Typography.Text code style={codeWrapStyle}>
                {detailQuery.data?.provider_result
                  ? JSON.stringify(detailQuery.data.provider_result)
                  : '-'}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="created_at"
            dataSource={detailQuery.data?.logs || []}
            pagination={false}
            scroll={adminTableScroll}
            columns={[
              {
                title: '动作',
                dataIndex: 'action_label',
                width: 160,
                render: (_value, record: API.RealNameLogOut & { action__mapping?: string }) => enumMapping(record.action, record.action__mapping || record.action_label),
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
