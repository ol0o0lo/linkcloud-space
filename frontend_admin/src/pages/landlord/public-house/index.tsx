import {
  ArrowLeftOutlined,
  CopyOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Image,
  message,
  Result,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import { PageContainer } from '@/components/PageContainer';
import { housePrimaryLayoutText } from '@/pages/rental/constants';
import { houseApi } from '@/services/manual/house';

const PublicLandlordHousePage: React.FC = () => {
  const { publicKey, houseId } = useParams<{
    publicKey: string;
    houseId: string;
  }>();
  const numericHouseId = Number(houseId);
  const profile = useQuery({
    queryKey: ['public-landlord', 'profile', publicKey],
    queryFn: () => houseApi.getPublicLandlordProfile(publicKey || ''),
    enabled: Boolean(publicKey),
    retry: false,
  });
  const house = useQuery({
    queryKey: ['public-landlord', 'house', publicKey, numericHouseId],
    queryFn: () =>
      houseApi.getPublicLandlordHouse(publicKey || '', numericHouseId),
    enabled: Boolean(publicKey && numericHouseId),
    retry: false,
  });

  if (profile.isPending || house.isPending) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  if (
    !publicKey ||
    !numericHouseId ||
    profile.isError ||
    house.isError ||
    !profile.data ||
    !house.data
  ) {
    return (
      <PageContainer>
        <Result
          status="404"
          title="公开房源不可用"
          subTitle="房源可能已下架，或不属于当前房东公开页。"
          extra={
            publicKey ? (
              <Link to={`/landlords/${publicKey}`}>返回房东公开页</Link>
            ) : null
          }
        />
      </PageContainer>
    );
  }

  const data = house.data;
  const displayName =
    data.building.estate?.display_name ||
    data.building.estate?.name ||
    data.building.name;

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl py-4">
        <Space orientation="vertical" size={16} className="w-full">
          <Link to={`/landlords/${publicKey}`}>
            <ArrowLeftOutlined /> 返回房东公开页
          </Link>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={15}>
              <Card>
                {data.images.length ? (
                  <Image.PreviewGroup>
                    <Row gutter={[8, 8]}>
                      {data.images.map((item, index) => (
                        <Col
                          span={index === 0 ? 24 : 8}
                          key={item.media_id || item.url || index}
                        >
                          <Image
                            alt={`${displayName} ${data.room_number} 房源图片 ${index + 1}`}
                            src={item.url}
                            width="100%"
                            height={index === 0 ? 420 : 140}
                            style={{ objectFit: 'cover' }}
                          />
                        </Col>
                      ))}
                    </Row>
                  </Image.PreviewGroup>
                ) : (
                  <Empty description="暂无房源图片" />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={9}>
              <Card className="h-full">
                <Space orientation="vertical" size={16} className="w-full">
                  <div>
                    <Typography.Title level={2} className="mb-2!">
                      {displayName} {data.room_number}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      <EnvironmentOutlined />{' '}
                      {data.building.address || displayName}
                    </Typography.Text>
                  </div>
                  <Typography.Title level={3} type="danger" className="mb-0!">
                    {data.asking_rent === null || data.asking_rent === undefined
                      ? '租金面议'
                      : `¥${Number(data.asking_rent).toLocaleString()}/月`}
                  </Typography.Title>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="户型">
                      {housePrimaryLayoutText(data)}
                    </Descriptions.Item>
                    <Descriptions.Item label="面积">
                      {data.area === null || data.area === undefined
                        ? '-'
                        : `${data.area} ㎡`}
                    </Descriptions.Item>
                    <Descriptions.Item label="楼层">
                      {data.floor === null || data.floor === undefined
                        ? '-'
                        : `${data.floor} 层`}
                    </Descriptions.Item>
                    <Descriptions.Item label="装修">
                      {data.decoration__mapping || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="朝向">
                      {data.orientation__mapping || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                  {data.effective_tags.length ? (
                    <Space size={[4, 4]} wrap>
                      {data.effective_tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  ) : null}
                  <Space wrap>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          window.location.href,
                        );
                        message.success('房源链接已复制');
                      }}
                    >
                      分享房源
                    </Button>
                    <Button
                      type="primary"
                      icon={<PhoneOutlined />}
                      href={`tel:${profile.data.phone}`}
                    >
                      联系 {profile.data.name}
                    </Button>
                  </Space>
                </Space>
              </Card>
            </Col>
          </Row>

          {data.public_description ? (
            <Card title="房源介绍">
              <Typography.Paragraph className="mb-0 whitespace-pre-wrap">
                {data.public_description}
              </Typography.Paragraph>
            </Card>
          ) : null}
        </Space>
      </div>
    </PageContainer>
  );
};

export default PublicLandlordHousePage;
