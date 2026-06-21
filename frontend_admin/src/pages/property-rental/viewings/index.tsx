import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ViewingRecordOut } from '@/services/manual/house';
import { STATUS_COLOR, STATUS_TEXT } from '../constants';

const ViewingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const viewings = useQuery({ queryKey: ['house', 'viewings', workspace.selectedOrgSlug], queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="带看" subtitle="跟进预约、到访、取消和成交记录。">
      <Card title="带看记录">
        <Table<ViewingRecordOut>
          rowKey="id"
          loading={viewings.isLoading}
          columns={[
            { title: '客户', dataIndex: 'customer_name' },
            { title: '手机', dataIndex: 'customer_phone' },
            { title: '房源', dataIndex: 'house_id' },
            { title: '预约时间', dataIndex: 'scheduled_at' },
            { title: '状态', dataIndex: 'status', render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
            { title: '备注', dataIndex: 'notes' },
          ]}
          dataSource={viewings.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default ViewingsPage;
