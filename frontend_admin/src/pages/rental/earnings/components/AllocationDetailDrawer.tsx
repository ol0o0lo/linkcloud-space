import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Table,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { drawerWidthXl } from '@/pages/_shared/adminLayout';
import {
  type AllocationCapabilities,
  type AllocationRequest,
  allocationApi,
} from '@/services/manual/allocation';
import type { LeaseOut } from '@/services/manual/house';
import { moneyText } from '../../constants';

export type AllocationDetailTarget = {
  lease?: LeaseOut;
  request: AllocationRequest;
};

type ReasonValues = { reason: string };

type AllocationDetailDrawerProps = {
  capabilities?: AllocationCapabilities;
  onChanged: (request: AllocationRequest) => void;
  onClose: () => void;
  open: boolean;
  target?: AllocationDetailTarget;
};

function sourceHouseText(request: AllocationRequest) {
  const house = request.source_snapshot.house;
  if (!house) return '-';
  return [house.estate_name, house.building_name, house.room_number]
    .filter(Boolean)
    .join(' / ');
}

function distributionRuleText(request: AllocationRequest) {
  if (request.distribution_method === 'percentage') {
    return `计算基数 × ${Number(request.distribution_rate_bp || 0) / 100}%`;
  }
  return `固定金额 ${moneyText(request.distributable_amount)}`;
}

const AllocationDetailDrawer: React.FC<AllocationDetailDrawerProps> = ({
  capabilities,
  onChanged,
  onClose,
  open,
  target,
}) => {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [rejectForm] = Form.useForm<ReasonValues>();
  const [voidForm] = Form.useForm<ReasonValues>();
  const allocationRequest = target?.request;
  const leaseId =
    target?.lease?.id || allocationRequest?.source_snapshot.lease_id;

  const reviewMutation = useMutation({
    mutationFn: (data: { decision: 'approve' | 'reject'; reason?: string }) => {
      if (!leaseId) throw new Error('未找到来源租约');
      return allocationApi.reviewLeaseAllocation(leaseId, data);
    },
    onSuccess: (nextRequest, variables) => {
      message.success(
        variables.decision === 'approve'
          ? '收益分配申请已通过'
          : '收益分配申请已驳回',
      );
      setRejectOpen(false);
      rejectForm.resetFields();
      onChanged(nextRequest);
    },
  });

  const voidMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!leaseId) throw new Error('未找到来源租约');
      return allocationApi.voidLeaseAllocation(leaseId, reason);
    },
    onSuccess: (nextRequest) => {
      message.success('申请已作废，冲销流水已经生成');
      setVoidOpen(false);
      voidForm.resetFields();
      onChanged(nextRequest);
    },
  });

  const footer = allocationRequest ? (
    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
      <Button onClick={onClose}>关闭</Button>
      {allocationRequest.status === 'pending' && capabilities?.review ? (
        <>
          <Button danger onClick={() => setRejectOpen(true)}>
            驳回
          </Button>
          <Popconfirm
            title="确认通过这份收益分配申请？"
            description="通过后会立即按提交时间生成员工收益流水。"
            okText="确认通过"
            cancelText="取消"
            onConfirm={() => reviewMutation.mutate({ decision: 'approve' })}
          >
            <Button type="primary" loading={reviewMutation.isPending}>
              通过
            </Button>
          </Popconfirm>
        </>
      ) : null}
      {allocationRequest.status === 'approved' && capabilities?.void ? (
        <Button danger onClick={() => setVoidOpen(true)}>
          作废并冲销
        </Button>
      ) : null}
    </Space>
  ) : null;

  return (
    <>
      <Drawer
        title={
          allocationRequest ? (
            <Space>
              <span>收益分配申请 #{allocationRequest.id}</span>
              <AppStatusTag
                name="allocation-request"
                state={allocationRequest.status}
              >
                {allocationRequest.status__mapping}
              </AppStatusTag>
            </Space>
          ) : (
            '收益分配申请'
          )
        }
        open={open}
        size={drawerWidthXl}
        onClose={onClose}
        footer={footer}
        destroyOnHidden
      >
        {allocationRequest ? (
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, md: 2 }}
              title="签约摘要"
              items={[
                {
                  key: 'house',
                  label: '房源',
                  children: sourceHouseText(allocationRequest),
                },
                {
                  key: 'tenant',
                  label: '租客',
                  children:
                    target?.lease?.tenant?.name ||
                    allocationRequest.source_snapshot.tenant?.name ||
                    '-',
                },
                {
                  key: 'period',
                  label: '租期',
                  children: `${allocationRequest.source_snapshot.start_date || '-'} 至 ${allocationRequest.source_snapshot.end_date || '-'}`,
                },
                {
                  key: 'rent',
                  label: '月租',
                  children: moneyText(
                    target?.lease?.monthly_rent ||
                      allocationRequest.source_snapshot.monthly_rent,
                  ),
                },
                {
                  key: 'team',
                  label: '归属团队',
                  children: allocationRequest.team_name_snapshot || '空间',
                },
                {
                  key: 'rule-source',
                  label: '规则来源',
                  children: allocationRequest.rule_source__mapping,
                },
              ]}
            />

            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, md: 2 }}
              title="收益计算"
              items={[
                {
                  key: 'basis',
                  label: '计算基数',
                  children: moneyText(allocationRequest.basis_amount),
                },
                {
                  key: 'rule',
                  label: '计算规则',
                  children: distributionRuleText(allocationRequest),
                },
                {
                  key: 'distributable',
                  label: '可分配收益',
                  children: (
                    <Typography.Text strong>
                      {moneyText(allocationRequest.distributable_amount)}
                    </Typography.Text>
                  ),
                },
                {
                  key: 'currency',
                  label: '币种',
                  children: allocationRequest.currency,
                },
              ]}
            />

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              title={() => '系统计算依据'}
              dataSource={allocationRequest.items}
              columns={[
                { title: '项目', dataIndex: 'name' },
                { title: '方向', dataIndex: 'effect__mapping', width: 90 },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  align: 'right',
                  render: (value) => moneyText(value),
                },
                {
                  title: '备注',
                  dataIndex: 'remark',
                  render: (value) => value || '-',
                },
              ]}
            />

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              title={() => '受益人分配'}
              dataSource={allocationRequest.shares}
              columns={[
                { title: '受益人', dataIndex: 'beneficiary_name_snapshot' },
                {
                  title: '权重',
                  dataIndex: 'weight_bp',
                  align: 'right',
                  render: (value) => `${Number(value) / 100}%`,
                },
                {
                  title: '归属基数',
                  dataIndex: 'attributed_basis_amount',
                  align: 'right',
                  render: (value) => moneyText(value),
                },
                {
                  title: '最终收益',
                  dataIndex: 'allocated_amount',
                  align: 'right',
                  render: (value) => moneyText(value),
                },
              ]}
            />

            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, md: 2 }}
              title="申请与审核记录"
              items={[
                {
                  key: 'submitter',
                  label: '申请人',
                  children: allocationRequest.submitted_by_name_snapshot,
                },
                {
                  key: 'submitted-at',
                  label: '提交时间',
                  children: dayjs(allocationRequest.submitted_at).format(
                    'YYYY-MM-DD HH:mm',
                  ),
                },
                {
                  key: 'expires-at',
                  label: '审核截止',
                  children: dayjs(allocationRequest.expires_at).format(
                    'YYYY-MM-DD HH:mm',
                  ),
                },
                {
                  key: 'reviewer',
                  label: '审核人',
                  children: allocationRequest.reviewed_by_name_snapshot || '-',
                },
                {
                  key: 'reviewed-at',
                  label: '审核时间',
                  children: allocationRequest.reviewed_at
                    ? dayjs(allocationRequest.reviewed_at).format(
                        'YYYY-MM-DD HH:mm',
                      )
                    : '-',
                },
                {
                  key: 'rejection',
                  label: '驳回原因',
                  children: allocationRequest.rejection_reason || '-',
                  span: 'filled',
                },
                {
                  key: 'voided',
                  label: '作废信息',
                  children: allocationRequest.voided_at
                    ? `${allocationRequest.voided_by_name_snapshot} 于 ${dayjs(allocationRequest.voided_at).format('YYYY-MM-DD HH:mm')} 作废：${allocationRequest.void_reason}`
                    : '-',
                  span: 'filled',
                },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="驳回收益分配申请"
        open={rejectOpen}
        confirmLoading={reviewMutation.isPending}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        destroyOnHidden
      >
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={(values) =>
            reviewMutation.mutate({
              decision: 'reject',
              reason: values.reason,
            })
          }
        >
          <Form.Item
            label="驳回原因"
            name="reason"
            rules={[
              { required: true, whitespace: true, message: '请填写驳回原因' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="作废已生效收益"
        open={voidOpen}
        confirmLoading={voidMutation.isPending}
        okText="确认作废并冲销"
        okButtonProps={{ danger: true }}
        onCancel={() => setVoidOpen(false)}
        onOk={() => voidForm.submit()}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          已生成的收益流水不会删除，系统会在当前月份追加等额负数冲销流水。
        </Typography.Paragraph>
        <Form
          form={voidForm}
          layout="vertical"
          onFinish={(values) => voidMutation.mutate(values.reason)}
        >
          <Form.Item
            label="作废原因"
            name="reason"
            rules={[
              { required: true, whitespace: true, message: '请填写作废原因' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AllocationDetailDrawer;
