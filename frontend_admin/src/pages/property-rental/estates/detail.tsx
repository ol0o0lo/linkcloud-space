import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import { Card, Col, Descriptions, Empty, Row, Spin, Statistic, Table, Tag } from 'antd';
import React, { useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';

const PAGE_SIZE = 20;

const EstateDetailPage: React.FC = () => {
  const { id } = useParams();
  const workspace = useTenantWorkspace();
  const estateId = Number(id);
  const [page, setPage] = useState(1);
  const enabled = Boolean(workspace.selectedOrgSlug && estateId);
  const detail = useQuery({ queryKey: ['estate-detail', workspace.selectedOrgSlug, estateId], queryFn: () => houseApi.getEstate(estateId), enabled });
  const buildings = useQuery({
    queryKey: ['estate-detail-buildings', workspace.selectedOrgSlug, estateId, page],
    queryFn: () => houseApi.listBuildings({ estate_id: estateId, page, page_size: PAGE_SIZE }),
    enabled,
  });
  if (detail.isLoading) return <Spin />;
  if (!detail.data) return <Empty description="未找到小区" />;
  const estate = detail.data;
  const counts = estate.counts;

  return (
    <TenantSelectionGuard title="小区详情">
      <Card title={estate.display_name || estate.name} extra={<Link to="/property-rental/estates">返回小区楼栋</Link>}>
        <Descriptions column={2} items={[
          { key: 'address', label: '地址', children: estate.address || '-' },
          { key: 'type', label: '物业类型', children: estate.property_type__mapping || estate.property_type },
          { key: 'location', label: '区域', children: [estate.province, estate.city, estate.district].filter(Boolean).join(' / ') || '-' },
          { key: 'status', label: '状态', children: estate.is_active === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag> },
        ]} />
        <Card size="small" title="经营概览" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            {[
              ['楼栋', estate.building_count || 0], ['总房源', counts?.total || 0], ['空置', counts?.vacant || 0],
              ['已租', counts?.rented || 0], ['装修中', counts?.renovating || 0], ['封存', counts?.locked || 0], ['已发布', counts?.published || 0],
            ].map(([label, value]) => <Col key={String(label)} xs={12} sm={8} lg={4}><Statistic title={label} value={Number(value)} /></Col>)}
          </Row>
        </Card>
        <Table
          rowKey="id"
          loading={buildings.isLoading}
          dataSource={buildings.data?.items || []}
          style={{ marginTop: 16 }}
          locale={{ emptyText: '暂无楼栋，可新建楼栋' }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: buildings.data?.total || 0, onChange: setPage }}
          columns={[
            { title: '楼栋', dataIndex: 'name', render: (value, row) => <Link to={`/property-rental/buildings/${row.id}`}>{value}</Link> },
            { title: '楼层', dataIndex: 'floors' },
            { title: '总房源', dataIndex: ['counts', 'total'], render: (_value, row) => row.counts?.total || 0 },
            { title: '空置', dataIndex: ['counts', 'vacant'], render: (_value, row) => row.counts?.vacant || 0 },
            { title: '已租', dataIndex: ['counts', 'rented'], render: (_value, row) => row.counts?.rented || 0 },
            { title: '状态', dataIndex: 'is_active', render: (value) => value === false ? <Tag>停用</Tag> : <Tag color="green">启用</Tag> },
          ]}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default EstateDetailPage;
