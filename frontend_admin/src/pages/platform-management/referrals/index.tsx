import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, InputNumber, Row, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import { adminTableScroll, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsReferralsApiAdminReferralRecords,
  appsReferralsApiGetReferralConfig,
  appsReferralsApiPatchReferralConfig,
  appsReferralsApiReviewReferralRecord,
} from '@/services/openapi/adminReferrals';
import { platformQueryKeys } from '../shared';

type ReferralInsight = API.ReferralRecordOut & {
  stage_label: string;
  stage_color: string;
  stage_summary: string;
  reward_summary: string;
  action_summary: string;
};

type GovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
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

function formatMoneyYuan(value?: number | null) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

function getDisplayLevelLabel(value?: string) {
  if (value === 'masked_progress') return '脱敏进度';
  return value || '-';
}

function buildReferralInsight(record: API.ReferralRecordOut, config?: API.ReferralRuleConfigOut): ReferralInsight {
  const inviterReward = formatMoneyYuan(config?.inviter_reward_amount);
  const inviteeReward = formatMoneyYuan(config?.invitee_reward_amount);

  if (record.status === 'reward_issued') {
    return {
      ...record,
      stage_label: '已发奖',
      stage_color: 'green',
      stage_summary: '奖励已经发放，后续重点是回看是否存在误发、重复发放或展示口径不一致。',
      reward_summary: `邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
      action_summary: '当前记录已收口',
    };
  }

  if (record.status === 'review_rejected') {
    return {
      ...record,
      stage_label: '审核驳回',
      stage_color: 'volcano',
      stage_summary: '审核已经驳回，后续重点是解释原因和避免重复进入审核队列。',
      reward_summary: `原计划奖励 邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
      action_summary: '驳回后应保留清晰解释',
    };
  }

  if (record.status === 'pending_review' || record.status === 'pending') {
    return {
      ...record,
      stage_label: '待审核',
      stage_color: 'gold',
      stage_summary: '记录仍在待审核阶段，适合作为当前裂变治理的第一优先级。',
      reward_summary: `待发奖励 邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
      action_summary: '需要给出通过或驳回结论',
    };
  }

  return {
    ...record,
    stage_label: '已注册',
    stage_color: 'blue',
    stage_summary: '邀请关系已经形成，但是否触发奖励还要看后续规则与人工审核要求。',
    reward_summary: `当前规则 邀请人 ¥${inviterReward} / 被邀请人 ¥${inviteeReward}`,
    action_summary: config?.requires_manual_review ? '等待进入审核阶段' : '等待自动触发奖励',
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
    queryFn: () => appsReferralsApiAdminReferralRecords({ page, page_size: 10 }),
  });

  React.useEffect(() => {
    if (configQuery.data) {
      form.setFieldsValue(configQuery.data);
    }
  }, [configQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: API.ReferralRuleConfigPatchIn) => appsReferralsApiPatchReferralConfig(payload),
    onSuccess: () => configQuery.refetch(),
  });
  const reviewMutation = useMutation({
    mutationFn: ({ record, approved }: { record: API.ReferralRecordOut; approved: boolean }) => appsReferralsApiReviewReferralRecord({ record_id: record.id }, { approved, remark: '' }),
    onSuccess: () => recordsQuery.refetch(),
  });

  const recordInsights = useMemo(
    () => (recordsQuery.data?.items || []).map((item) => buildReferralInsight(item, configQuery.data)),
    [configQuery.data, recordsQuery.data?.items],
  );
  const pendingReviewCount = recordInsights.filter((item) => item.status === 'pending_review' || item.status === 'pending').length;
  const rejectedCount = recordInsights.filter((item) => item.status === 'review_rejected').length;
  const rewardedCount = recordInsights.filter((item) => item.status === 'reward_issued').length;
  const registeredCount = recordInsights.filter((item) => item.status === 'registered').length;

  const signals = useMemo<GovernanceSignal[]>(
    () => [
      {
        key: 'review',
        title: '审核压力',
        emphasis: pendingReviewCount ? `${pendingReviewCount} 条待审核` : '当前待审核较少',
        summary: pendingReviewCount ? '人工审核会直接决定裂变奖励能否发下去，也是最容易堆积的环节。' : '当前待审核记录较少，审核压力不高。',
        description: '裂变规则页至少要让人知道是否存在排队审核，而不是只给一组开关。',
        actionLabel: '继续处理审核',
        actionHref: '/dashboard/platform-management/referrals',
      },
      {
        key: 'rewarded',
        title: '已发奖记录',
        emphasis: rewardedCount ? `${rewardedCount} 条已发奖` : '当前无发奖记录',
        summary: rewardedCount ? '发奖后的重点是回看是否与当前规则一致，避免错发或重复发。' : '当前还没有进入发奖阶段的记录。',
        description: '已发奖属于真正的资金动作，比普通邀请关系更值得回看。',
        actionLabel: '联动经营视角',
        actionHref: '/dashboard/personal-business/overview',
      },
      {
        key: 'rejected',
        title: '驳回回流',
        emphasis: rejectedCount ? `${rejectedCount} 条审核驳回` : '当前驳回较少',
        summary: rejectedCount ? '驳回记录如果解释不清，后续很容易形成反复申诉或重复提交。' : '当前驳回记录规模较小。',
        description: '平台要清楚知道驳回是不是规则问题、身份问题，还是资料不完整。',
        actionLabel: '查看实名治理',
        actionHref: '/dashboard/platform-management/real-name',
      },
      {
        key: 'registered',
        title: '已注册待转化',
        emphasis: registeredCount ? `${registeredCount} 条已注册待转化` : '当前注册转化较少',
        summary: registeredCount ? '注册并不等于奖励成立，是否进入审核或自动发奖仍取决于当前规则。' : '当前没有明显待转化记录。',
        description: '裂变记录应该讲清“注册关系”和“奖励关系”不是同一层概念。',
        actionLabel: '回看用户治理',
        actionHref: '/dashboard/platform-management/users',
      },
    ],
    [pendingReviewCount, registeredCount, rejectedCount, rewardedCount],
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
          <Typography.Text type="secondary">{record.stage_summary}</Typography.Text>
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
          <Typography.Text type="secondary">{record.action_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 200,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</Typography.Text>
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
              <a onClick={() => void reviewMutation.mutateAsync({ record, approved: true })}>通过</a>
              <a onClick={() => void reviewMutation.mutateAsync({ record, approved: false })}>驳回</a>
            </>
          ) : (
            <Typography.Text type="secondary">已收口</Typography.Text>
          )}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={fullWidthStyle}>
      <Card title="裂变治理">
        <div style={sectionStyle}>
          <Typography.Text strong>规则治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="邀请人奖励" value={formatMoneyYuan(configQuery.data?.inviter_reward_amount)} precision={2} prefix="¥" />
                <Typography.Text type="secondary">当前奖励口径来自空间级裂变规则配置。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="被邀请人奖励" value={formatMoneyYuan(configQuery.data?.invitee_reward_amount)} precision={2} prefix="¥" />
                <Typography.Text type="secondary">奖励对象是否同时覆盖被邀请人，会改变裂变转化预期。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待审核记录" value={pendingReviewCount} />
                <Typography.Text type="secondary">待审核越多，越说明当前裂变奖励链路在人工节点上积压。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="已发奖" value={rewardedCount} />
                <Typography.Text type="secondary">已发奖属于真正的资金动作，应该被单独回看。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前执行面</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>人工审核</Typography.Text>
                    <Tag color={configQuery.data?.requires_manual_review ? 'gold' : 'green'}>
                      {configQuery.data?.requires_manual_review ? '开启中' : '已关闭'}
                    </Tag>
                  </Space>
                  <Typography.Text>人工审核会把裂变奖励从自动结算改成运营承接，更适合高风险或早期阶段的规则治理。</Typography.Text>
                  <a href="/dashboard/platform-management/referrals">继续处理审核</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>邀请入口</Typography.Text>
                    <Tag color={configQuery.data?.allow_link || configQuery.data?.allow_code ? 'blue' : 'default'}>
                      {configQuery.data?.allow_link && configQuery.data?.allow_code ? '链接+邀请码' : configQuery.data?.allow_link ? '仅链接' : configQuery.data?.allow_code ? '仅邀请码' : '当前关闭'}
                    </Tag>
                  </Space>
                  <Typography.Text>裂变入口越多，越需要清楚知道转化来自哪里，否则规则复盘会变得模糊。</Typography.Text>
                  <a href="/dashboard/personal-business/overview">联动经营视角</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>展示口径</Typography.Text>
                    <Tag color="default">{getDisplayLevelLabel(configQuery.data?.display_level)}</Tag>
                  </Space>
                  <Typography.Text>裂变展示口径决定用户侧看到的是完整奖励信息还是脱敏进度，也会影响投诉和预期管理。</Typography.Text>
                  <a href="/dashboard/platform-management/users">回看用户治理</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space direction="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>规则触发条件</Typography.Text>
                    <Tag color="blue">{configQuery.data?.trigger_event || '-'}</Tag>
                  </Space>
                  <Typography.Text>当前规则是在哪个事件点上触发奖励，决定了裂变关系什么时候真正进入资金治理。</Typography.Text>
                  <a href="/dashboard/platform-management/real-name">查看实名认证</a>
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
                  <Space direction="vertical" size={8}>
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
          <Space direction="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>规则配置台</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                裂变规则不只是几组数字和开关，它决定了奖励什么时候发、谁来审核、用户从哪里进入，以及对外展示口径是什么。
              </Typography.Paragraph>
            </div>
            <Alert type="info" showIcon title="当前奖励金额字段仍按分存储，这样能先和后端现有模型对齐；台面上统一按元展示，减少运营误读。" />
            <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
              <Row gutter={16} align="bottom">
                <Col xs={24} md={8}>
                  <Form.Item label="邀请人奖励（分）" name="inviter_reward_amount">
                    <InputNumber min={0} style={fullWidthStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="被邀请人奖励（分）" name="invitee_reward_amount">
                    <InputNumber min={0} style={fullWidthStyle} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="人工审核" name="requires_manual_review" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="链接邀请" name="allow_link" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="邀请码" name="allow_code" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                    保存规则
                  </Button>
                </Col>
              </Row>
            </Form>
          </Space>
        </div>
      </Card>

      <Card title="裂变治理台账">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          记录页不该只是“点通过 / 点驳回”，它至少要解释这条邀请关系处在什么阶段、对应什么奖励口径，以及现在该由谁承接。
        </Typography.Paragraph>
        <Table
          rowKey="id"
          loading={recordsQuery.isLoading}
          columns={columns}
          dataSource={recordInsights}
          scroll={adminTableScroll}
          pagination={{ current: recordsQuery.data?.page || page, pageSize: recordsQuery.data?.page_size || 10, total: recordsQuery.data?.total || 0, onChange: setPage }}
        />
      </Card>
    </Space>
  );
};

export default ReferralsAdminPage;
