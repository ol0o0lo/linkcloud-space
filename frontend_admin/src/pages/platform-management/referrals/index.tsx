import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useRef } from 'react';
import {
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import { enumMapping } from '@/services/manual/enums';
import {
  appsReferralsApiAdminReferralRecords,
  appsReferralsApiGetReferralConfig,
  appsReferralsApiPatchReferralConfig,
  appsReferralsApiReviewReferralRecord,
} from '@/services/openapi/adminReferrals';
import { platformQueryKeys } from '../shared';

type ReferralRecordWithMapping = API.ReferralRecordOut & {
  status__mapping?: string;
};

type ReferralInsight = ReferralRecordWithMapping & {
  stage_label: string;
  stage_color: string;
};
type TablePageParams = {
  current?: number;
  pageSize?: number;
};

const compactSwitchStyle: React.CSSProperties = {
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
};

function buildReferralInsight(
  record: ReferralRecordWithMapping,
): ReferralInsight {
  const stageLabel = enumMapping(record.status, record.status__mapping);

  if (record.status === 'reward_issued') {
    return {
      ...record,
      stage_label: stageLabel,
      stage_color: 'green',
    };
  }

  if (record.status === 'review_rejected') {
    return {
      ...record,
      stage_label: stageLabel,
      stage_color: 'volcano',
    };
  }

  if (record.status === 'pending_review' || record.status === 'pending') {
    return {
      ...record,
      stage_label: stageLabel,
      stage_color: 'gold',
    };
  }

  return {
    ...record,
    stage_label: stageLabel,
    stage_color: 'blue',
  };
}

const ReferralsAdminPage: React.FC = () => {
  const [form] = Form.useForm<API.ReferralRuleConfigPatchIn>();
  const tableActionRef = useRef<ActionType>(null);

  const configQuery = useQuery({
    queryKey: platformQueryKeys.referralConfig,
    queryFn: () => appsReferralsApiGetReferralConfig(),
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
    onSuccess: () => tableActionRef.current?.reload(),
  });

  const columns: ProColumns<ReferralInsight>[] = [
    {
      title: '邀请关系',
      dataIndex: 'invitee_display',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{record.invitee_display}</Typography.Text>
          <Typography.Text type="secondary">{`邀请人 #${record.inviter_id} -> 被邀请人 #${record.invitee_id}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'status',
      width: 140,
      render: (_value, record) => (
        <Tag color={record.stage_color}>{record.stage_label}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 200,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
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
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card title="邀请奖励规则">
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => saveMutation.mutate(values)}
          >
            <Row gutter={[16, 12]} align="bottom">
              <Col xs={24} md={8} xl={6}>
                <Form.Item
                  label="邀请人奖励（分）"
                  name="inviter_reward_amount"
                >
                  <InputNumber min={0} style={fullWidthStyle} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8} xl={6}>
                <Form.Item
                  label="被邀请人奖励（分）"
                  name="invitee_reward_amount"
                >
                  <InputNumber min={0} style={fullWidthStyle} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={4} xl={3}>
                <Form.Item
                  label="人工审核"
                  name="requires_manual_review"
                  valuePropName="checked"
                >
                  <div style={compactSwitchStyle}>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={4} xl={3}>
                <Form.Item
                  label="链接邀请"
                  name="allow_link"
                  valuePropName="checked"
                >
                  <div style={compactSwitchStyle}>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={4} xl={3}>
                <Form.Item
                  label="邀请码"
                  name="allow_code"
                  valuePropName="checked"
                >
                  <div style={compactSwitchStyle}>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8} xl={3}>
                <Form.Item label=" ">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saveMutation.isPending}
                    style={fullWidthStyle}
                  >
                    保存规则
                  </Button>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <ProTable<ReferralInsight>
          actionRef={tableActionRef}
          rowKey="id"
          headerTitle="邀请记录"
          columns={columns}
          request={async (params: TablePageParams) => {
            const result = await appsReferralsApiAdminReferralRecords({
              page: params.current || 1,
              page_size: params.pageSize || 10,
            });
            return {
              data: ((result.items || []) as ReferralRecordWithMapping[]).map(
                (item) => buildReferralInsight(item),
              ),
              total: result.total || 0,
              success: true,
            };
          }}
          search={false}
          options={{ density: true, reload: false, setting: true }}
          scroll={adminTableScroll}
          pagination={{ defaultPageSize: 10 }}
        />
      </Space>
    </PageContainer>
  );
};

export default ReferralsAdminPage;
