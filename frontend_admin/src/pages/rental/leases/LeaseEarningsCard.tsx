import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  message,
  Select,
  Space,
  Typography,
} from 'antd';
import React, { useRef, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { useTenantWorkspace } from '@/pages/space/shared';
import { allocationApi } from '@/services/manual/allocation';
import type { LeaseOut } from '@/services/manual/house';
import { moneyText } from '../constants';

type Mode = 'initial' | 'resubmit' | 'correction';
type Values = { beneficiary_user_ids: number[]; reason?: string };

export default function LeaseEarningsCard({ lease }: { lease: LeaseOut }) {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const { initialState } = useModel('@@initialState');
  const [mode, setMode] = useState<Mode>('initial');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<Values>();
  const requestId = useRef('');
  const key = [
    'allocation',
    'lease-history',
    workspace.selectedOrgSlug,
    lease.id,
  ];
  const history = useQuery({
    queryKey: key,
    queryFn: () => allocationApi.listLeaseHistory(lease.id),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const capabilities = useQuery({
    queryKey: ['allocation', 'capabilities', workspace.selectedOrgSlug],
    queryFn: allocationApi.getCapabilities,
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const latest = history.data?.items[0]?.allocation_request;
  const members = useQuery({
    queryKey: ['allocation', 'beneficiaries', workspace.selectedOrgSlug],
    queryFn: () => allocationApi.listBeneficiaries({ page: 1, page_size: 100 }),
    enabled:
      open &&
      mode !== 'resubmit' &&
      Boolean(capabilities.data?.change_beneficiaries),
  });
  const preview = useQuery({
    queryKey: [
      'allocation',
      'lease-preview',
      workspace.selectedOrgSlug,
      lease.id,
      mode,
      latest?.id,
    ],
    queryFn: () =>
      allocationApi.previewLeaseAllocation(lease.id, {
        mode: mode === 'correction' ? 'correction' : 'initial',
        previous_request_id: latest?.id,
      }),
    enabled: open && mode !== 'resubmit',
    staleTime: 0,
  });
  const me = initialState?.currentUser;
  const memberOptions = new Map<number, string>();
  if (me) memberOptions.set(me.id, me.username || '本人');
  for (const share of latest?.shares || [])
    memberOptions.set(
      share.beneficiary_user_id,
      share.beneficiary_name_snapshot,
    );
  for (const member of members.data?.items || [])
    memberOptions.set(member.user_id, member.name);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['allocation'] }),
      queryClient.invalidateQueries({ queryKey: ['house', 'leases'] }),
    ]);
  const submit = useMutation({
    mutationFn: (values: Values) =>
      allocationApi.submitLeaseAllocation(lease.id, {
        mode,
        previous_request_id: latest?.id,
        client_request_id: requestId.current,
        ...(mode !== 'resubmit'
          ? { beneficiary_user_ids: values.beneficiary_user_ids }
          : {}),
        reason: values.reason?.trim(),
        preview_hash:
          mode === 'resubmit' ? undefined : preview.data?.preview_hash,
      }),
    onSuccess: async () => {
      setOpen(false);
      message.success('收益申请已提交，原租约保持有效');
      await refresh();
    },
  });
  const withdraw = useMutation({
    mutationFn: () => {
      if (!latest) throw new Error('未找到收益申请');
      return allocationApi.withdrawLeaseAllocation(lease.id, latest.id);
    },
    onSuccess: async () => {
      message.success('收益申请已撤回，可修改资料后重提');
      await refresh();
    },
  });
  const openEditor = (next: Mode) => {
    setMode(next);
    requestId.current = `earning-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    form.setFieldsValue({
      beneficiary_user_ids:
        latest?.shares.map((share) => share.beneficiary_user_id) ||
        (me ? [me.id] : []),
      reason: '',
    });
    setOpen(true);
  };
  const canApply =
    capabilities.data?.submit &&
    lease.can_maintain !== false &&
    lease.status !== 'terminated' &&
    (!latest ||
      ['rejected', 'expired', 'withdrawn', 'voided'].includes(latest.status));

  return (
    <Card
      size="small"
      title="收益申请"
      loading={history.isLoading || capabilities.isLoading}
    >
      {history.isError || capabilities.isError ? (
        <Alert
          type="error"
          showIcon
          title="收益申请加载失败"
          action={
            <Button
              onClick={() => {
                void history.refetch();
                void capabilities.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      ) : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>
            {latest
              ? `当前申请 #${latest.id} · ${latest.status__mapping} · ${moneyText(latest.distributable_amount)}`
              : '租约已登记，收益待申请。'}
          </Typography.Text>
          {latest?.rejection_reason ? (
            <Alert type="warning" title={latest.rejection_reason} />
          ) : null}
          <Space wrap>
            {canApply && !latest ? (
              <Button type="primary" onClick={() => openEditor('initial')}>
                申请收益
              </Button>
            ) : null}
            {canApply && latest ? (
              <>
                <Button
                  disabled={latest.status === 'voided'}
                  onClick={() => openEditor('resubmit')}
                >
                  按原方案重提
                </Button>
                <Button onClick={() => openEditor('correction')}>
                  纠错重提
                </Button>
              </>
            ) : null}
            {latest?.status === 'pending' &&
            latest.submitted_by_id === me?.id ? (
              <Button
                loading={withdraw.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: '撤回本笔收益申请？',
                    content: '撤回后可以修改资料再申请，租约保持有效。',
                    onOk: () => withdraw.mutateAsync(),
                  })
                }
              >
                撤回并修改资料
              </Button>
            ) : null}
            {latest ? (
              <Button
                type="link"
                href={`/dashboard/rental/earnings?tab=reviews&request=${latest.id}`}
              >
                查看与审核申请
              </Button>
            ) : null}
          </Space>
          {latest?.status === 'approved' ? (
            <Alert
              type="info"
              title="纠错前需先由财务作废并冲销当前申请，再修改成交资料并重提。"
            />
          ) : null}
          {(history.data?.items || []).map(({ allocation_request: item }) => (
            <Space key={item.id} wrap>
              <Typography.Text>申请 #{item.id}</Typography.Text>
              <AppStatusTag name="allocation-request" state={item.status}>
                {item.status__mapping}
              </AppStatusTag>
              <Typography.Text type="secondary">
                {item.team_name_snapshot || '空间直属'} ·{' '}
                {moneyText(item.distributable_amount)}
              </Typography.Text>
            </Space>
          ))}
        </Space>
      )}
      <Modal
        okButtonProps={{
          disabled:
            mode !== 'resubmit' &&
            (!preview.data || preview.isFetching || preview.isError),
        }}
        open={open}
        title={
          mode === 'initial'
            ? '申请收益'
            : mode === 'resubmit'
              ? '按原方案重提'
              : '纠错重提'
        }
        confirmLoading={submit.isPending}
        onCancel={() => !submit.isPending && setOpen(false)}
        onOk={() => {
          void form
            .validateFields()
            .then((values) => submit.mutateAsync(values));
        }}
      >
        <Descriptions
          size="small"
          column={1}
          items={[
            {
              key: 'rent',
              label: '本次租约月租',
              children: moneyText(lease.monthly_rent),
            },
            ...(latest
              ? [
                  {
                    key: 'previous',
                    label: '原申请金额',
                    children: moneyText(latest.distributable_amount),
                  },
                  {
                    key: 'team',
                    label: '原归属团队',
                    children: latest.team_name_snapshot || '空间直属',
                  },
                ]
              : []),
          ]}
        />
        {mode === 'resubmit' ? (
          <Alert
            type="info"
            title="原团队、规则、金额、受益人和归属月份保持不变，仅重新开始七天审核期限。"
          />
        ) : null}
        {mode !== 'resubmit' && preview.isError ? (
          <Alert
            type="error"
            title="收益方案预览失败"
            action={
              <Button onClick={() => void preview.refetch()}>重新预览</Button>
            }
          />
        ) : null}
        {mode !== 'resubmit' && preview.data ? (
          <Descriptions
            size="small"
            column={1}
            items={[
              {
                key: 'team',
                label: '本次团队',
                children: preview.data.team_name || '空间直属',
              },
              {
                key: 'month',
                label: '业绩归属月',
                children: preview.data.performance_month?.slice(0, 7),
              },
              {
                key: 'rule',
                label: '本次规则',
                children:
                  preview.data.distribution_method === 'percentage'
                    ? `月租 × ${Number(preview.data.distribution_rate_bp || 0) / 100}%`
                    : '固定金额',
              },
              {
                key: 'amount',
                label: '可分配收益',
                children: moneyText(preview.data.distributable_amount),
              },
            ]}
          />
        ) : null}
        <Form form={form} layout="vertical">
          {mode !== 'resubmit' ? (
            <Form.Item
              label="受益人"
              name="beneficiary_user_ids"
              rules={[{ required: true, message: '请选择至少一名受益人' }]}
            >
              <Select
                mode="multiple"
                disabled={!capabilities.data?.change_beneficiaries}
                options={Array.from(memberOptions, ([value, label]) => ({
                  value,
                  label,
                }))}
                loading={members.isFetching}
              />
            </Form.Item>
          ) : null}
          {mode === 'correction' ? (
            <Form.Item
              label="纠错原因"
              name="reason"
              rules={[
                { required: true, whitespace: true, message: '请说明纠错原因' },
              ]}
            >
              <Input.TextArea maxLength={2000} rows={3} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
