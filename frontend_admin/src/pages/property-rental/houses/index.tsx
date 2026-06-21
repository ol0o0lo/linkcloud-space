import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Card, Image, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useState } from 'react';
import { AdminToolbar, adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type HouseOut } from '@/services/manual/house';
import {
  getCoverImage,
  HOUSE_PUBLISH_STATUS_COLOR,
  HOUSE_PUBLISH_STATUS_OPTIONS,
  HOUSE_PUBLISH_STATUS_TEXT,
  HOUSE_STATUS_OPTIONS,
  STATUS_COLOR,
  STATUS_TEXT,
} from '../constants';

const HousesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [status, setStatus] = useState<string>();
  const [publishStatus, setPublishStatus] = useState<string>();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houses = useQuery({
    queryKey: ['house', 'houses', workspace.selectedOrgSlug, status, publishStatus],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 100, status, publish_status: publishStatus }),
    enabled,
  });

  const columns: ColumnsType<HouseOut> = [
    {
      title: '封面',
      dataIndex: 'images',
      width: 100,
      render: (images) => {
        const cover = getCoverImage(images);
        return cover?.url ? <Image width={72} height={48} style={{ objectFit: 'cover' }} src={cover.url as string} /> : '-';
      },
    },
    { title: '房号', dataIndex: 'room_number', width: 120 },
    { title: '面积', dataIndex: 'area', width: 100, render: (value) => value || '-' },
    { title: '挂牌租金', dataIndex: 'asking_rent', width: 120, render: (value) => value || '-' },
    { title: '房态', dataIndex: 'status', width: 120, render: (value) => <Tag color={STATUS_COLOR[value] || 'default'}>{STATUS_TEXT[value] || value}</Tag> },
    { title: '发布', dataIndex: 'publish_status', width: 120, render: (value) => <Tag color={HOUSE_PUBLISH_STATUS_COLOR[value] || 'default'}>{HOUSE_PUBLISH_STATUS_TEXT[value] || value}</Tag> },
    { title: '房东', dataIndex: 'landlord_id', width: 120, render: (value) => value || '待补' },
    { title: '媒体', dataIndex: 'images', width: 120, render: (_value, record) => `${record.images?.length || 0} 图 / ${record.videos?.length || 0} 视频` },
    { title: '操作', dataIndex: 'actions', width: 120, render: (_value, record) => <a onClick={() => history.push(`/property-rental/houses/${record.id}`)}>详情</a> },
  ];

  return (
    <TenantSelectionGuard title="房源" subtitle="按房源发现资料、媒体、房态和发布问题。">
      <Card
        title="房源列表"
        extra={<AdminToolbar><Button type="primary" icon={<PlusOutlined />} onClick={() => history.push('/property-rental/houses/new')}>新建房源</Button></AdminToolbar>}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select allowClear placeholder="房态" options={HOUSE_STATUS_OPTIONS} value={status} onChange={setStatus} style={{ width: 160 }} />
          <Select allowClear placeholder="发布状态" options={HOUSE_PUBLISH_STATUS_OPTIONS} value={publishStatus} onChange={setPublishStatus} style={{ width: 160 }} />
        </Space>
        <Table rowKey="id" loading={houses.isLoading} columns={columns} dataSource={houses.data?.items || []} pagination={false} scroll={adminTableScroll} />
      </Card>
    </TenantSelectionGuard>
  );
};

export default HousesPage;
