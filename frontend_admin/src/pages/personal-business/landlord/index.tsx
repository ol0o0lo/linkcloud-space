import {
  CopyOutlined,
  ExportOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Grid,
  Image,
  message,
  Progress,
  Result,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { AppStatusTag } from '@/components/AppStatus';
import { PageContainer } from '@/components/PageContainer';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { housePrimaryLayoutText } from '@/pages/rental/constants';
import {
  houseApi,
  type LandlordHouse,
  type LandlordRelationship,
  type LeaseOut,
} from '@/services/manual/house';

const PAGE_SIZE = 10;
const LANDLORD_CONTACT_STORAGE_KEY = 'selected_landlord_contact_id';

function initialContactId() {
  if (typeof window === 'undefined') return undefined;
  const value = Number(
    window.localStorage.getItem(LANDLORD_CONTACT_STORAGE_KEY),
  );
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function publicHousePath(publicKey: string, houseId: number) {
  return `/landlords/${publicKey}/houses/${houseId}`;
}

async function copyPublicUrl(path: string) {
  const url = new URL(`/dashboard${path}`, window.location.origin).toString();
  await navigator.clipboard.writeText(url);
  message.success('分享链接已复制');
}

const LandlordCenterPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const [selectedContactId, setSelectedContactId] = useState<
    number | undefined
  >(initialContactId);
  const [housePage, setHousePage] = useState(1);
  const [leasePage, setLeasePage] = useState(1);
  const relationships = useQuery({
    queryKey: ['landlord', 'relationships'],
    queryFn: houseApi.listLandlordRelationships,
    retry: false,
  });
  const currentRelationship = useMemo(
    () =>
      relationships.data?.find((item) => item.contact_id === selectedContactId),
    [relationships.data, selectedContactId],
  );
  const publicHouseRatio = currentRelationship?.house_count
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (currentRelationship.public_house_count /
              currentRelationship.house_count) *
              100,
          ),
        ),
      )
    : 0;
  const houses = useQuery({
    queryKey: ['landlord', 'houses', selectedContactId, housePage],
    queryFn: () =>
      houseApi.listLandlordHouses(selectedContactId as number, {
        page: housePage,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(currentRelationship),
  });
  const leases = useQuery({
    queryKey: ['landlord', 'leases', selectedContactId, leasePage],
    queryFn: () =>
      houseApi.listLandlordLeases(selectedContactId as number, {
        page: leasePage,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(currentRelationship),
  });

  useEffect(() => {
    if (!relationships.data?.length) return;
    if (
      selectedContactId &&
      relationships.data.some((item) => item.contact_id === selectedContactId)
    ) {
      return;
    }
    setSelectedContactId(relationships.data[0].contact_id);
  }, [relationships.data, selectedContactId]);

  useEffect(() => {
    if (!selectedContactId || typeof window === 'undefined') return;
    window.localStorage.setItem(
      LANDLORD_CONTACT_STORAGE_KEY,
      String(selectedContactId),
    );
    setHousePage(1);
    setLeasePage(1);
  }, [selectedContactId]);

  const houseColumns: ColumnsType<LandlordHouse> = [
    {
      title: '房源',
      key: 'house',
      width: 320,
      render: (_value, record) => {
        const cover = record.images[0];
        const houseName = `${
          record.building.estate?.display_name ||
          record.building.estate?.name ||
          record.building.name
        } ${record.room_number}`;
        const address = record.building.address || record.building.name;

        return (
          <div className="flex min-w-0 items-center gap-3">
            {cover?.url ? (
              <Image
                alt={houseName}
                width={48}
                height={48}
                preview={false}
                src={cover.thumbnail || cover.url}
                style={{
                  borderRadius: token.borderRadius,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                className="flex size-12 shrink-0 items-center justify-center"
                style={{
                  background: token.colorFillQuaternary,
                  borderRadius: token.borderRadius,
                  color: token.colorTextSecondary,
                }}
              >
                <AppIcon name="house.placeholder" className="text-xl" />
              </div>
            )}
            <Space orientation="vertical" size={0} className="min-w-0">
              <Typography.Text strong ellipsis={{ tooltip: houseName }}>
                {houseName}
              </Typography.Text>
              <Typography.Text type="secondary" ellipsis={{ tooltip: address }}>
                {address}
              </Typography.Text>
            </Space>
          </div>
        );
      },
    },
    {
      title: '房态',
      dataIndex: 'status',
      align: 'center',
      width: 120,
      render: (status: string, record) => (
        <AppStatusTag name="house" state={status}>
          {record.status__mapping || status}
        </AppStatusTag>
      ),
    },
    {
      title: '户型',
      key: 'layout',
      align: 'center',
      width: 120,
      render: (_value, record) => housePrimaryLayoutText(record),
    },
    {
      title: '面积',
      dataIndex: 'area',
      align: 'right',
      width: 110,
      render: (value) =>
        value === null || value === undefined ? '-' : `${value} ㎡`,
    },
    {
      title: '租金',
      dataIndex: 'asking_rent',
      align: 'right',
      width: 130,
      render: (value) =>
        value === null || value === undefined
          ? '-'
          : `¥${Number(value).toLocaleString()}/月`,
    },
    {
      title: '分享',
      key: 'share',
      align: 'center',
      width: 100,
      render: (_value, record) =>
        currentRelationship && record.status === 'listed' ? (
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() =>
              void copyPublicUrl(
                publicHousePath(currentRelationship.public_key, record.id),
              )
            }
          >
            复制
          </Button>
        ) : (
          <Typography.Text type="secondary">未公开</Typography.Text>
        ),
    },
  ];

  const leaseColumns: ColumnsType<LeaseOut> = [
    {
      title: '房源',
      key: 'house',
      width: 240,
      render: (_value, record) =>
        record.house.label || record.house.room_number,
    },
    {
      title: '租客',
      key: 'tenant',
      width: 160,
      render: (_value, record) => record.tenant.name,
    },
    {
      title: '租期',
      key: 'term',
      align: 'center',
      width: 220,
      render: (_value, record) =>
        `${dayjs(record.start_date).format('YYYY-MM-DD')} 至 ${dayjs(record.end_date).format('YYYY-MM-DD')}`,
    },
    {
      title: '月租',
      dataIndex: 'monthly_rent',
      align: 'right',
      width: 120,
      render: (value) => `¥${Number(value).toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 120,
      render: (status: string, record) => (
        <AppStatusTag name="lease" state={status}>
          {record.status__mapping || status}
        </AppStatusTag>
      ),
    },
  ];

  if (relationships.isPending) {
    return <PageContainer loading />;
  }

  if (relationships.isError) {
    return (
      <PageContainer>
        <Result
          status="error"
          title="房东关系加载失败"
          subTitle="请检查网络后重试。"
          extra={
            <Button onClick={() => void relationships.refetch()}>
              重新加载
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!relationships.data?.length) {
    return (
      <PageContainer>
        <Result
          status="info"
          title="尚未绑定中介房东档案"
          subTitle="请让中介向您的已验证手机号发送房东邀请，接受后即可在这里查看房源和租约。"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      showTitle
      title="房东中心"
      extra={
        currentRelationship
          ? [
              <Button
                key="preview"
                icon={<ExportOutlined />}
                href={`/dashboard/landlords/${currentRelationship.public_key}`}
                target="_blank"
              >
                预览公开页
              </Button>,
              <Button
                key="share"
                type="primary"
                icon={<CopyOutlined />}
                onClick={() =>
                  void copyPublicUrl(
                    `/landlords/${currentRelationship.public_key}`,
                  )
                }
              >
                复制店铺链接
              </Button>,
            ]
          : undefined
      }
    >
      <Space orientation="vertical" size={20} className="w-full">
        {currentRelationship ? (
          <Card>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <Space size={12} align="center">
                  <Avatar
                    size={48}
                    style={{
                      background: token.colorPrimaryBg,
                      color: token.colorPrimary,
                      fontWeight: token.fontWeightStrong,
                    }}
                  >
                    {currentRelationship.organization_name.slice(0, 1)}
                  </Avatar>
                  <Space orientation="vertical" size={1}>
                    <Space wrap size={8}>
                      <Typography.Title level={4} className="mb-0!">
                        {currentRelationship.organization_name}
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        房东档案
                      </Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">
                      {currentRelationship.contact_name} · 资料由当前中介维护
                    </Typography.Text>
                  </Space>
                </Space>

                <div
                  className="flex flex-col gap-1.5"
                  style={{ width: screens.md ? 320 : '100%' }}
                >
                  <Typography.Text type="secondary">当前中介</Typography.Text>
                  <Select<number>
                    aria-label="切换房东关系"
                    value={selectedContactId}
                    className="w-full"
                    options={relationships.data.map(
                      (item: LandlordRelationship) => ({
                        label: `${item.organization_name} · ${item.contact_name}`,
                        value: item.contact_id,
                      }),
                    )}
                    onChange={setSelectedContactId}
                  />
                </div>
              </div>

              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12} xl={8}>
                  <div
                    className="h-full p-4"
                    style={{
                      background: token.colorFillQuaternary,
                      borderRadius: token.borderRadiusLG,
                    }}
                  >
                    <Space orientation="vertical" size={8}>
                      <Space size={8}>
                        <AppIcon
                          name="house"
                          style={{ color: token.colorTextSecondary }}
                        />
                        <Typography.Text type="secondary">
                          当前档案全部房源
                        </Typography.Text>
                      </Space>
                      <Statistic
                        value={currentRelationship.house_count}
                        suffix="套"
                      />
                    </Space>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <div
                    className="h-full p-4"
                    style={{
                      background: token.colorPrimaryBg,
                      borderRadius: token.borderRadiusLG,
                    }}
                  >
                    <Space orientation="vertical" size={8}>
                      <Space size={8}>
                        <AppIcon name="house" state="listed" />
                        <Typography.Text type="secondary">
                          公开招租房源
                        </Typography.Text>
                      </Space>
                      <Statistic
                        value={currentRelationship.public_house_count}
                        suffix="套"
                        styles={{ content: { color: token.colorPrimary } }}
                      />
                    </Space>
                  </div>
                </Col>
                <Col xs={24} xl={8}>
                  <div
                    className="flex h-full flex-col justify-center gap-2 p-4"
                    style={{
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadiusLG,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Typography.Text type="secondary">
                        公开覆盖率
                      </Typography.Text>
                      <Typography.Text strong>
                        {publicHouseRatio}%
                      </Typography.Text>
                    </div>
                    <Progress percent={publicHouseRatio} showInfo={false} />
                    <Typography.Text type="secondary">
                      {currentRelationship.public_house_count} /{' '}
                      {currentRelationship.house_count} 套房源正在公开展示
                    </Typography.Text>
                  </div>
                </Col>
              </Row>

              <div
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start"
                style={{
                  background: token.colorInfoBg,
                  border: `1px solid ${token.colorInfoBorder}`,
                  borderRadius: token.borderRadiusLG,
                }}
              >
                <InfoCircleOutlined
                  className="mt-0.5 shrink-0"
                  style={{ color: token.colorInfo }}
                />
                <div>
                  <Typography.Text strong>当前为只读房东视角</Typography.Text>
                  <Typography.Paragraph type="secondary" className="mb-0!">
                    房源资料、房态和租约由对应中介维护；切换中介只会切换当前联系人范围，不影响员工组织选择。
                  </Typography.Paragraph>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {currentRelationship ? (
          <Card
            title={
              <Space size={8}>
                <AppIcon name="house" />
                <span>房产资料</span>
              </Space>
            }
            extra={
              <Typography.Text type="secondary">
                {currentRelationship.organization_name}
              </Typography.Text>
            }
          >
            <Tabs
              items={[
                {
                  key: 'houses',
                  label: `房源（${currentRelationship.house_count}）`,
                  children: (
                    <Table<LandlordHouse>
                      rowKey="id"
                      loading={houses.isPending}
                      columns={houseColumns}
                      dataSource={houses.data?.items || []}
                      locale={{
                        emptyText: houses.isError ? (
                          <Empty description="房源加载失败">
                            <Button onClick={() => void houses.refetch()}>
                              重新加载
                            </Button>
                          </Empty>
                        ) : (
                          <Empty description="当前中介尚未登记您的房源" />
                        ),
                      }}
                      pagination={{
                        current: housePage,
                        pageSize: PAGE_SIZE,
                        total: houses.data?.total || 0,
                        showSizeChanger: false,
                        onChange: setHousePage,
                      }}
                      scroll={adminTableScroll}
                    />
                  ),
                },
                {
                  key: 'leases',
                  label: `租约${leases.data ? `（${leases.data.total}）` : ''}`,
                  children: (
                    <Table<LeaseOut>
                      rowKey="id"
                      loading={leases.isPending}
                      columns={leaseColumns}
                      dataSource={leases.data?.items || []}
                      locale={{
                        emptyText: leases.isError ? (
                          <Empty description="租约加载失败">
                            <Button onClick={() => void leases.refetch()}>
                              重新加载
                            </Button>
                          </Empty>
                        ) : (
                          <Empty description="当前房东档案暂无租约" />
                        ),
                      }}
                      pagination={{
                        current: leasePage,
                        pageSize: PAGE_SIZE,
                        total: leases.data?.total || 0,
                        showSizeChanger: false,
                        onChange: setLeasePage,
                      }}
                      scroll={adminTableScroll}
                    />
                  ),
                },
              ]}
            />
          </Card>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default LandlordCenterPage;
