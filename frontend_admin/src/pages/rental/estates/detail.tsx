import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Empty,
  Image,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { houseApi } from '@/services/manual/house';

const PAGE_SIZE = 20;

const useStyles = createStyles(({ css, token }) => ({
  bannerCard: css`
    overflow: hidden;

    .ant-card-body {
      padding: 0;
    }
  `,
  bannerMedia: css`
    position: relative;
    height: 260px;
    overflow: hidden;
    background: ${token.colorPrimaryBg};

    .ant-image {
      position: absolute;
      inset: 0;
    }

    .ant-image,
    .ant-image-img {
      display: block;
      width: 100%;
      height: 260px;
    }

    .ant-image-img {
      object-fit: cover;
    }
  `,
  bannerBackdrop: css`
    position: absolute;
    z-index: 1;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(8, 18, 38, 0.9) 0%,
      rgba(8, 18, 38, 0.68) 48%,
      rgba(8, 18, 38, 0.25) 100%
    );
  `,
  bannerFallback: css`
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 82% 25%, ${token.colorPrimaryBorder} 0, transparent 28%),
      linear-gradient(135deg, ${token.colorPrimaryActive}, ${token.colorPrimary});
  `,
  bannerContent: css`
    position: relative;
    z-index: 2;
    display: flex;
    min-height: 260px;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    padding: 32px;

    @media (max-width: 767px) {
      align-items: flex-start;
      flex-direction: column;
      justify-content: flex-end;
      padding: 24px;
    }
  `,
  bannerMain: css`
    min-width: 0;
  `,
  bannerEyebrow: css`
    display: block;
    margin-bottom: 8px;
    color: rgba(255, 255, 255, 0.72);
    font-size: ${token.fontSizeSM}px;
    letter-spacing: 0.12em;
  `,
  bannerTitle: css`
    color: ${token.colorTextLightSolid} !important;
  `,
  bannerMeta: css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  bannerLocation: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 14px;
    color: rgba(255, 255, 255, 0.82);
  `,
  bannerActions: css`
    flex: 0 0 auto;

    .ant-btn:not(.ant-btn-primary) {
      border-color: rgba(255, 255, 255, 0.55);
      color: ${token.colorTextLightSolid};
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
    }
  `,
  bannerIcon: css`
    position: absolute;
    right: 54px;
    bottom: 24px;
    color: rgba(255, 255, 255, 0.12);
    font-size: 132px;
  `,
  metricStrip: css`
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));

    @media (max-width: 991px) {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    @media (max-width: 575px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  metricItem: css`
    min-width: 0;
    padding: 20px;
    border-right: 1px solid ${token.colorBorderSecondary};
    border-top: 1px solid ${token.colorBorderSecondary};

    &:first-of-type {
      background: ${token.colorPrimaryBg};
    }
  `,
  metricValue: css`
    display: block;
    margin-top: 6px;
    color: ${token.colorText};
    font-size: 24px;
    font-weight: ${token.fontWeightStrong};
  `,
  projectCard: css`
    height: 100%;
  `,
  projectSection: css`
    height: 100%;
  `,
  projectItem: css`
    padding: 14px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:first-of-type {
      padding-top: 0;
    }

    &:last-of-type {
      padding-bottom: 0;
      border-bottom: 0;
    }
  `,
  projectValue: css`
    display: block;
    margin-top: 5px;
    color: ${token.colorText};
    line-height: 1.6;
    overflow-wrap: anywhere;
  `,
  buildingCard: css`
    height: 100%;
  `,
  buildingName: css`
    display: block;
    margin-bottom: 2px;
  `,
  progressCell: css`
    min-width: 150px;
  `,
}));

function rate(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

const EstateDetailPage: React.FC = () => {
  const { styles } = useStyles();
  const { id } = useParams();
  const workspace = useTenantWorkspace();
  const estateId = Number(id);
  const [page, setPage] = useState(1);
  const enabled = Boolean(workspace.selectedOrgSlug && estateId);
  const detail = useQuery({
    queryKey: ['estate-detail', workspace.selectedOrgSlug, estateId],
    queryFn: () => houseApi.getEstate(estateId),
    enabled,
  });
  const buildings = useQuery({
    queryKey: [
      'estate-detail-buildings',
      workspace.selectedOrgSlug,
      estateId,
      page,
    ],
    queryFn: () =>
      houseApi.listBuildings({
        estate_id: estateId,
        page,
        page_size: PAGE_SIZE,
      }),
    enabled,
  });

  if (detail.isLoading) return <Card loading style={{ minHeight: 360 }} />;
  if (!detail.data) return <Empty description="未找到小区" />;

  const estate = detail.data;
  const estateName = estate.display_name || estate.name;
  const counts = estate.counts;
  const total = counts?.total || 0;
  const rented = counts?.rented || 0;
  const rentable = (counts?.vacant || 0) + (counts?.listed || 0) + rented;
  const region = [estate.province, estate.city, estate.district]
    .filter(Boolean)
    .join(' / ');
  const fullAddress = [region, estate.address].filter(Boolean).join(' · ');
  const editHref = dashboardHref(
    `/rental/properties/estates?estate_edit=${estate.id}`,
  );
  const createBuildingHref = dashboardHref(
    `/rental/properties/estates?view=buildings&building_create=${estate.id}`,
  );
  const mapParams = new URLSearchParams({ estate_id: String(estate.id) });
  if (estate.lat != null && estate.lng != null) {
    mapParams.set('center_lat', String(estate.lat));
    mapParams.set('center_lng', String(estate.lng));
    mapParams.set('zoom', '15');
  }
  const mapHref = dashboardHref(
    `/rental/properties/map?${mapParams.toString()}`,
  );
  const estateImages = (estate.images || []).flatMap((item, index) => {
    const source = item.thumbnail || item.url;
    if (typeof source !== 'string' || !source) return [];
    return [
      {
        key: String(item.media_id || index),
        src: source,
        previewSrc:
          typeof item.url === 'string' && item.url ? item.url : source,
        alt:
          typeof item.label === 'string' && item.label
            ? item.label
            : `${estateName} 图片 ${index + 1}`,
      },
    ];
  });
  const summaryFacts = [
    ['楼栋', estate.building_count || 0],
    ['总房源', total],
    ['已租', rented],
    ['空置', counts?.vacant || 0],
    ['招租', counts?.listed || 0],
    ['装修', counts?.renovating || 0],
  ];

  return (
    <TenantSelectionGuard title={false}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card className={styles.bannerCard}>
          <div className={styles.bannerMedia}>
            {estateImages.length ? (
              <Image
                alt={estateImages[0].alt}
                src={estateImages[0].src}
                preview={false}
                width="100%"
                height={260}
              />
            ) : (
              <div
                className={styles.bannerFallback}
                data-testid="estate-no-image-state"
              >
                <AppIcon className={styles.bannerIcon} name="estate" />
              </div>
            )}
            <div className={styles.bannerBackdrop} />
            <div className={styles.bannerContent}>
              <div className={styles.bannerMain}>
                <Typography.Text className={styles.bannerEyebrow}>
                  小区项目总览
                </Typography.Text>
                <Typography.Title
                  level={2}
                  className={styles.bannerTitle}
                  style={{ margin: 0 }}
                >
                  {estateName}
                </Typography.Title>
                <div className={styles.bannerMeta}>
                  <Tag color="blue">
                    {estate.property_type__mapping ||
                      estate.property_type ||
                      '物业类型待补充'}
                  </Tag>
                  {estateImages.length ? (
                    <Tag>{estateImages.length} 张项目图片</Tag>
                  ) : null}
                </div>
                <div className={styles.bannerLocation}>
                  <AppIcon name="location" style={{ marginTop: 3 }} />
                  <span>{fullAddress || '小区地址待补充'}</span>
                </div>
              </div>
              <Space className={styles.bannerActions} wrap>
                <Button type="primary" icon={<EditOutlined />} href={editHref}>
                  编辑资料
                </Button>
                <Button href={mapHref}>在地图查看</Button>
              </Space>
            </div>
          </div>
          <section aria-label="小区经营指标" className={styles.metricStrip}>
            {[['出租率', `${rate(rented, rentable)}%`], ...summaryFacts].map(
              ([label, value]) => (
                <div key={String(label)} className={styles.metricItem}>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                  <span className={styles.metricValue}>{value}</span>
                </div>
              ),
            )}
          </section>
        </Card>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={7}>
            <Card title="项目档案" className={styles.projectCard}>
              <section aria-label="项目档案" className={styles.projectSection}>
                {[
                  ['展示名称', estateName],
                  ['项目名称', estate.name || '-'],
                  [
                    '物业类型',
                    estate.property_type__mapping ||
                      estate.property_type ||
                      '-',
                  ],
                  ['所在区域', region || '-'],
                  ['详细地址', estate.address || '-'],
                  [
                    '地图位置',
                    estate.lat == null || estate.lng == null
                      ? '待补充定位'
                      : '已维护定位',
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)} className={styles.projectItem}>
                    <Typography.Text type="secondary">{label}</Typography.Text>
                    <span className={styles.projectValue}>{value}</span>
                  </div>
                ))}
              </section>
            </Card>
          </Col>

          <Col xs={24} xl={17}>
            <Card
              title="楼栋经营"
              className={styles.buildingCard}
              extra={
                <Space wrap>
                  <a
                    href={dashboardHref(
                      `/rental/properties/estates?view=buildings&estate_id=${estate.id}`,
                    )}
                  >
                    查看全部楼栋
                  </a>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    href={createBuildingHref}
                  >
                    新建楼栋
                  </Button>
                </Space>
              }
            >
              <Table
                rowKey="id"
                loading={buildings.isLoading}
                dataSource={buildings.data?.items || []}
                locale={{ emptyText: '暂无楼栋，可新建楼栋' }}
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total: buildings.data?.total || 0,
                  onChange: setPage,
                }}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: '楼栋',
                    dataIndex: 'name',
                    render: (value, row) => (
                      <div>
                        <Link
                          className={styles.buildingName}
                          to={`/rental/properties/buildings/${row.id}`}
                        >
                          {value}
                        </Link>
                        <Typography.Text type="secondary">
                          {row.address || '地址待补充'}
                        </Typography.Text>
                      </div>
                    ),
                  },
                  {
                    title: '建筑配置',
                    key: 'configuration',
                    render: (_value, row) => (
                      <Space size={6} wrap>
                        <Tag>
                          {row.floors ? `${row.floors} 层` : '楼层待补充'}
                        </Tag>
                        <Tag>{row.elevator ? '有电梯' : '无电梯'}</Tag>
                      </Space>
                    ),
                  },
                  {
                    title: '房源概况',
                    key: 'inventory',
                    align: 'right',
                    render: (_value, row) => (
                      <Space size={12}>
                        <Typography.Text>
                          在管 {row.counts?.total || 0}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          空置 {row.counts?.vacant || 0}
                        </Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: '出租率',
                    key: 'rented-rate',
                    align: 'right',
                    render: (_value, row) => {
                      const rentedHouses = row.counts?.rented || 0;
                      const rentableHouses =
                        (row.counts?.vacant || 0) +
                        (row.counts?.listed || 0) +
                        rentedHouses;
                      return (
                        <div className={styles.progressCell}>
                          <Progress
                            percent={rate(rentedHouses, rentableHouses)}
                            size="small"
                          />
                          <Typography.Text type="secondary">
                            {rentedHouses} 套已租
                          </Typography.Text>
                        </div>
                      );
                    },
                  },
                  {
                    title: '楼栋标签',
                    dataIndex: 'tags',
                    render: (tags) =>
                      tags?.length ? (
                        <Space size={[4, 4]} wrap>
                          {tags.map((tag: string) => (
                            <Tag color="purple" key={tag}>
                              {tag}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        '-'
                      ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </TenantSelectionGuard>
  );
};

export default EstateDetailPage;
