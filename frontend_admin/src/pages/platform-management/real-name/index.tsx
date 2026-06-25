import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Drawer, Form, Image, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
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
import { IdentityText, NoteModal, StatusTag, personText, platformQueryKeys } from '../shared';

type ReviewAction = 'approve' | 'reject' | 'manual' | 'revoke';
type ActionState = { row: RealNameInsight; action: ReviewAction } | null;
type GovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

type RealNameInsight = API.AdminRealNameVerificationRowOut & {
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

const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

const statusOptions = [
  { label: '待校验', value: 'pending' },
  { label: '人工复核', value: 'manual_review' },
  { label: '已实名', value: 'verified' },
  { label: '已驳回', value: 'rejected' },
  { label: '已撤销', value: 'revoked' },
];

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

function buildRealNameInsight(row: API.AdminRealNameVerificationRowOut): RealNameInsight {
  const sourceSummary = `来源 ${row.source_label}，当前由 ${row.provider_label} 承接。`;
  const reviewSummary = row.reviewed_at
    ? `${row.reviewed_by || '系统'} 于 ${dayjs(row.reviewed_at).format('YYYY-MM-DD HH:mm')} 给出处理结论。`
    : `记录创建于 ${dayjs(row.created_at).format('YYYY-MM-DD HH:mm')}，当前还没有最终处理时间。`;

  if (row.status === 'verified') {
    return {
      ...row,
      stage_color: 'green',
      stage_summary: '实名已经生效，治理重点转为撤销审慎、资格影响和留痕清晰。',
      governance_hint: '已实名记录不能只看“通过了没有”，还要考虑后续撤销是否影响高权限或经营资格。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  if (row.status === 'manual_review') {
    return {
      ...row,
      stage_color: 'gold',
      stage_summary: '自动链路没有完全收口，当前需要后台明确给出通过或驳回结论。',
      governance_hint: '人工复核不该淹没在表格里，它代表的是仍在占用审核带宽的待决事项。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  if (row.status === 'rejected') {
    return {
      ...row,
      stage_color: 'volcano',
      stage_summary: '记录已经驳回，后续重点是失败原因是否可解释、是否可能再次回流。',
      governance_hint: '驳回不是终点，能否讲清拒绝原因，决定了后续申诉和重提成本。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  if (row.status === 'revoked') {
    return {
      ...row,
      stage_color: 'default',
      stage_summary: '实名曾经生效但已被撤销，需要继续确认受影响的权限和业务资格。',
      governance_hint: '撤销实名往往带着更高的经营和合规影响，应该谨慎处理。',
      source_summary: sourceSummary,
      review_summary: reviewSummary,
    };
  }

  return {
    ...row,
    stage_color: 'blue',
    stage_summary: '记录仍在待校验阶段，优先判断能否自动收口或是否需要转人工。',
    governance_hint: '待校验积压过多时，平台侧最容易出现审核排队和业务入口被卡住的问题。',
    source_summary: sourceSummary,
    review_summary: reviewSummary,
  };
}

function getIdCardSideLabel(side?: string) {
  return side === 'front' ? '身份证人像面' : side === 'back' ? '身份证国徽面' : '证件图片';
}

function getActionMeta(action: ReviewAction, row: RealNameInsight) {
  if (action === 'approve') {
    return {
      label: row.status === 'rejected' ? '重新通过' : '通过实名',
      title: row.status === 'rejected' ? '重新通过实名' : '通过实名',
      guidance: row.status === 'rejected' ? '这条记录已经被驳回过，重新通过前最好确认失败原因是否已经被消化。' : '通过后会直接把账号同步到已实名状态，后续资金与权限链路会按实名生效。',
    };
  }
  if (action === 'reject') {
    return {
      label: '驳回实名',
      title: '驳回实名',
      guidance: '驳回原因需要给得足够清楚，否则后续申诉和再次提交会把审核链路拖得更长。',
    };
  }
  if (action === 'manual') {
    return {
      label: row.status === 'rejected' ? '转回人工' : '转人工复核',
      title: row.status === 'rejected' ? '转回人工复核' : '转人工复核',
      guidance: '转人工意味着这条记录不再期待自动收口，应该由后台明确接住并给出处理结论。',
    };
  }
  return {
    label: '撤销实名',
    title: '撤销实名',
    guidance: '撤销会直接影响账号的实名可用状态，尤其要留意它对提现、激励资格和高权限账号的后续影响。',
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

  const listQuery = useQuery({
    queryKey: platformQueryKeys.realName(page, keyword, statusFilter),
    queryFn: () =>
      appsAccountsApiListAdminRealNameVerifications({
        page,
        page_size: 10,
        q: keyword || undefined,
        status: statusFilter || undefined,
      }),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'real-name-detail', detailId],
    queryFn: () => appsAccountsApiGetAdminRealNameVerification({ verification_id: detailId! }),
    enabled: Boolean(detailId),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ row, action, note }: { row: RealNameInsight; action: ReviewAction; note: string }) => {
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

  const insights = useMemo(() => (listQuery.data?.items || []).map(buildRealNameInsight), [listQuery.data?.items]);
  const pendingRows = insights.filter((item) => item.status === 'pending');
  const manualRows = insights.filter((item) => item.status === 'manual_review');
  const rejectedRows = insights.filter((item) => item.status === 'rejected');
  const verifiedRows = insights.filter((item) => item.status === 'verified');
  const revokedRows = insights.filter((item) => item.status === 'revoked');
  const businessGateRows = insights.filter((item) => item.source === 'business_gate');

  const signals = useMemo<GovernanceSignal[]>(
    () => [
      {
        key: 'pending',
        title: '待处理积压',
        emphasis: pendingRows.length || manualRows.length ? `${pendingRows.length + manualRows.length} 条待决记录` : '当前无待决积压',
        summary: pendingRows.length || manualRows.length ? '待校验与人工复核共同构成当前审核带宽压力。' : '当前待决记录较少，审核链路相对平稳。',
        description: '实名审核不该只是点通过或驳回，更重要的是知道审核队列是否正在堆积。',
        actionLabel: '继续处理审核',
        actionHref: '/dashboard/platform-management/real-name',
      },
      {
        key: 'rejected',
        title: '驳回回流',
        emphasis: rejectedRows.length ? `${rejectedRows.length} 条驳回待回看` : '驳回规模可控',
        summary: rejectedRows.length ? '驳回记录越多，越需要解释性强的失败原因和人工承接策略。' : '当前驳回记录规模较小，回流压力不高。',
        description: '如果失败原因说不清，驳回很容易演变成重复提交和客服压力。',
        actionLabel: '查看用户治理',
        actionHref: '/dashboard/platform-management/users',
      },
      {
        key: 'verified',
        title: '生效实名',
        emphasis: verifiedRows.length ? `${verifiedRows.length} 条已实名记录` : '暂无生效实名',
        summary: verifiedRows.length ? '生效实名会影响提现、激励和权限等下游链路。' : '当前还没有进入已实名阶段的记录。',
        description: '已实名并不代表可以完全忽略，撤销与回收动作的风险反而更高。',
        actionLabel: '查看高权限账号',
        actionHref: '/dashboard/platform-management/users',
      },
      {
        key: 'business_gate',
        title: '业务拦截',
        emphasis: businessGateRows.length ? `${businessGateRows.length} 条业务拦截触发` : '当前少见业务拦截',
        summary: businessGateRows.length ? '这类记录通常和经营动作绑定更紧，审核延迟会直接影响业务继续推进。' : '当前没有明显的业务拦截积压。',
        description: '平台要分得清是用户主动来做实名，还是业务场景把实名逼成了前置条件。',
        actionLabel: '返回经营视角',
        actionHref: '/dashboard/personal-business/overview',
      },
    ],
    [businessGateRows.length, manualRows.length, pendingRows.length, rejectedRows.length, verifiedRows.length],
  );

  const columns: ColumnsType<RealNameInsight> = [
    {
      title: '用户身份',
      dataIndex: 'user',
      width: 220,
      render: (user) => <IdentityText primary={personText(user)} secondary={buildUserSecondary(user)} />,
    },
    {
      title: '实名主体',
      dataIndex: 'real_name_masked',
      width: 220,
      render: (_value, record) => <IdentityText primary={record.real_name_masked} secondary={record.id_number_masked} />,
    },
    {
      title: '审核阶段',
      dataIndex: 'status_label',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.stage_color}>{record.status_label}</Tag>
          <Typography.Text type="secondary">{record.stage_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '来源与承接',
      dataIndex: 'source_label',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Typography.Text>{record.source_summary}</Typography.Text>
          <Typography.Text type="secondary">{record.governance_hint}</Typography.Text>
          {record.failure_reason || record.review_note ? <Typography.Text type="secondary">{record.failure_reason || record.review_note}</Typography.Text> : null}
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
            <a key={action} onClick={() => setActionState({ row: record, action })}>
              {getActionMeta(action, record).label}
            </a>
          ))}
        </ResponsiveActions>
      ),
    },
  ];

  const currentActionMeta = actionState ? getActionMeta(actionState.action, actionState.row) : null;

  return (
    <>
      <Card
        title="实名审核"
        extra={(
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
              options={statusOptions}
              onChange={(value) => {
                setPage(1);
                setStatusFilter(value || undefined);
              }}
            />
            <Button href="/dashboard/platform-management/users">返回用户治理</Button>
          </AdminToolbar>
        )}
      >
        <div style={sectionStyle}>
          <Typography.Text strong>实名治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前记录" value={insights.length} />
                <Typography.Text type="secondary">当前页纳入审核治理视角的实名记录总量。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待处理" value={pendingRows.length + manualRows.length} />
                <Typography.Text type="secondary">待校验与人工复核会直接占用平台审核带宽。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="已驳回" value={rejectedRows.length} />
                <Typography.Text type="secondary">驳回记录越多，越需要解释性清楚的失败原因。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="已生效实名" value={verifiedRows.length} />
                <Typography.Text type="secondary">这些记录会影响提现、激励与下游资格链路。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前审核执行面</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>待校验记录</Typography.Text>
                    <Tag color={pendingRows.length ? 'blue' : 'default'}>{pendingRows.length ? `${pendingRows.length} 条待判断` : '当前不拥堵'}</Tag>
                  </Space>
                  <Typography.Text>这里对应的是仍未收口的自动校验队列，平台需要判断是继续等待还是转人工。</Typography.Text>
                  <a href="/dashboard/platform-management/real-name">继续审核</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>人工复核</Typography.Text>
                    <Tag color={manualRows.length ? 'gold' : 'default'}>{manualRows.length ? `${manualRows.length} 条待给结论` : '人工压力较小'}</Tag>
                  </Space>
                  <Typography.Text>人工复核代表自动链路没有讲清楚，后台必须明确给出通过或驳回的判断。</Typography.Text>
                  <a href="/dashboard/platform-management/real-name">查看复核台账</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>驳回回流</Typography.Text>
                    <Tag color={rejectedRows.length ? 'volcano' : 'green'}>{rejectedRows.length ? `${rejectedRows.length} 条待解释` : '当前较稳定'}</Tag>
                  </Space>
                  <Typography.Text>驳回记录如果没有足够清楚的失败原因，后续很容易变成重复提交和客服压力。</Typography.Text>
                  <a href="/dashboard/platform-management/users">联动用户治理</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>撤销与回收</Typography.Text>
                    <Tag color={revokedRows.length ? 'default' : 'green'}>{revokedRows.length ? `${revokedRows.length} 条已撤销` : '暂无撤销记录'}</Tag>
                  </Space>
                  <Typography.Text>实名撤销通常会连带影响经营资格和高权限账号治理，应该尽量留好原因与审计痕迹。</Typography.Text>
                  <a href="/dashboard/platform-management/users">查看账号承接</a>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {signals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8}>
                    <Typography.Text strong>{signal.title}</Typography.Text>
                    <Tag color="blue">{signal.emphasis}</Tag>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    <a href={signal.actionHref}>{signal.actionLabel}</a>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>实名治理台账</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
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
          if (actionState) await actionMutation.mutateAsync({ row: actionState.row, action: actionState.action, note: values.note || '' });
        }}
      />

      <Drawer title="实名详情" open={Boolean(detailId)} onClose={() => setDetailId(undefined)} width={drawerWidthLg}>
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <Alert type="info" showIcon title="实名详情要同时看来源、处理结论、证件材料和状态流转日志，不能只盯着身份证图片。" />
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户">{detailQuery.data ? personText(detailQuery.data.user) : '-'}</Descriptions.Item>
            <Descriptions.Item label="当前状态">{detailQuery.data ? <StatusTag value={detailQuery.data.status_label} /> : '-'}</Descriptions.Item>
            <Descriptions.Item label="真实姓名">{detailQuery.data?.real_name || detailQuery.data?.real_name_masked || '-'}</Descriptions.Item>
            <Descriptions.Item label="证件号"><span style={wrapTextStyle}>{detailQuery.data?.id_number || detailQuery.data?.id_number_masked || '-'}</span></Descriptions.Item>
            <Descriptions.Item label="证件图片">
              <Space wrap>
                {((detailQuery.data as any)?.id_card_media || []).map((item: any) => (
                  <Space key={item.media_id} orientation="vertical" size={4}>
                    <Typography.Text>{getIdCardSideLabel(item.side)}</Typography.Text>
                    <Image alt={getIdCardSideLabel(item.side)} src={item.url} width={180} />
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
              <Typography.Text code style={codeWrapStyle}>
                {detailQuery.data?.provider_result ? JSON.stringify(detailQuery.data.provider_result) : '-'}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="created_at"
            dataSource={detailQuery.data?.logs || []}
            pagination={false}
            scroll={adminTableScroll}
            columns={[
              { title: '动作', dataIndex: 'action_label', width: 160 },
              { title: '备注', dataIndex: 'note', width: 280, render: (value) => <span style={wrapTextStyle}>{value || '-'}</span> },
              { title: '时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
            ]}
          />
        </Space>
      </Drawer>
    </>
  );
};

export default RealNameAdminPage;
