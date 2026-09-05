import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Card, DatePicker, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  type AllocationCapabilities,
  allocationApi,
  type MonthlyAccrualTotal,
} from '@/services/manual/allocation';
import { moneyText } from '../../constants';

const PAGE_SIZE = 20;

function signedMoney(value: string) {
  const amount = Number(value);
  return (
    <Typography.Text strong type={amount < 0 ? 'danger' : undefined}>
      {amount > 0 ? '+' : ''}
      {moneyText(value)}
    </Typography.Text>
  );
}

type MonthlyTotalsTabProps = {
  capabilities?: AllocationCapabilities;
};

const MonthlyTotalsTab: React.FC<MonthlyTotalsTabProps> = ({
  capabilities,
}) => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [beneficiaryUserId, setBeneficiaryUserId] = useState<number>();
  const [effectiveMonth, setEffectiveMonth] = useState<string>();

  const beneficiariesQuery = useQuery({
    queryKey: [
      'allocation',
      'beneficiaries',
      'monthly-filter',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => allocationApi.listBeneficiaries({ page: 1, page_size: 100 }),
    enabled:
      Boolean(workspace.selectedOrgSlug) &&
      capabilities?.view_scope === 'organization',
  });

  const totalsQuery = useQuery({
    queryKey: [
      'allocation',
      'monthly-totals',
      workspace.selectedOrgSlug,
      page,
      beneficiaryUserId,
      effectiveMonth,
    ],
    queryFn: () =>
      allocationApi.listMonthlyTotals({
        page,
        page_size: PAGE_SIZE,
        beneficiary_user_id: beneficiaryUserId,
        effective_month: effectiveMonth,
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const columns: ProColumns<MonthlyAccrualTotal>[] = [
    {
      title: '员工',
      dataIndex: 'beneficiary_name_snapshot',
      width: 150,
    },
    {
      title: '归属月份',
      dataIndex: 'effective_month',
      width: 120,
      render: (_value, record) =>
        dayjs(record.effective_month).format('YYYY-MM'),
    },
    {
      title: '业务分配收益',
      dataIndex: 'allocation_amount',
      width: 140,
      align: 'right',
      render: (_value, record) => moneyText(record.allocation_amount),
    },
    {
      title: '人工增加',
      dataIndex: 'manual_increase_amount',
      width: 130,
      align: 'right',
      render: (_value, record) => signedMoney(record.manual_increase_amount),
    },
    {
      title: '人工扣减',
      dataIndex: 'manual_decrease_amount',
      width: 130,
      align: 'right',
      render: (_value, record) => signedMoney(record.manual_decrease_amount),
    },
    {
      title: '冲销金额',
      dataIndex: 'reversal_amount',
      width: 130,
      align: 'right',
      render: (_value, record) => signedMoney(record.reversal_amount),
    },
    {
      title: '净收益',
      dataIndex: 'total_amount',
      width: 140,
      align: 'right',
      render: (_value, record) => signedMoney(record.total_amount),
    },
    {
      title: '流水数',
      dataIndex: 'entry_count',
      width: 90,
      align: 'right',
    },
  ];

  return (
    <Card>
      <ProTable<MonthlyAccrualTotal>
        rowKey={(record) =>
          `${record.beneficiary_user_id}-${record.effective_month}`
        }
        ghost
        search={false}
        headerTitle={
          capabilities?.view_scope === 'organization'
            ? '空间月度收益汇总'
            : '我的月度收益汇总'
        }
        loading={totalsQuery.isLoading}
        dataSource={totalsQuery.data?.items || []}
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
              options={(beneficiariesQuery.data?.items || []).map((item) => ({
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
          <DatePicker
            key="month"
            picker="month"
            placeholder="归属月份"
            value={effectiveMonth ? dayjs(effectiveMonth) : null}
            onChange={(value) => {
              setEffectiveMonth(
                value ? value.startOf('month').format('YYYY-MM-DD') : undefined,
              );
              setPage(1);
            }}
          />,
        ]}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: totalsQuery.data?.total || 0,
          onChange: setPage,
        }}
        scroll={adminTableScroll}
      />
    </Card>
  );
};

export default MonthlyTotalsTab;
