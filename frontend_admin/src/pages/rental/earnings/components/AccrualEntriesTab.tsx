import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, DatePicker, Select, Space, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  type AccrualEntry,
  type AllocationCapabilities,
  allocationApi,
} from '@/services/manual/allocation';
import { moneyText } from '../../constants';
import ManualAdjustmentModal from './ManualAdjustmentModal';

const PAGE_SIZE = 20;
const { RangePicker } = DatePicker;

const ENTRY_TYPE_OPTIONS = [
  { value: 'allocation', label: '业务分配' },
  { value: 'manual_increase', label: '人工增加' },
  { value: 'manual_decrease', label: '人工扣减' },
  { value: 'reversal', label: '冲销' },
];

function sourceText(entry: AccrualEntry) {
  if (
    entry.entry_type === 'manual_increase' ||
    entry.entry_type === 'manual_decrease'
  ) {
    return '人工调整';
  }
  const house = entry.source_snapshot?.house;
  return (
    [house?.estate_name, house?.building_name, house?.room_number]
      .filter(Boolean)
      .join(' / ') || '业务分配'
  );
}

type AccrualEntriesTabProps = {
  capabilities?: AllocationCapabilities;
};

const AccrualEntriesTab: React.FC<AccrualEntriesTabProps> = ({
  capabilities,
}) => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [beneficiaryUserId, setBeneficiaryUserId] = useState<number>();
  const [entryType, setEntryType] = useState<string>();
  const [effectiveMonth, setEffectiveMonth] = useState<string>();
  const [effectiveRange, setEffectiveRange] = useState<
    [string, string] | undefined
  >();
  const [manualOpen, setManualOpen] = useState(false);

  const beneficiariesQuery = useQuery({
    queryKey: [
      'allocation',
      'beneficiaries',
      'earnings-filter',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => allocationApi.listBeneficiaries({ page: 1, page_size: 100 }),
    enabled:
      Boolean(workspace.selectedOrgSlug) &&
      Boolean(
        capabilities?.view_scope === 'organization' || capabilities?.adjust,
      ),
  });

  const entriesQuery = useQuery({
    queryKey: [
      'allocation',
      'entries',
      workspace.selectedOrgSlug,
      page,
      beneficiaryUserId,
      entryType,
      effectiveMonth,
      effectiveRange,
    ],
    queryFn: () =>
      allocationApi.listEntries({
        page,
        page_size: PAGE_SIZE,
        beneficiary_user_id: beneficiaryUserId,
        entry_type: entryType,
        effective_month: effectiveMonth,
        effective_from: effectiveRange?.[0],
        effective_to: effectiveRange?.[1],
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const columns: ProColumns<AccrualEntry>[] = [
    {
      title: '受益人',
      dataIndex: 'beneficiary_name_snapshot',
      width: 130,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (_value, record) => (
        <Typography.Text
          strong
          type={Number(record.amount) < 0 ? 'danger' : undefined}
        >
          {Number(record.amount) > 0 ? '+' : ''}
          {moneyText(record.amount)}
        </Typography.Text>
      ),
    },
    {
      title: '流水类型',
      dataIndex: 'entry_type__mapping',
      width: 110,
    },
    {
      title: '归属月份',
      dataIndex: 'effective_month',
      width: 110,
      render: (_value, record) =>
        dayjs(record.effective_month).format('YYYY-MM'),
    },
    {
      title: '业务来源',
      dataIndex: 'source_snapshot',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text>{sourceText(record)}</Typography.Text>
          {record.allocation_request_id ? (
            <Typography.Link
              href={`?tab=reviews&request=${record.allocation_request_id}`}
            >
              申请 #{record.allocation_request_id}
            </Typography.Link>
          ) : null}
        </Space>
      ),
    },
    {
      title: '关联流水',
      dataIndex: 'reversal_of_id',
      width: 110,
      render: (_value, record) =>
        record.reversal_of_id
          ? `冲销 #${record.reversal_of_id}`
          : record.reversal_entry_id
            ? `已由 #${record.reversal_entry_id} 冲销`
            : '-',
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 220,
      ellipsis: true,
      render: (_value, record) => record.reason || '-',
    },
    {
      title: '创建信息',
      dataIndex: 'created_at',
      width: 170,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text>{record.created_by_name}</Typography.Text>
          <Typography.Text type="secondary">
            {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
        </Space>
      ),
    },
  ];

  const beneficiaries = beneficiariesQuery.data?.items || [];

  return (
    <>
      <Card>
        <ProTable<AccrualEntry>
          rowKey="id"
          ghost
          search={false}
          headerTitle={
            capabilities?.view_scope === 'organization'
              ? '空间收益流水'
              : '我的收益流水'
          }
          loading={entriesQuery.isLoading}
          dataSource={entriesQuery.data?.items || []}
          columns={columns}
          toolBarRender={() => [
            capabilities?.view_scope === 'organization' ? (
              <Select
                key="beneficiary"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="按员工筛选"
                loading={beneficiariesQuery.isLoading}
                options={beneficiaries.map((item) => ({
                  value: item.user_id,
                  label: item.name,
                }))}
                value={beneficiaryUserId}
                onChange={(value) => {
                  setBeneficiaryUserId(value);
                  setPage(1);
                }}
                style={{ width: 160 }}
              />
            ) : null,
            <Select
              key="entry-type"
              allowClear
              placeholder="流水类型"
              options={ENTRY_TYPE_OPTIONS}
              value={entryType}
              onChange={(value) => {
                setEntryType(value);
                setPage(1);
              }}
              style={{ width: 140 }}
            />,
            <DatePicker
              key="month"
              picker="month"
              placeholder="归属月份"
              value={effectiveMonth ? dayjs(effectiveMonth) : null}
              onChange={(value) => {
                setEffectiveMonth(
                  value
                    ? value.startOf('month').format('YYYY-MM-DD')
                    : undefined,
                );
                setPage(1);
              }}
            />,
            <RangePicker
              key="range"
              value={
                effectiveRange
                  ? [dayjs(effectiveRange[0]), dayjs(effectiveRange[1])]
                  : null
              }
              onChange={(values: [Dayjs | null, Dayjs | null] | null) => {
                setEffectiveRange(
                  values?.[0] && values[1]
                    ? [
                        values[0].format('YYYY-MM-DD'),
                        values[1].format('YYYY-MM-DD'),
                      ]
                    : undefined,
                );
                setPage(1);
              }}
            />,
            capabilities?.adjust ? (
              <Button
                key="manual-adjustment"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setManualOpen(true)}
              >
                人工调整
              </Button>
            ) : null,
          ]}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: entriesQuery.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>
      <ManualAdjustmentModal
        open={manualOpen}
        beneficiaries={beneficiaries}
        beneficiariesLoading={beneficiariesQuery.isLoading}
        onClose={() => setManualOpen(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ['allocation'] })
        }
      />
    </>
  );
};

export default AccrualEntriesTab;
