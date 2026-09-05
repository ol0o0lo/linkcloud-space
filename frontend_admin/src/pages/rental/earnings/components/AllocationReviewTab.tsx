import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  type AllocationCapabilities,
  type AllocationRequest,
  allocationApi,
  type LeaseAllocation,
} from '@/services/manual/allocation';
import { moneyText } from '../../constants';
import AllocationDetailDrawer, {
  type AllocationDetailTarget,
} from './AllocationDetailDrawer';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'expired', label: '已过期' },
  { value: 'voided', label: '已作废' },
];

function sourceHouseText(request: AllocationRequest) {
  const house = request.source_snapshot.house;
  return (
    [house?.estate_name, house?.building_name, house?.room_number]
      .filter(Boolean)
      .join(' / ') || '-'
  );
}

function remainingReviewTime(request: AllocationRequest) {
  if (request.status !== 'pending') return '-';
  const remainingHours = dayjs(request.expires_at).diff(dayjs(), 'hour');
  if (remainingHours <= 0) return '已到期';
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  return days > 0 ? `${days} 天 ${hours} 小时` : `${hours} 小时`;
}

type AllocationReviewTabProps = {
  capabilities?: AllocationCapabilities;
  initialRequestId?: number;
};

const AllocationReviewTab: React.FC<AllocationReviewTabProps> = ({
  capabilities,
  initialRequestId,
}) => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [keyword, setKeyword] = useState<string>();
  const [selectedTarget, setSelectedTarget] =
    useState<AllocationDetailTarget>();
  const openedRequestId = useRef<number | undefined>(undefined);

  const listQuery = useQuery({
    queryKey: [
      'allocation',
      'lease-requests',
      workspace.selectedOrgSlug,
      page,
      status,
      keyword,
    ],
    queryFn: () =>
      allocationApi.listLeaseAllocations({
        page,
        page_size: PAGE_SIZE,
        status,
        keyword,
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const initialRequestQuery = useQuery({
    queryKey: [
      'allocation',
      'request-detail',
      workspace.selectedOrgSlug,
      initialRequestId,
    ],
    queryFn: () => allocationApi.getRequest(initialRequestId as number),
    enabled: Boolean(workspace.selectedOrgSlug && initialRequestId),
  });

  useEffect(() => {
    if (
      !initialRequestId ||
      !initialRequestQuery.data ||
      openedRequestId.current === initialRequestId
    ) {
      return;
    }
    openedRequestId.current = initialRequestId;
    setSelectedTarget({ request: initialRequestQuery.data });
  }, [initialRequestId, initialRequestQuery.data]);

  const columns: ProColumns<LeaseAllocation>[] = [
    {
      title: '房源 / 租客',
      dataIndex: 'lease',
      width: 230,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>
            {sourceHouseText(record.allocation_request)}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.lease.tenant?.name ||
              record.allocation_request.source_snapshot.tenant?.name ||
              '-'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '签约时间',
      dataIndex: 'sign_at',
      width: 150,
      render: (_value, record) =>
        dayjs(
          record.lease.sign_at ||
            record.allocation_request.source_snapshot.sign_at ||
            record.allocation_request.submitted_at,
        ).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '申请人',
      dataIndex: ['allocation_request', 'submitted_by_name_snapshot'],
      width: 120,
    },
    {
      title: '受益人',
      dataIndex: 'beneficiaries',
      width: 180,
      render: (_value, record) =>
        record.allocation_request.shares
          .map((share) => share.beneficiary_name_snapshot)
          .join('、'),
    },
    {
      title: '计算基数',
      dataIndex: ['allocation_request', 'basis_amount'],
      width: 120,
      align: 'right',
      render: (_value, record) =>
        moneyText(record.allocation_request.basis_amount),
    },
    {
      title: '可分配收益',
      dataIndex: ['allocation_request', 'distributable_amount'],
      width: 130,
      align: 'right',
      render: (_value, record) => (
        <Typography.Text strong>
          {moneyText(record.allocation_request.distributable_amount)}
        </Typography.Text>
      ),
    },
    {
      title: '提交时间',
      dataIndex: ['allocation_request', 'submitted_at'],
      width: 150,
      render: (_value, record) =>
        dayjs(record.allocation_request.submitted_at).format(
          'YYYY-MM-DD HH:mm',
        ),
    },
    {
      title: '剩余审核时间',
      dataIndex: ['allocation_request', 'expires_at'],
      width: 130,
      render: (_value, record) =>
        remainingReviewTime(record.allocation_request),
    },
    {
      title: '状态',
      dataIndex: ['allocation_request', 'status'],
      width: 110,
      align: 'center',
      render: (_value, record) => (
        <AppStatusTag
          name="allocation-request"
          state={record.allocation_request.status}
        >
          {record.allocation_request.status__mapping}
        </AppStatusTag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 90,
      align: 'center',
      render: (_value, record) => (
        <Button
          type="link"
          size="small"
          onClick={() =>
            setSelectedTarget({
              lease: record.lease,
              request: record.allocation_request,
            })
          }
        >
          查看
        </Button>
      ),
    },
  ];

  const handleChanged = async (nextRequest: AllocationRequest) => {
    setSelectedTarget((current) =>
      current ? { ...current, request: nextRequest } : current,
    );
    await queryClient.invalidateQueries({ queryKey: ['allocation'] });
  };

  return (
    <>
      <Card>
        <ProTable<LeaseAllocation>
          rowKey="id"
          ghost
          search={false}
          headerTitle={
            capabilities?.view_scope === 'organization'
              ? '空间分配申请'
              : '我的分配申请'
          }
          loading={listQuery.isLoading}
          dataSource={listQuery.data?.items || []}
          columns={columns}
          toolBarRender={() => [
            <Select
              key="status"
              allowClear
              placeholder="全部状态"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(value) => {
                setStatus(value || undefined);
                setPage(1);
              }}
              style={{ width: 140 }}
            />,
            <Input.Search
              key="keyword"
              allowClear
              placeholder="房源 / 租客 / 申请人"
              defaultValue={keyword}
              onSearch={(value) => {
                setKeyword(value.trim() || undefined);
                setPage(1);
              }}
              style={{ width: 240 }}
            />,
          ]}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: listQuery.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>
      <AllocationDetailDrawer
        open={Boolean(selectedTarget)}
        target={selectedTarget}
        capabilities={capabilities}
        onClose={() => setSelectedTarget(undefined)}
        onChanged={handleChanged}
      />
    </>
  );
};

export default AllocationReviewTab;
