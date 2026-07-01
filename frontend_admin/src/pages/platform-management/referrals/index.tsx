import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import {
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsReferralsApiAdminReferralRecords,
  appsReferralsApiGetReferralConfig,
  appsReferralsApiPatchReferralConfig,
  appsReferralsApiReviewReferralRecord,
} from '@/services/openapi/adminReferrals';
import { enumMapping } from '@/services/manual/enums';
import { platformQueryKeys } from '../shared';

type ReferralRecordWithMapping = API.ReferralRecordOut & {
  status__mapping?: string;
};

type ReferralInsight = ReferralRecordWithMapping & {
  stage_label: string;
  stage_color: string;
  stage_summary: string;
  reward_summary: string;
  action_summary: string;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

function formatMoneyYuan(value?: number | null) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

function buildReferralInsight(
  record: ReferralRecordWithMapping,
  config?: API.ReferralRuleConfigOut,
): ReferralInsight {
  const inviterReward = formatMoneyYuan(config?.inviter_reward_amount);
  const inviteeReward = formatMoneyYuan(config?.invitee_reward_amount);
  const stageLabel = enumMapping(record.status, record.status__mapping);

  if (record.status === 'reward_issued') {
    return {
      ...record,
      stage_label: stageLabel,
      stage_color: 'green',
      stage_summary:
        '奖励已经发放，后续重点是回看是否存在误发、重复发放或展示口径不一致。',
      reward_summary: `邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
      action_summary: '当前记录已完成',
    };
  }

  if (record.status === 'review_rejected') {
    return {
      ...record,
      stage_label: stageLabel,
      stage_color: 'volcano',
      stage_summary: '审核已经驳回，后续重点是解释原因和避免重复进入审核队列。',
      reward_summary: `原计划奖励 邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
      action_summary: '驳回后应保留清晰解释',
    };
  }

  if (record.status === 'pending_review' || record.status === 'pending') {
    return {
      ...record,
      stage_label: stageLabel,
      stage_color: 'gold',
      stage_summary: '记录仍在待审核阶段，适合作为当前邀请奖励的第一优先级。',
      reward_summary: `待发奖励 邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
      action_summary: '需要给出通过或驳回结论',
    };
  }

  return {
    ...record,
    stage_label: stageLabel,
    stage_color: 'blue',
    stage_summary:
      '邀请关系已经形成，但是否触发奖励还要看后续规则与人工审核要求。',
    reward_summary: `当前规则 邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
    action_summary: config?.requires_manual_review
      ? '等待进入审核阶段'
      : '等待自动触发奖励',
  };
}

const ReferralsAdminPage: React.FC = () => {
  const [form] = Form.useForm<API.ReferralRuleConfigPatchIn>();
  const [page, setPage] = React.useState(1);

  const configQuery = useQuery({
    queryKey: platformQueryKeys.referralConfig,
    queryFn: () => appsReferralsApiGetReferralConfig(),
  });
  const recordsQuery = useQuery({
    queryKey: platformQueryKeys.referralRecords(page),
    queryFn: () =>
      appsReferralsApiAdminReferralRecords({ page, page_size: 10 }),
  });

  React.useEffect(() => {
    if (configQuery.data) {
      form.setFieldsValue(configQuery.data);
    }
  }, [configQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: API.ReferralRuleConfigPatchIn) =>
      appsReferralsApiPatchReferralConfig(payload),
    onSuccess: () => configQuery.refetch(),
  });
  const reviewMutation = useMutation({
    mutationFn: ({
      record,
      approved,
    }: {
      record: API.ReferralRecordOut;
      approved: boolean;
    }) =>
      appsReferralsApiReviewReferralRecord(
        { record_id: record.id },
        { approved, remark: '' },
      ),
    onSuccess: () => recordsQuery.refetch(),
  });

  const recordInsights = useMemo(
    () =>
      ((recordsQuery.data?.items || []) as ReferralRecordWithMapping[]).map((item) =>
        buildReferralInsight(item, configQuery.data),
      ),
    [configQuery.data, recordsQuery.data?.items],
  );

  const columns: ColumnsType<ReferralInsight> = [
    {
      title: '邀请关系',
      dataIndex: 'invitee_display',
      width: 240,
      render: (_value, record) => (
        <Space direction="vertical" size={4}>
          <Typography.Text>{record.invitee_display}</Typography.Text>
          <Typography.Text type="secondary">{`邀请人 #${record.inviter_id} -> 被邀请人 #${record.invitee_id}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'status',
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={record.stage_color}>{record.stage_label}</Tag>
          <Typography.Text type="secondary">
            {record.stage_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '奖励口径',
      dataIndex: 'reward_summary',
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{record.reward_summary}</Typography.Text>
          <Typography.Text type="secondary">
            {record.action_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 200,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>
            {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
          <Typography.Text type="secondary">{`更新于 ${dayjs(record.updated_at).format('YYYY-MM-DD HH:mm')}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_value, record) => (
        <ResponsiveActions>
          {record.status === 'pending_review' || record.status === 'pending' ? (
            <>
              <a
                onClick={() =>
                  void reviewMutation.mutateAsync({ record, approved: true })
                }
              >
                通过
              </a>
              <a
                onClick={() =>
                  void reviewMutation.mutateAsync({ record, approved: false })
                }
              >
                驳回
              </a>
            </>
          ) : (
            <Typography.Text type="secondary">已完成</Typography.Text>
          )}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="邀请奖励" subTitle="管理邀请规则与奖励记录。">
      <Space direction="vertical" size={16} style={fullWidthStyle}>
        <Card title="邀请奖励规则">
          <div style={sectionStyle}>
            <Space direction="vertical" size={12} style={fullWidthStyle}>
              <div>
                <Typography.Text strong>规则配置台</Typography.Text>
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 0, marginTop: 8 }}
                >
                  邀请奖励规则决定了奖励什么时候发、谁来审核、用户从哪里进入，以及对外展示口径是什么。
                </Typography.Paragraph>
              </div>
              <Alert
                type="info"
                showIcon
                title="当前奖励金额字段仍按分存储，这样能先和后端现有模型对齐；台面上统一按元展示，减少运营误读。"
              />
              <Form
                form={form}
                layout="vertical"
                onFinish={(values) => saveMutation.mutate(values)}
              >
                <Row gutter={16} align="bottom">
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="邀请人奖励（分）"
                      name="inviter_reward_amount"
                    >
                      <InputNumber min={0} style={fullWidthStyle} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="被邀请人奖励（分）"
                      name="invitee_reward_amount"
                    >
                      <InputNumber min={0} style={fullWidthStyle} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Item
                      label="人工审核"
                      name="requires_manual_review"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Item
                      label="链接邀请"
                      name="allow_link"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Item
                      label="邀请码"
                      name="allow_code"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={saveMutation.isPending}
                    >
                      保存规则
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Space>
          </div>
        </Card>

        <Card title="邀请记录">
          <Table
            rowKey="id"
            loading={recordsQuery.isLoading}
            columns={columns}
            dataSource={recordInsights}
            scroll={adminTableScroll}
            pagination={{
              current: recordsQuery.data?.page || page,
              pageSize: recordsQuery.data?.page_size || 10,
              total: recordsQuery.data?.total || 0,
              onChange: setPage,
            }}
          />
        </Card>
      </Space>
    </PageContainer>
  );
};

export default ReferralsAdminPage;
