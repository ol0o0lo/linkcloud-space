import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Table } from 'antd';
import React, { useMemo } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type HouseOut } from '@/services/manual/house';
import { getHouseMediaCompleteness } from './constants';

const WorkbenchPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houses = useQuery({ queryKey: ['house', 'workbench', 'houses', workspace.selectedOrgSlug], queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }), enabled });
  const viewings = useQuery({ queryKey: ['house', 'workbench', 'viewings', workspace.selectedOrgSlug], queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 100 }), enabled });
  const leases = useQuery({ queryKey: ['house', 'workbench', 'leases', workspace.selectedOrgSlug], queryFn: () => houseApi.listLeases({ page: 1, page_size: 100 }), enabled });

  const tasks = useMemo(() => {
    const items = houses.data?.items || [];
    return [
      { key: 'landlord', title: '待补房东', count: items.filter((item) => !item.landlord_id).length },
      { key: 'cover', title: '待补封面', count: items.filter((item) => !getHouseMediaCompleteness(item).hasCover).length },
      { key: 'images', title: '图片少于 3 张', count: items.filter((item) => (item.images?.length || 0) < 3).length },
      { key: 'floor_plan', title: '缺户型图', count: items.filter((item) => !getHouseMediaCompleteness(item).hasFloorPlan).length },
      { key: 'converted', title: '已成交待签约', count: (viewings.data?.items || []).filter((item) => item.status === 'converted').length },
      { key: 'contract', title: '合同缺失', count: (leases.data?.items || []).filter((item) => !item.contract_files?.length).length },
    ];
  }, [houses.data, leases.data, viewings.data]);

  return (
    <TenantSelectionGuard title="房源工作台" subtitle="优先处理会阻断发布、带看和签约的事项。">
      <Row gutter={[16, 16]}>
        {tasks.map((task) => (
          <Col key={task.key} xs={24} sm={12} lg={8}>
            <Card>
              <Statistic title={task.title} value={task.count} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="房源待办明细" style={{ marginTop: 16 }}>
        <Table<HouseOut>
          rowKey="id"
          loading={houses.isLoading}
          columns={[
            { title: '房号', dataIndex: 'room_number' },
            { title: '发布', dataIndex: 'publish_status' },
            { title: '房态', dataIndex: 'status' },
            { title: '图片', dataIndex: 'images', render: (value) => `${value?.length || 0} 张` },
          ]}
          dataSource={houses.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default WorkbenchPage;
