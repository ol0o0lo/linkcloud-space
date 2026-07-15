import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import { Card, Col, Descriptions, Empty, Row, Spin, Statistic, Table, Tag } from 'antd';
import React, { useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import { safeMapReturnTo } from './detail-utils';

const BuildingDetailPage: React.FC = () => {
  const { id } = useParams();
  const workspace = useTenantWorkspace();
  const buildingId = Number(id);
  const [page, setPage] = useState(1);
  const enabled = Boolean(workspace.selectedOrgSlug && buildingId);
  const detail = useQuery({ queryKey: ['building-detail', workspace.selectedOrgSlug, buildingId], queryFn: () => houseApi.getBuilding(buildingId), enabled });
  const houses = useQuery({
    queryKey: ['building-detail-houses', workspace.selectedOrgSlug, buildingId, page],
    queryFn: () => houseApi.listHouses({ building_id: buildingId, page, page_size: 20 }),
    enabled,
  });
  const returnTo = safeMapReturnTo(new URLSearchParams(window.location.search).get('return_to'));
  if (detail.isLoading) return <Spin />;
  if (!detail.data) return <Empty description="未找到楼栋" />;
  const building = detail.data;
  return <TenantSelectionGuard title="楼栋详情">
      <Card title={building.name} extra={<Link to={returnTo}>返回房源地图</Link>}>
      <Descriptions column={2} items={[
        {
          key: 'estate',
          label: '所属小区',
          children: building.estate ? <Link to={`/property-rental/estates/${building.estate.id}`}>{building.estate.display_name || building.estate.name}</Link> : '-',
        },
        { key: 'address', label: '地址', children: building.address },
        { key: 'floors', label: '楼层', children: building.floors },
        { key: 'location', label: '位置', children: building.lat == null || building.lng == null ? '楼栋待定位' : '楼栋位置已维护' },
      ]} />
      <Card size="small" title="经营概览" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          {[
            ['总房源', building.counts?.total || 0], ['空置', building.counts?.vacant || 0], ['已租', building.counts?.rented || 0],
            ['装修中', building.counts?.renovating || 0], ['封存', building.counts?.locked || 0], ['已发布', building.counts?.published || 0],
          ].map(([label, value]) => <Col key={String(label)} xs={12} sm={8} lg={4}><Statistic title={label} value={Number(value)} /></Col>)}
        </Row>
      </Card>
      <Table
        rowKey="id"
        loading={houses.isLoading}
        dataSource={houses.data?.items || []}
        pagination={{
          current: page,
          pageSize: 20,
          total: houses.data?.total || 0,
          onChange: setPage,
        }}
        locale={{ emptyText: '暂无房源，可登记房源' }}
        style={{ marginTop: 16 }}
        columns={[
        { title: '房号', dataIndex: 'room_number', render: (value, row) => <Link to={`/property-rental/houses/${row.id}`}>{value}</Link> },
        { title: '楼层', dataIndex: 'floor', render: (value) => value ?? '-' },
        { title: '状态', dataIndex: 'status__mapping', render: (value) => <Tag>{value}</Tag> },
        { title: '租金', dataIndex: 'asking_rent', render: (value) => value ?? '-' },
        ]}
      />
    </Card>
  </TenantSelectionGuard>;
};

export default BuildingDetailPage;
