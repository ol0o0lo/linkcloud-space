import { Line } from '@ant-design/plots';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { BuildingPreview, HousePreview } from '@/components/EntityPreview';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/space/shared';
import {
  type AnalyticsMetric,
  type AnalyticsQuery,
  type AnalyticsTargetMetric,
  getAnalyticsOverview,
  getAnalyticsTargets,
  getAnalyticsTrends,
} from '@/services/manual/analytics';

const { RangePicker } = DatePicker;
const IMPORTANT_EVENTS = [
  'house.view',
  'house.phone_click',
  'house.online_consult_click',
  'house.share',
];
const TREND_EVENTS = [
  'house.view',
  'house.phone_click',
  'house.online_consult_click',
  'viewing.requested',
  'lease.created',
];

function recentDaysRange(days: number): [Dayjs, Dayjs] {
  return [dayjs().subtract(days - 1, 'day'), dayjs()];
}

const DATE_RANGE_PRESETS = [
  { label: '今天', value: (): [Dayjs, Dayjs] => recentDaysRange(1) },
  { label: '近7天', value: (): [Dayjs, Dayjs] => recentDaysRange(7) },
  { label: '近30天', value: (): [Dayjs, Dayjs] => recentDaysRange(30) },
  {
    label: '本月',
    value: (): [Dayjs, Dayjs] => [dayjs().startOf('month'), dayjs()],
  },
];

function metricMap(metrics: AnalyticsMetric[] | undefined) {
  return new Map((metrics || []).map((metric) => [metric.event_name, metric]));
}

function conversionPercent(value: number, base: number) {
  if (!base) return 0;
  return Math.min(100, Math.round((value / base) * 1000) / 10);
}

function visitorValue(value: number | null | undefined) {
  return value ?? '—';
}

function entityId(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function trendDateTickFilter(
  _value: unknown,
  index: number,
  values: unknown[],
) {
  const maxLabels = 7;
  if (values.length <= maxLabels) return true;
  return Array.from({ length: maxLabels }, (_, tickIndex) =>
    Math.round((tickIndex * (values.length - 1)) / (maxLabels - 1)),
  ).includes(index);
}

function HouseRankingTarget({ record }: { record: AnalyticsTargetMetric }) {
  const building = record.display_items.find(
    (item) => item.target_type === 'building',
  );
  const house = record.display_items.find(
    (item) => item.target_type === 'house',
  );
  const buildingId = entityId(building?.target_id);
  const houseId = entityId(house?.target_id || record.target_id);
  const buildingName = building?.label;
  const roomNumber = house?.label;

  if (
    !buildingId ||
    !houseId ||
    typeof buildingName !== 'string' ||
    typeof roomNumber !== 'string'
  ) {
    return (
      <HousePreview id={houseId}>
        <Typography.Text>{record.label}</Typography.Text>
      </HousePreview>
    );
  }

  return (
    <Space size={4}>
      <BuildingPreview id={buildingId}>
        <Typography.Text>{buildingName}</Typography.Text>
      </BuildingPreview>
      <Typography.Text type="secondary">/</Typography.Text>
      <HousePreview id={houseId}>
        <Typography.Text>{roomNumber}</Typography.Text>
      </HousePreview>
    </Space>
  );
}

const AnalyticsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => recentDaysRange(30));
  const [source, setSource] = useState<string>();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const params: AnalyticsQuery = {
    start_date: range[0].format('YYYY-MM-DD'),
    end_date: range[1].format('YYYY-MM-DD'),
    source,
  };
  const queryScope = [
    workspace.selectedOrgSlug,
    ...range.map((item) => item.format('YYYY-MM-DD')),
    source,
  ];
  const overview = useQuery({
    queryKey: ['analytics', 'overview', ...queryScope],
    queryFn: () => getAnalyticsOverview(params),
    enabled,
  });
  const trends = useQuery({
    queryKey: ['analytics', 'trends', ...queryScope],
    queryFn: () =>
      getAnalyticsTrends({
        ...params,
        event_names: TREND_EVENTS.join(','),
      }),
    enabled,
  });
  const targets = useQuery({
    queryKey: ['analytics', 'targets', ...queryScope],
    queryFn: () =>
      getAnalyticsTargets({
        ...params,
        target_type: 'house',
        event_names: TREND_EVENTS.join(','),
        page: 1,
        page_size: 20,
      }),
    enabled,
  });

  const metrics = metricMap(overview.data?.metrics);
  const labels = new Map(
    (overview.data?.metrics || []).map((metric) => [
      metric.event_name,
      metric.label,
    ]),
  );
  const trendData = useMemo(
    () =>
      (trends.data || []).map((point) => ({
        ...point,
        label: labels.get(point.event_name) || point.event_name,
      })),
    [labels, trends.data],
  );
  const trendDateFormat =
    range[0].year() === range[1].year() ? 'MM-DD' : 'YY-MM-DD';
  const views = metrics.get('house.view')?.count || 0;
  const consultations =
    (metrics.get('house.phone_click')?.count || 0) +
    (metrics.get('house.online_consult_click')?.count || 0);
  const viewingRequests = metrics.get('viewing.requested')?.count || 0;
  const leases = metrics.get('lease.created')?.count || 0;
  const funnel = [
    { label: '浏览房源', value: views, percent: views ? 100 : 0 },
    {
      label: '发起咨询',
      value: consultations,
      percent: conversionPercent(consultations, views),
    },
    {
      label: '预约带看',
      value: viewingRequests,
      percent: conversionPercent(viewingRequests, consultations),
    },
    {
      label: '生成租约',
      value: leases,
      percent: conversionPercent(leases, viewingRequests),
    },
  ];
  const failed = overview.isError || trends.isError || targets.isError;
  const includesHistoricalData = range[0].isBefore(
    dayjs().subtract(29, 'day'),
    'day',
  );

  return (
    <TenantSelectionGuard title="经营分析">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card size="small">
          <Space wrap>
            <RangePicker
              allowClear={false}
              value={range}
              maxDate={dayjs()}
              presets={DATE_RANGE_PRESETS}
              onChange={(value) => {
                if (value?.[0] && value[1]) setRange([value[0], value[1]]);
              }}
            />
            <Select
              allowClear
              placeholder="全部来源"
              style={{ width: 160 }}
              value={source}
              onChange={setSource}
              options={[
                { label: 'H5', value: 'h5' },
                { label: '微信小程序', value: 'miniprogram' },
                { label: '公开页面', value: 'public' },
                { label: '管理端', value: 'admin' },
                { label: '服务端业务', value: 'server' },
              ]}
            />
            {includesHistoricalData ? (
              <Typography.Text type="secondary">
                超过近30天，区间访客数不提供。
              </Typography.Text>
            ) : null}
          </Space>
        </Card>

        {failed ? (
          <Alert
            showIcon
            type="error"
            title="经营分析数据加载失败"
            description="请确认当前角色拥有“查看经营分析”权限后重试。"
          />
        ) : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card loading={overview.isLoading}>
              <Statistic
                title="事件总量"
                value={overview.data?.total_events || 0}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card loading={overview.isLoading}>
              <Statistic
                title="独立访客"
                value={visitorValue(overview.data?.unique_visitors)}
              />
            </Card>
          </Col>
          {IMPORTANT_EVENTS.slice(0, 2).map((eventName) => {
            const metric = metrics.get(eventName);
            return (
              <Col key={eventName} xs={24} md={12} xl={6}>
                <Card loading={overview.isLoading}>
                  <Statistic
                    title={metric?.label || eventName}
                    value={metric?.count || 0}
                    suffix={
                      metric
                        ? ` / ${visitorValue(metric.unique_visitors)} 人`
                        : undefined
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card title="行为趋势" loading={trends.isLoading}>
              {trendData.some((item) => item.count > 0) ? (
                <Line
                  height={320}
                  data={trendData}
                  xField="date"
                  yField="count"
                  colorField="label"
                  shapeField="smooth"
                  axis={{
                    x: {
                      title: false,
                      tickFilter: trendDateTickFilter,
                      labelAutoHide: true,
                      labelAutoRotate: false,
                      labelFormatter: (value: string) =>
                        dayjs(value).format(trendDateFormat),
                    },
                    y: { title: false },
                  }}
                  legend={{ color: { layout: { justifyContent: 'center' } } }}
                />
              ) : (
                <Empty description="所选时间范围暂无行为数据" />
              )}
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card title="转化漏斗" loading={overview.isLoading}>
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                {funnel.map((step, index) => (
                  <div key={step.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Typography.Text>{step.label}</Typography.Text>
                      <Space size={4}>
                        <Typography.Text strong>{step.value}</Typography.Text>
                        {index ? (
                          <Tag color="blue">上一步 {step.percent}%</Tag>
                        ) : null}
                      </Space>
                    </div>
                    <Progress percent={step.percent} showInfo={false} />
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>

        <Card title="房源行为排行" loading={targets.isLoading}>
          <Table<AnalyticsTargetMetric>
            rowKey="target_id"
            dataSource={targets.data?.items || []}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无房源行为数据" /> }}
            columns={[
              {
                title: '房源',
                dataIndex: 'label',
                width: 220,
                render: (_, record) => <HouseRankingTarget record={record} />,
              },
              { title: '总行为', dataIndex: 'total', width: 100 },
              {
                title: '访客',
                dataIndex: 'unique_visitors',
                width: 100,
                render: visitorValue,
              },
              {
                title: '浏览',
                width: 100,
                render: (_, record) => record.metrics['house.view'] || 0,
              },
              {
                title: '咨询',
                width: 100,
                render: (_, record) =>
                  (record.metrics['house.phone_click'] || 0) +
                  (record.metrics['house.online_consult_click'] || 0),
              },
              {
                title: '带看',
                width: 100,
                render: (_, record) => record.metrics['viewing.requested'] || 0,
              },
              {
                title: '租约',
                width: 100,
                render: (_, record) => record.metrics['lease.created'] || 0,
              },
            ]}
          />
        </Card>
      </Space>
    </TenantSelectionGuard>
  );
};

export default AnalyticsPage;
