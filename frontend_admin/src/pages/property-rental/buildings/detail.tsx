import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import { Card, Descriptions, Empty, Spin, Table, Tag } from 'antd';
import React from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';

function safeMapReturnTo(value: string | null) {
  return value?.startsWith('/dashboard/property-rental/map') ? value : '/dashboard/property-rental/map';
}

const BuildingDetailPage: React.FC = () => {
  const { id } = useParams();
  const workspace = useTenantWorkspace();
  const buildingId = Number(id);
  const detail = useQuery({ queryKey: ['building-map-detail', workspace.selectedOrgSlug, buildingId], queryFn: () => houseApi.getBuildingMapDetail(buildingId), enabled: Boolean(workspace.selectedOrgSlug && buildingId) });
  const returnTo = safeMapReturnTo(new URLSearchParams(window.location.search).get('return_to'));
  if (detail.isLoading) return <Spin />;
  if (!detail.data) return <Empty description="未找到楼栋" />;
  const building = detail.data;
  return <TenantSelectionGuard title="楼栋详情">
    <Card title={building.name} extra={<Link to={returnTo}>返回房源地图</Link>}>
      <Descriptions column={2} items={[
        { key: 'estate', label: '所属小区', children: building.estate?.display_name || building.estate?.name || '-' },
        { key: 'address', label: '地址', children: building.address },
        { key: 'floors', label: '楼层', children: building.floors },
        { key: 'location', label: '位置', children: building.lat == null || building.lng == null ? '楼栋待定位' : '楼栋位置已维护' },
      ]} />
      <Table rowKey="id" dataSource={building.houses} pagination={false} columns={[
        { title: '房号', dataIndex: 'room_number', render: (value, row) => <Link to={`/property-rental/houses/${row.id}`}>{value}</Link> },
        { title: '楼层', dataIndex: 'floor', render: (value) => value ?? '-' },
        { title: '状态', dataIndex: 'status__mapping', render: (value) => <Tag>{value}</Tag> },
        { title: '租金', dataIndex: 'asking_rent', render: (value) => value ?? '-' },
      ]} />
    </Card>
  </TenantSelectionGuard>;
};

export default BuildingDetailPage;
