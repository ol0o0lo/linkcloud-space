import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Form, InputNumber, Row, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import { adminTableScroll, fullWidthStyle, ResponsiveActions } from '@/pages/_shared/adminLayout';
import {
  appsReferralsApiAdminReferralRecords,
  appsReferralsApiGetReferralConfig,
  appsReferralsApiPatchReferralConfig,
  appsReferralsApiReviewReferralRecord,
} from '@/services/openapi/adminReferrals';
import { StatusTag, platformQueryKeys } from '../shared';

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

  const columns: ColumnsType<API.ReferralRecordOut> = [
    { title: '邀请人', dataIndex: 'inviter_id', width: 140, render: (value) => `用户 #${value}` },
    { title: '被邀请人', dataIndex: 'invitee_display', width: 180 },
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <StatusTag value={value} /> },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 120,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => void reviewMutation.mutateAsync({ record, approved: true })}>通过</a>
          <a onClick={() => void reviewMutation.mutateAsync({ record, approved: false })}>驳回</a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Card title={configQuery.data?.name || '裂变规则'}>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Row gutter={16} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item label="邀请人奖励" name="inviter_reward_amount">
                <InputNumber min={0} style={fullWidthStyle} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="被邀请人奖励" name="invitee_reward_amount">
                <InputNumber min={0} style={fullWidthStyle} />
              </Form.Item>
            </Col>
            <Col xs={8} md={3}>
              <Form.Item label="人工审核" name="requires_manual_review" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={8} md={3}>
              <Form.Item label="链接邀请" name="allow_link" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={8} md={2}>
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
      </Card>
      <Card title="邀请记录">
        <Table
          rowKey="id"
          loading={recordsQuery.isLoading}
          columns={columns}
          dataSource={recordsQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{ current: recordsQuery.data?.page || page, pageSize: recordsQuery.data?.page_size || 10, total: recordsQuery.data?.total || 0, onChange: setPage }}
        />
      </Card>
    </Space>
  );
};

export default ReferralsAdminPage;
