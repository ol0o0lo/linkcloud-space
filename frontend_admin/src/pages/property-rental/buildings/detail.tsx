import {
  ApartmentOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PictureOutlined,
  PlusOutlined,
} from '@ant-design/icons';
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
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import { houseDisplayTags, moneyText, STATUS_COLOR } from '../constants';
import { safeMapReturnTo } from './detail-utils';

const PAGE_SIZE = 20;

const useStyles = createStyles(({ css, token }) => ({
  headerCard: css`
    .ant-card-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 20px 24px;

      @media (max-width: 767px) {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
  headerIdentity: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 16px;
  `,
  headerIcon: css`
    display: flex;
    width: 54px;
    height: 54px;
    flex: 0 0 54px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusLG}px;
    color: ${token.colorPrimary};
    font-size: 26px;
    background: ${token.colorPrimaryBg};
  `,
  headerMain: css`
    min-width: 0;
  `,
  hierarchyLine: css`
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 5px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  titleLine: css`
    display: flex;
    min-width: 0;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 10px;
  `,
  locationLine: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    color: ${token.colorTextSecondary};
  `,
  profileCard: css`
    height: 100%;

    .ant-card-body {
      padding: 0;
    }
  `,
  profileMedia: css`
    position: relative;
    height: 220px;
    overflow: hidden;
    background: ${token.colorFillSecondary};

    .ant-image {
      display: block;
    }
  `,
  imageCount: css`
    position: absolute;
    z-index: 2;
    top: 16px;
    left: 16px;
    margin: 0;
    color: ${token.colorTextLightSolid};
    border: 0;
    background: ${token.colorBgMask};
  `,
  profileThumbs: css`
    position: absolute;
    z-index: 2;
    right: 12px;
    bottom: 12px;
    display: flex;
    max-width: calc(100% - 24px);
    gap: 6px;
    overflow-x: auto;

    .ant-image {
      flex: 0 0 auto;
      overflow: hidden;
      border: 2px solid ${token.colorBgContainer};
      border-radius: ${token.borderRadiusSM}px;
      background: ${token.colorBgContainer};
    }
  `,
  profilePlaceholder: css`
    display: flex;
    height: 220px;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    background: linear-gradient(
      145deg,
      ${token.colorFillQuaternary},
      ${token.colorPrimaryBg}
    );
  `,
  emptyMediaIcon: css`
    color: ${token.colorPrimary};
    font-size: 44px;
  `,
  profileBody: css`
    padding: 20px;
  `,
  profileSection: css`
    padding-bottom: 18px;
    margin-bottom: 18px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  profileAddress: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    color: ${token.colorTextSecondary};
  `,
  profileMetaGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  `,
  profileMetaItem: css`
    padding: 12px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  profileMetaValue: css`
    display: block;
    margin-top: 3px;
    color: ${token.colorText};
    font-weight: ${token.fontWeightStrong};
  `,
  tagsBlock: css`
    margin-top: 18px;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  operationsCard: css`
    height: 100%;
  `,
  operationsBody: css`
    display: grid;
    grid-template-columns: minmax(190px, 0.75fr) minmax(0, 1.6fr);
    min-height: 430px;
    align-items: center;
    gap: 28px;

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
      min-height: auto;
    }
  `,
  rentRatePanel: css`
    display: flex;
    min-height: 280px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorPrimaryBg};
  `,
  rateCaption: css`
    margin-top: 12px;
    text-align: center;
  `,
  inventoryGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 575px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  inventoryMetric: css`
    min-width: 0;
    padding: 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  inventoryValue: css`
    display: block;
    margin-top: 8px;
    color: ${token.colorText};
    font-size: 24px;
    font-weight: ${token.fontWeightStrong};
  `,
}));

function rate(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function dashboardHref(path: string) {
  return `/dashboard${path}`;
}

const BuildingDetailPage: React.FC = () => {
  const { styles } = useStyles();
  const { id } = useParams();
  const workspace = useTenantWorkspace();
  const buildingId = Number(id);
  const [page, setPage] = useState(1);
  const enabled = Boolean(workspace.selectedOrgSlug && buildingId);
  const detail = useQuery({
    queryKey: ['building-detail', workspace.selectedOrgSlug, buildingId],
    queryFn: () => houseApi.getBuilding(buildingId),
    enabled,
  });
  const houses = useQuery({
    queryKey: [
      'building-detail-houses',
      workspace.selectedOrgSlug,
      buildingId,
      page,
    ],
    queryFn: () =>
      houseApi.listHouses({
        building_id: buildingId,
        page,
        page_size: PAGE_SIZE,
      }),
    enabled,
  });
  const returnTo = safeMapReturnTo(
    new URLSearchParams(window.location.search).get('return_to'),
  );

  if (detail.isLoading) return <Card loading style={{ minHeight: 360 }} />;
  if (!detail.data) return <Empty description="未找到楼栋" />;

  const building = detail.data;
  const estateName = building.estate?.display_name || building.estate?.name;
  const counts = building.counts;
  const total = counts?.total || 0;
  const rented = counts?.rented || 0;
  const rentable = (counts?.vacant || 0) + (counts?.listed || 0) + rented;
  const editHref = dashboardHref(
    `/property-rental/estates?view=buildings&building_edit=${building.id}`,
  );
  const buildingImages = (building.images || []).flatMap((item, index) => {
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
            : `楼栋外观 ${index + 1}`,
      },
    ];
  });
  const summaryFacts = [
    ['总房源', total],
    ['已租', rented],
    ['空置', counts?.vacant || 0],
    ['招租中', counts?.listed || 0],
    ['装修中', counts?.renovating || 0],
  ];

  return (
    <TenantSelectionGuard title={false}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card className={styles.headerCard}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerIcon}>
              <ApartmentOutlined />
            </div>
            <div className={styles.headerMain}>
              <div className={styles.hierarchyLine}>
                {building.estate ? (
                  <Link to={`/property-rental/estates/${building.estate.id}`}>
                    {estateName}
                  </Link>
                ) : (
                  <span>未关联小区</span>
                )}
                <span>/</span>
                <span>楼栋档案</span>
              </div>
              <div className={styles.titleLine}>
                <Typography.Title level={2} style={{ margin: 0 }}>
                  {building.name}
                </Typography.Title>
                {building.floors ? <Tag>{building.floors} 层</Tag> : null}
                <Tag>{building.elevator ? '有电梯' : '无电梯'}</Tag>
              </div>
              <div className={styles.locationLine}>
                <EnvironmentOutlined style={{ marginTop: 3 }} />
                <span>{building.address || '楼栋地址待补充'}</span>
              </div>
            </div>
          </div>
          <Space wrap>
            <Button type="primary" icon={<EditOutlined />} href={editHref}>
              编辑资料
            </Button>
            <Button href={returnTo}>返回地图</Button>
          </Space>
        </Card>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={9}>
            <Card title="楼栋名片" className={styles.profileCard}>
              {buildingImages.length ? (
                <div className={styles.profileMedia}>
                  <Image.PreviewGroup>
                    <Image
                      alt={buildingImages[0].alt}
                      src={buildingImages[0].src}
                      preview={{ src: buildingImages[0].previewSrc }}
                      width="100%"
                      height={220}
                      styles={{
                        root: { display: 'block', width: '100%' },
                        image: { objectFit: 'cover' },
                      }}
                    />
                    {buildingImages.length > 1 ? (
                      <div className={styles.profileThumbs}>
                        {buildingImages.slice(1, 5).map((image) => (
                          <Image
                            key={image.key}
                            alt={image.alt}
                            src={image.src}
                            preview={{ src: image.previewSrc }}
                            width={46}
                            height={46}
                            styles={{ image: { objectFit: 'cover' } }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </Image.PreviewGroup>
                  <Tag className={styles.imageCount}>
                    {buildingImages.length} 张照片
                  </Tag>
                </div>
              ) : (
                <div
                  className={styles.profilePlaceholder}
                  data-testid="building-no-image-state"
                >
                  <Space orientation="vertical" align="center" size={8}>
                    <PictureOutlined className={styles.emptyMediaIcon} />
                    <Typography.Text strong>楼栋图片待补充</Typography.Text>
                    <Button size="small" href={editHref}>
                      添加楼栋图片
                    </Button>
                  </Space>
                </div>
              )}

              <section aria-label="楼栋名片" className={styles.profileBody}>
                <div className={styles.profileSection}>
                  <Typography.Text type="secondary">所属小区</Typography.Text>
                  <div style={{ marginTop: 4 }}>
                    {building.estate ? (
                      <Link
                        to={`/property-rental/estates/${building.estate.id}`}
                      >
                        {estateName}
                      </Link>
                    ) : (
                      '未关联小区'
                    )}
                  </div>
                  <div className={styles.profileAddress}>
                    <EnvironmentOutlined style={{ marginTop: 3 }} />
                    <span>{building.address || '楼栋地址待补充'}</span>
                  </div>
                </div>

                <div className={styles.profileMetaGrid}>
                  {[
                    [
                      '地上楼层',
                      building.floors ? `${building.floors} 层` : '-',
                    ],
                    [
                      '地下楼层',
                      building.under_floors
                        ? `${building.under_floors} 层`
                        : '-',
                    ],
                    [
                      '建成年份',
                      building.year_built ? `${building.year_built} 年` : '-',
                    ],
                    ['电梯配置', building.elevator ? '有电梯' : '无电梯'],
                  ].map(([label, value]) => (
                    <div key={String(label)} className={styles.profileMetaItem}>
                      <Typography.Text type="secondary">
                        {label}
                      </Typography.Text>
                      <span className={styles.profileMetaValue}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.tagsBlock}>
                  <Typography.Text type="secondary">楼栋标签</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    {building.tags?.length ? (
                      <Space size={[6, 6]} wrap>
                        {building.tags.map((tag) => (
                          <Tag color="purple" key={tag}>
                            {tag}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">
                        暂无楼栋标签
                      </Typography.Text>
                    )}
                  </div>
                </div>
              </section>
            </Card>
          </Col>

          <Col xs={24} xl={15}>
            <Card title="运营仪表盘" className={styles.operationsCard}>
              <section
                aria-label="运营仪表盘"
                className={styles.operationsBody}
              >
                <div className={styles.rentRatePanel}>
                  <Progress
                    type="dashboard"
                    percent={rate(rented, rentable)}
                    size={180}
                    strokeColor={{
                      '0%': '#1677ff',
                      '100%': '#52c41a',
                    }}
                  />
                  <div className={styles.rateCaption}>
                    <Typography.Text strong>当前出租率</Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {rented} 套已租 / {rentable} 套可出租库存
                    </Typography.Text>
                  </div>
                </div>
                <div className={styles.inventoryGrid}>
                  {summaryFacts.map(([label, value]) => (
                    <div key={String(label)} className={styles.inventoryMetric}>
                      <Typography.Text type="secondary">
                        {label}
                      </Typography.Text>
                      <span className={styles.inventoryValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </Card>
          </Col>
        </Row>

        <Card
          title="房源列表"
          extra={
            <Space wrap>
              <a
                href={dashboardHref(
                  `/property-rental/houses?building_id=${building.id}`,
                )}
              >
                查看全部房源
              </a>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                href={dashboardHref(
                  `/property-rental/houses/new?building_id=${building.id}`,
                )}
              >
                登记房源
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            loading={houses.isLoading}
            dataSource={houses.data?.items || []}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: houses.data?.total || 0,
              onChange: setPage,
            }}
            locale={{ emptyText: '暂无房源，可登记房源' }}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: '房号',
                dataIndex: 'room_number',
                render: (value, row) => (
                  <a
                    href={dashboardHref(`/property-rental/houses/${row.id}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {value}
                  </a>
                ),
              },
              {
                title: '楼层',
                dataIndex: 'floor',
                render: (value) => value ?? '-',
              },
              {
                title: '房态',
                dataIndex: 'status__mapping',
                render: (value, row) => (
                  <Tag color={STATUS_COLOR[row.status]}>
                    {value || row.status || '-'}
                  </Tag>
                ),
              },
              {
                title: '租金',
                dataIndex: 'asking_rent',
                render: (value) => moneyText(value),
              },
              {
                title: '标签',
                dataIndex: 'effective_tags',
                render: (_value, record) => {
                  const tags = houseDisplayTags(record);
                  return tags.length ? (
                    <Space size={[4, 4]} wrap>
                      {tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  ) : (
                    '-'
                  );
                },
              },
              {
                title: '操作',
                key: 'actions',
                fixed: 'right',
                render: (_value, row) => (
                  <a
                    href={dashboardHref(`/property-rental/houses/${row.id}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    新窗口查看
                  </a>
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </TenantSelectionGuard>
  );
};

export default BuildingDetailPage;
