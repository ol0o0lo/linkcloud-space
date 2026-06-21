import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type LeaseOut } from '@/services/manual/house';
import { STATUS_COLOR, STATUS_TEXT } from '../constants';

const LeasesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const leases = useQuery({ queryKey: ['house', 'leases', workspace.selectedOrgSlug], queryFn: () => houseApi.listLeases({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="租约" subtitle="查看签约、履约和合同资料状态。">
      <Card title="租约列表">
        <Table<LeaseOut>
          rowKey="id"
          loading={leases.isLoading}
          columns={[
            { title: '房源', dataIndex: 'house_id' },
            { title: '租客', dataIndex: 'tenant_id' },
            { title: '起租', dataIndex: 'start_date' },
            { title: '到期', dataIndex: 'end_date' },
            { title: '月租', dataIndex: 'monthly_rent' },
            { title: '状态', dataIndex: 'status', render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
            { title: '合同', dataIndex: 'contract_files', render: (value) => `${value?.length || 0} 份` },
          ]}
          dataSource={leases.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default LeasesPage;
