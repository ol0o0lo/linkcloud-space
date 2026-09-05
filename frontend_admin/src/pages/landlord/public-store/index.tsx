import { CopyOutlined, PhoneOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Image,
  message,
  Pagination,
  Result,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { housePrimaryLayoutText } from '@/pages/rental/constants';
import { houseApi } from '@/services/manual/house';

const PAGE_SIZE = 12;

const PublicLandlordStorePage: React.FC = () => {
  const { publicKey } = useParams<{ publicKey: string }>();
  const [page, setPage] = useState(1);
  const profile = useQuery({
    queryKey: ['public-landlord', 'profile', publicKey],
    queryFn: () => houseApi.getPublicLandlordProfile(publicKey || ''),
    enabled: Boolean(publicKey),
    retry: false,
  });
  const houses = useQuery({
    queryKey: ['public-landlord', 'houses', publicKey, page],
    queryFn: () =>
      houseApi.listPublicLandlordHouses(publicKey || '', {
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(publicKey),
    retry: false,
  });

  if (profile.isPending || houses.isPending) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  if (!publicKey || profile.isError || houses.isError || !profile.data) {
    return (
      <PageContainer>
        <Result
          status="404"
          title="房东公开页不可用"
          subTitle="链接可能无效，或该房东暂未开放公开房源。"
          extra={
            <Button
              onClick={() => {
                void profile.refetch();
                void houses.refetch();
              }}
            >
              重新加载
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const avatar = profile.data.avatar[0];
  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl py-4">
        <Card className="mb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Space size={16} align="center">
              <Avatar size={64} src={avatar?.thumbnail || avatar?.url}>
                {profile.data.name.slice(0, 1)}
              </Avatar>
              <Space orientation="vertical" size={2}>
                <Typography.Title level={3} className="mb-0!">
                  {profile.data.name}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {profile.data.organization.name} · {profile.data.house_count}{' '}
                  套在租房源
                </Typography.Text>
              </Space>
            </Space>
            <Space wrap>
              <Button
                icon={<CopyOutlined />}
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  message.success('公开页链接已复制');
                }}
              >
                分享
              </Button>
              <Button
                type="primary"
                icon={<PhoneOutlined />}
                href={`tel:${profile.data.phone}`}
              >
                {profile.data.phone}
              </Button>
            </Space>
          </div>
        </Card>

        {houses.data?.items.length ? (
          <>
            <Row gutter={[16, 16]}>
              {houses.data.items.map((house) => {
                const cover = house.images[0];
                return (
                  <Col xs={24} sm={12} lg={8} key={house.id}>
                    <Card
                      className="h-full"
                      cover={
                        cover?.url ? (
                          <Image
                            alt={`${house.building.name} ${house.room_number}`}
                            height={220}
                            preview={false}
                            src={cover.thumbnail || cover.url}
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="flex h-55 items-center justify-center bg-(--ant-color-fill-quaternary)">
                            <Typography.Text type="secondary">
                              暂无房源图片
                            </Typography.Text>
                          </div>
                        )
                      }
                      actions={[
                        <Link
                          key="detail"
                          to={`/landlords/${publicKey}/houses/${house.id}`}
                        >
                          查看详情
                        </Link>,
                      ]}
                    >
                      <Space orientation="vertical" size={8} className="w-full">
                        <Typography.Title level={5} className="mb-0!">
                          {house.building.estate?.display_name ||
                            house.building.estate?.name ||
                            house.building.name}{' '}
                          {house.room_number}
                        </Typography.Title>
                        <Typography.Text type="secondary">
                          {housePrimaryLayoutText(house)} ·{' '}
                          {house.area === null || house.area === undefined
                            ? '面积待补'
                            : `${house.area} ㎡`}
                        </Typography.Text>
                        <Typography.Text strong type="danger">
                          {house.asking_rent === null ||
                          house.asking_rent === undefined
                            ? '租金面议'
                            : `¥${Number(house.asking_rent).toLocaleString()}/月`}
                        </Typography.Text>
                        {house.effective_tags.length ? (
                          <Space size={[4, 4]} wrap>
                            {house.effective_tags.slice(0, 4).map((tag) => (
                              <Tag key={tag}>{tag}</Tag>
                            ))}
                          </Space>
                        ) : null}
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
            <div className="mt-6 flex justify-center">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={houses.data.total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <Card>
            <Empty description="暂无在租房源" />
          </Card>
        )}
      </div>
    </PageContainer>
  );
};

export default PublicLandlordStorePage;
