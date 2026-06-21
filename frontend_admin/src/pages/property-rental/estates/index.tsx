import { useQuery } from '@tanstack/react-query';
import { Card, Table } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type BuildingOut, type EstateOut } from '@/services/manual/house';

const EstatesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const estates = useQuery({ queryKey: ['house', 'estates', workspace.selectedOrgSlug], queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }), enabled });
  const buildings = useQuery({ queryKey: ['house', 'buildings', workspace.selectedOrgSlug], queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="项目楼栋" subtitle="维护房源所在的小区、项目和楼栋基础资料。">
      <Card title="项目小区">
        <Table<EstateOut>
          rowKey="id"
          loading={estates.isLoading}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '城市', dataIndex: 'city' },
            { title: '区域', dataIndex: 'district' },
            { title: '地址', dataIndex: 'address' },
          ]}
          dataSource={estates.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
      <Card title="楼栋" style={{ marginTop: 16 }}>
        <Table<BuildingOut>
          rowKey="id"
          loading={buildings.isLoading}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '楼层', dataIndex: 'floors' },
            { title: '电梯', dataIndex: 'elevator', render: (value) => (value ? '有' : '无') },
            { title: '地址', dataIndex: 'address' },
          ]}
          dataSource={buildings.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default EstatesPage;
