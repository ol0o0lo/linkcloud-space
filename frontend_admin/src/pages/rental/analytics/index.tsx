import {
  BarChartOutlined,
  CalendarOutlined,
  EyeOutlined,
  FunnelPlotOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PhoneOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Area } from '@ant-design/plots';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { BuildingPreview, HousePreview } from '@/components/EntityPreview';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  type AnalyticsMetric,
  type AnalyticsQuery,
  type AnalyticsTargetMetric,
  type AnalyticsTrendPoint,
  getAnalyticsOverview,
  getAnalyticsSources,
  getAnalyticsTargets,
  getAnalyticsTrends,
} from '@/services/manual/analytics';
import {
  ANALYTICS_MAX_RANGE_DAYS,
  ANALYTICS_PAGE_SIZE_OPTIONS,
  buildAnalyticsSearch,
  getAnalyticsSearchState,
} from './state';
import { useStyles } from './styles';

const { RangePicker } = DatePicker;
const TREND_EVENTS = [
  'house.view',
  'house.phone_click',
  'house.online_consult_click',
  'viewing.requested',
  'lease.created',
];
const TREND_FILTER_OPTIONS = [
  { label: '浏览', value: 'house.view' },
  { label: '电话咨询', value: 'house.phone_click' },
  { label: '在线咨询', value: 'house.online_consult_click' },
  { label: '带看', value: 'viewing.requested' },
  { label: '租约', value: 'lease.created' },
];
const ANALYTICS_PANEL_CONTENT_HEIGHT = 320;
const VISITOR_UNAVAILABLE_HINT = '历史汇总无法跨日去重，因此不提供区间访客数';

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

function behaviorPercent(value: number, base: number) {
  if (!base) return null;
  return Math.round((value / base) * 1000) / 10;
}

function dailyTrendValues(
  points: AnalyticsTrendPoint[] | undefined,
  eventNames: string[],
) {
  const values = new Map<string, number>();
  for (const point of points || []) {
    if (!eventNames.includes(point.event_name)) continue;
    values.set(point.date, (values.get(point.date) || 0) + point.count);
  }
  return [...values.entries()]
    .toSorted(([first], [second]) => first.localeCompare(second))
    .map(([, value]) => value);
}

function MiniTrend({
  className,
  values,
}: {
  className?: string;
  values: number[];
}) {
  if (values.length < 2 || !values.some((value) => value > 0)) return null;
  const width = 92;
  const height = 30;
  const padding = 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const linePoints = values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = range
        ? height - padding - ((value - min) / range) * (height - padding * 2)
        : height / 2;
      return `${x},${y}`;
    })
    .join(' ');
  const areaPoints = `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`;

  return (
    <svg
      aria-hidden
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <title>近期趋势</title>
      <polygon points={areaPoints} fill="currentColor" opacity="0.1" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

function VisitorValue({
  value,
  suffix,
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  if (value !== null && value !== undefined) {
    return (
      <span>
        {value}
        {suffix}
      </span>
    );
  }
  return (
    <Tooltip title={VISITOR_UNAVAILABLE_HINT}>
      <Typography.Text type="secondary">—{suffix}</Typography.Text>
    </Tooltip>
  );
}

function ModuleError({
  className,
  description,
  loading,
  onRetry,
}: {
  className?: string;
  description: string;
  loading: boolean;
  onRetry: () => unknown;
}) {
  return (
    <div className={className}>
      <Alert
        showIcon
        type="error"
        title="加载失败"
        description={description}
        action={
          <Button size="small" onClick={() => void onRetry()} loading={loading}>
            重新加载
          </Button>
        }
      />
    </div>
  );
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
  const { styles } = useStyles();
  const { token } = theme.useToken();
  const workspace = useTenantWorkspace();
  const [initialSearchState] = useState(() =>
    getAnalyticsSearchState(
      typeof window === 'undefined' ? '' : window.location.search,
    ),
  );
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs(initialSearchState.startDate),
    dayjs(initialSearchState.endDate),
  ]);
  const [source, setSource] = useState<string | undefined>(
    initialSearchState.source,
  );
  const [page, setPage] = useState(initialSearchState.page);
  const [pageSize, setPageSize] = useState(initialSearchState.pageSize);
  const [trendEvent, setTrendEvent] = useState('house.view');
  const enabled = Boolean(workspace.selectedOrgSlug);
  const startDate = range[0].format('YYYY-MM-DD');
  const endDate = range[1].format('YYYY-MM-DD');
  const params: AnalyticsQuery = {
    start_date: startDate,
    end_date: endDate,
    source,
  };
  const queryScope = [workspace.selectedOrgSlug, startDate, endDate, source];
  const sources = useQuery({
    queryKey: ['analytics', 'sources', workspace.selectedOrgSlug],
    queryFn: getAnalyticsSources,
    enabled,
    staleTime: 10 * 60 * 1000,
  });
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
    queryKey: ['analytics', 'targets', ...queryScope, page, pageSize],
    queryFn: () =>
      getAnalyticsTargets({
        ...params,
        target_type: 'house',
        event_names: TREND_EVENTS.join(','),
        page,
        page_size: pageSize,
      }),
    enabled,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextSearch = buildAnalyticsSearch(window.location.search, {
      startDate,
      endDate,
      source,
      page,
      pageSize,
    });
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [endDate, page, pageSize, source, startDate]);

  useEffect(() => {
    if (
      sources.isSuccess &&
      source &&
      !sources.data.some((option) => option.value === source)
    ) {
      setSource(undefined);
      setPage(1);
    }
  }, [source, sources.data, sources.isSuccess]);

  useEffect(() => {
    if (sources.isError && !sources.data && source) {
      setSource(undefined);
      setPage(1);
    }
  }, [source, sources.data, sources.isError]);

  useEffect(() => {
    if (!targets.data || targets.data.items.length > 0) return;
    const lastPage = Math.max(1, Math.ceil(targets.data.total / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [page, pageSize, targets.data]);

  const metrics = metricMap(overview.data?.metrics);
  const trendData = useMemo(() => {
    const labels = new Map(
      (overview.data?.metrics || []).map((metric) => [
        metric.event_name,
        metric.label,
      ]),
    );
    return (trends.data || []).map((point) => ({
      ...point,
      label: labels.get(point.event_name) || point.event_name,
    }));
  }, [overview.data?.metrics, trends.data]);
  const selectedTrendData = trendData.filter(
    (point) => point.event_name === trendEvent,
  );
  const selectedTrendLabel =
    metrics.get(trendEvent)?.label ||
    TREND_FILTER_OPTIONS.find((option) => option.value === trendEvent)?.label ||
    trendEvent;
  const selectedTrendTotal = selectedTrendData.reduce(
    (total, point) => total + point.count,
    0,
  );
  const trendDateFormat =
    range[0].year() === range[1].year() ? 'MM-DD' : 'YY-MM-DD';
  const views = metrics.get('house.view')?.count || 0;
  const consultations =
    (metrics.get('house.phone_click')?.count || 0) +
    (metrics.get('house.online_consult_click')?.count || 0);
  const viewingRequests = metrics.get('viewing.requested')?.count || 0;
  const leases = metrics.get('lease.created')?.count || 0;
  const behaviorValues = [views, consultations, viewingRequests, leases];
  const maxBehaviorValue = Math.max(...behaviorValues, 0);
  const behaviorPath = [
    {
      label: '浏览房源',
      value: views,
      previousPercent: null,
    },
    {
      label: '发起咨询',
      value: consultations,
      previousPercent: behaviorPercent(consultations, views),
    },
    {
      label: '预约带看',
      value: viewingRequests,
      previousPercent: behaviorPercent(viewingRequests, consultations),
    },
    {
      label: '生成租约',
      value: leases,
      previousPercent: behaviorPercent(leases, viewingRequests),
    },
  ].map((step) => ({
    ...step,
    barPercent: maxBehaviorValue
      ? Math.round((step.value / maxBehaviorValue) * 1000) / 10
      : 0,
  }));
  const houseViewMetric = metrics.get('house.view');
  const phoneClickMetric = metrics.get('house.phone_click');
  const includesHistoricalData = range[0].isBefore(
    dayjs().subtract(29, 'day'),
    'day',
  );
  const totalTrend = dailyTrendValues(trends.data, TREND_EVENTS);
  const houseViewTrend = dailyTrendValues(trends.data, ['house.view']);
  const phoneClickTrend = dailyTrendValues(trends.data, ['house.phone_click']);
  const summaryCards: Array<{
    key: string;
    title: string;
    value: number;
    icon: React.ReactNode;
    hint: string;
    formatter?: () => React.ReactNode;
    suffix?: React.ReactNode;
    trend?: number[];
  }> = [
    {
      key: 'total-events',
      title: '事件总量',
      value: overview.data?.total_events || 0,
      icon: <ThunderboltOutlined aria-hidden />,
      hint: '核心行为走势',
      trend: totalTrend,
    },
    {
      key: 'unique-visitors',
      title: '独立访客',
      value: overview.data?.unique_visitors ?? 0,
      formatter:
        overview.data?.unique_visitors === null
          ? () => <VisitorValue value={null} />
          : undefined,
      icon: <UserOutlined aria-hidden />,
      hint: includesHistoricalData ? '历史区间不可去重' : '所选区间去重',
    },
    {
      key: 'house-views',
      title: houseViewMetric?.label || '房源浏览',
      value: houseViewMetric?.count || 0,
      suffix: houseViewMetric ? (
        <span className={styles.visitorSuffix}>
          /{' '}
          <VisitorValue value={houseViewMetric.unique_visitors} suffix=" 人" />
        </span>
      ) : undefined,
      icon: <EyeOutlined aria-hidden />,
      hint: '房源访问行为',
      trend: houseViewTrend,
    },
    {
      key: 'phone-clicks',
      title: phoneClickMetric?.label || '电话咨询点击',
      value: phoneClickMetric?.count || 0,
      suffix: phoneClickMetric ? (
        <span className={styles.visitorSuffix}>
          /{' '}
          <VisitorValue value={phoneClickMetric.unique_visitors} suffix=" 人" />
        </span>
      ) : undefined,
      icon: <PhoneOutlined aria-hidden />,
      hint: '电话咨询意向',
      trend: phoneClickTrend,
    },
  ];
  const hasSelectedTrendData = selectedTrendData.some((item) => item.count > 0);
  const maxTargetTotal = Math.max(
    ...(targets.data?.items || []).map((item) => item.total),
    1,
  );
  const updatedTimes = [
    overview.dataUpdatedAt,
    trends.dataUpdatedAt,
    targets.dataUpdatedAt,
  ];
  const updatedAt = updatedTimes.every((value) => value > 0)
    ? Math.min(...updatedTimes)
    : undefined;
  const refreshing =
    overview.isRefetching || trends.isRefetching || targets.isRefetching;

  const refreshAnalytics = () =>
    Promise.all([overview.refetch(), trends.refetch(), targets.refetch()]);

  return (
    <TenantSelectionGuard title="经营分析">
      <div className={styles.page}>
        <Card size="small" className={styles.filterCard}>
          <BarChartOutlined className={styles.filterDecoration} aria-hidden />
          <div className={styles.filterContent}>
            <div className={styles.filterIdentity}>
              <span className={styles.filterIcon}>
                <CalendarOutlined aria-hidden />
              </span>
              <div>
                <Typography.Text className={styles.filterTitle}>
                  分析范围
                </Typography.Text>
                <Typography.Text className={styles.filterHint}>
                  按时间与访问来源筛选经营数据
                </Typography.Text>
              </div>
            </div>
            <div className={styles.filterActions}>
              <div className={styles.refreshControls}>
                {updatedAt ? (
                  <Typography.Text
                    type="secondary"
                    className={styles.updatedAt}
                  >
                    更新于 {dayjs(updatedAt).format('HH:mm:ss')}
                  </Typography.Text>
                ) : null}
                <Button
                  icon={<ReloadOutlined />}
                  loading={refreshing}
                  onClick={() => void refreshAnalytics()}
                >
                  刷新数据
                </Button>
              </div>
              <div className={styles.filterControls}>
                {includesHistoricalData ? (
                  <Tooltip title={VISITOR_UNAVAILABLE_HINT}>
                    <Typography.Text className={styles.historicalHint}>
                      超过近30天，区间访客数不提供
                    </Typography.Text>
                  </Tooltip>
                ) : null}
                <Select
                  aria-label="访问来源"
                  allowClear
                  placeholder="全部来源"
                  className={styles.sourceSelect}
                  value={source}
                  onChange={(value) => {
                    setSource(value);
                    setPage(1);
                  }}
                  options={sources.data || []}
                  loading={sources.isLoading}
                  disabled={sources.isError && !sources.data}
                  status={sources.isError ? 'error' : undefined}
                />
                {sources.isError ? (
                  <Space size={2}>
                    <Typography.Text
                      type="danger"
                      className={styles.sourceError}
                    >
                      来源加载失败
                    </Typography.Text>
                    <Button
                      size="small"
                      type="link"
                      loading={sources.isRefetching}
                      onClick={() => void sources.refetch()}
                    >
                      重试
                    </Button>
                  </Space>
                ) : null}
                <RangePicker
                  allowClear={false}
                  value={range}
                  maxDate={dayjs()}
                  presets={DATE_RANGE_PRESETS}
                  disabledDate={(current, info) =>
                    current.isAfter(dayjs(), 'day') ||
                    Boolean(
                      info.from &&
                        Math.abs(current.diff(info.from, 'day')) >=
                          ANALYTICS_MAX_RANGE_DAYS,
                    )
                  }
                  onChange={(value) => {
                    if (!value?.[0] || !value[1]) return;
                    const nextRange: [Dayjs, Dayjs] = [value[0], value[1]];
                    if (
                      nextRange[1].isAfter(dayjs(), 'day') ||
                      nextRange[1].diff(nextRange[0], 'day') + 1 >
                        ANALYTICS_MAX_RANGE_DAYS
                    ) {
                      return;
                    }
                    setRange(nextRange);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          {overview.isError ? (
            <Col span={24}>
              <ModuleError
                className={styles.summaryError}
                description="概览指标加载失败，请稍后重试。"
                loading={overview.isRefetching}
                onRetry={overview.refetch}
              />
            </Col>
          ) : (
            summaryCards.map((item) => (
              <Col key={item.key} xs={24} md={12} xl={6}>
                <Card
                  className={styles.metricCard}
                  loading={overview.isLoading}
                >
                  <Statistic
                    title={
                      <span className={styles.metricTitle}>
                        <span className={styles.metricIcon}>{item.icon}</span>
                        <span>{item.title}</span>
                      </span>
                    }
                    value={item.value}
                    formatter={item.formatter}
                    suffix={item.suffix}
                  />
                  <div className={styles.metricMeta}>
                    <Typography.Text className={styles.metricHint}>
                      {item.hint}
                    </Typography.Text>
                    {item.trend ? (
                      <MiniTrend
                        className={styles.metricSparkline}
                        values={item.trend}
                      />
                    ) : null}
                  </div>
                </Card>
              </Col>
            ))
          )}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card
              className={styles.sectionCard}
              title={
                <span className={styles.sectionTitle}>
                  <span className={styles.sectionTitleIcon}>
                    <LineChartOutlined aria-hidden />
                  </span>
                  <span>行为趋势</span>
                </span>
              }
              extra={
                <span className={styles.sectionExtra}>
                  {selectedTrendLabel} · 按日统计
                </span>
              }
              loading={trends.isLoading}
            >
              <div
                className={styles.chartStage}
                style={{ height: ANALYTICS_PANEL_CONTENT_HEIGHT }}
              >
                {trends.isError ? (
                  <ModuleError
                    className={styles.moduleError}
                    description="行为趋势加载失败，请稍后重试。"
                    loading={trends.isRefetching}
                    onRetry={trends.refetch}
                  />
                ) : (
                  <>
                    <div className={styles.chartToolbar}>
                      <Segmented
                        aria-label="趋势指标"
                        className={styles.trendSegmented}
                        size="small"
                        value={trendEvent}
                        options={TREND_FILTER_OPTIONS}
                        onChange={(value) => setTrendEvent(String(value))}
                      />
                      <div className={styles.chartSummary}>
                        <Typography.Text type="secondary">
                          区间累计
                        </Typography.Text>
                        <Typography.Text strong>
                          {selectedTrendTotal.toLocaleString()} 次
                        </Typography.Text>
                      </div>
                    </div>
                    <div className={styles.chartCanvas}>
                      {hasSelectedTrendData ? (
                        <Area
                          height={258}
                          data={selectedTrendData}
                          xField="date"
                          yField="count"
                          shapeField="smooth"
                          style={{
                            fill: `linear-gradient(-90deg, ${token.colorBgContainer} 0%, ${token.colorPrimary} 100%)`,
                            fillOpacity: 0.18,
                            stroke: token.colorPrimary,
                            lineWidth: 2.2,
                          }}
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
                        />
                      ) : (
                        <div className={styles.emptyStage}>
                          <Empty
                            description={
                              <div className={styles.emptyCopy}>
                                <span>该指标暂无行为数据</span>
                                <Typography.Text type="secondary">
                                  可切换其他指标或调整分析范围
                                </Typography.Text>
                              </div>
                            }
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card
              className={styles.sectionCard}
              title={
                <span className={styles.sectionTitle}>
                  <span className={styles.sectionTitleIcon}>
                    <FunnelPlotOutlined aria-hidden />
                  </span>
                  <span>业务行为路径</span>
                </span>
              }
              extra={
                <Space size={5} className={styles.sectionExtra}>
                  <Tooltip title="反映行为量级，不代表同一访客的连续转化">
                    <InfoCircleOutlined aria-label="统计口径说明" />
                  </Tooltip>
                  <span>按行为次数统计</span>
                </Space>
              }
              loading={overview.isLoading}
            >
              <div
                className={styles.funnelStage}
                style={{ height: ANALYTICS_PANEL_CONTENT_HEIGHT }}
              >
                {overview.isError ? (
                  <ModuleError
                    className={styles.moduleError}
                    description="业务行为路径加载失败，请稍后重试。"
                    loading={overview.isRefetching}
                    onRetry={overview.refetch}
                  />
                ) : (
                  <div className={styles.funnelList}>
                    {behaviorPath.map((step, index) => {
                      const ratioTag = index ? (
                        <Tag
                          className={styles.funnelRatio}
                          color={
                            step.previousPercent !== null &&
                            step.previousPercent > 100
                              ? 'warning'
                              : 'blue'
                          }
                        >
                          上一步{' '}
                          {step.previousPercent === null
                            ? '—'
                            : `${step.previousPercent}%`}
                        </Tag>
                      ) : null;
                      return (
                        <div key={step.label} className={styles.funnelStep}>
                          <span className={styles.funnelIndex}>
                            {index + 1}
                          </span>
                          <div className={styles.funnelContent}>
                            <div className={styles.funnelHeader}>
                              <Typography.Text>{step.label}</Typography.Text>
                              <Space size={4}>
                                <Typography.Text strong>
                                  {step.value}
                                </Typography.Text>
                                {step.previousPercent !== null &&
                                step.previousPercent > 100 ? (
                                  <Tooltip title="该行为次数高于上一步，可能来自不同访客或不同时间的累计">
                                    {ratioTag}
                                  </Tooltip>
                                ) : (
                                  ratioTag
                                )}
                              </Space>
                            </div>
                            <Progress
                              percent={step.barPercent}
                              showInfo={false}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          className={styles.rankingCard}
          title={
            <span className={styles.sectionTitle}>
              <span className={styles.sectionTitleIcon}>
                <TrophyOutlined aria-hidden />
              </span>
              <span>房源行为排行</span>
            </span>
          }
          extra={
            <span className={styles.sectionExtra}>
              共 {targets.data?.total || 0} 套房源
            </span>
          }
        >
          {targets.isError ? (
            <ModuleError
              className={styles.rankingError}
              description="房源行为排行加载失败，请稍后重试。"
              loading={targets.isRefetching}
              onRetry={targets.refetch}
            />
          ) : (
            <Table<AnalyticsTargetMetric>
              rowKey="target_id"
              loading={targets.isLoading}
              dataSource={targets.data?.items || []}
              pagination={{
                current: page,
                pageSize,
                total: targets.data?.total || 0,
                showSizeChanger: true,
                pageSizeOptions: [...ANALYTICS_PAGE_SIZE_OPTIONS],
                showTotal: (total) => `共 ${total} 套房源`,
              }}
              onChange={(pagination) => {
                const nextPageSize = pagination.pageSize || pageSize;
                setPageSize(nextPageSize);
                setPage(
                  nextPageSize !== pageSize ? 1 : pagination.current || 1,
                );
              }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="暂无房源行为数据" /> }}
              columns={[
                {
                  title: '排名',
                  width: 72,
                  align: 'center',
                  render: (_, _record, index) => {
                    const rank = (page - 1) * pageSize + index + 1;
                    return (
                      <span
                        className={[
                          styles.rankBadge,
                          rank <= 3 ? styles.rankBadgeTop : '',
                          rank === 1 ? styles.rankBadgeFirst : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {rank}
                      </span>
                    );
                  },
                },
                {
                  title: '房源',
                  dataIndex: 'label',
                  width: 220,
                  render: (_, record) => <HouseRankingTarget record={record} />,
                },
                {
                  title: '总行为',
                  dataIndex: 'total',
                  width: 150,
                  align: 'right',
                  render: (value: number) => (
                    <div className={styles.totalMetric}>
                      <Typography.Text strong>{value}</Typography.Text>
                      <span className={styles.totalBarTrack} aria-hidden>
                        <span
                          className={styles.totalBarValue}
                          style={{
                            width: `${(value / maxTargetTotal) * 100}%`,
                          }}
                        />
                      </span>
                    </div>
                  ),
                },
                {
                  title: (
                    <Tooltip title={VISITOR_UNAVAILABLE_HINT}>
                      <span>访客</span>
                    </Tooltip>
                  ),
                  dataIndex: 'unique_visitors',
                  width: 100,
                  align: 'right',
                  render: (value) => <VisitorValue value={value} />,
                },
                {
                  title: '浏览',
                  width: 100,
                  align: 'right',
                  render: (_, record) => record.metrics['house.view'] || 0,
                },
                {
                  title: '咨询',
                  width: 100,
                  align: 'right',
                  render: (_, record) =>
                    (record.metrics['house.phone_click'] || 0) +
                    (record.metrics['house.online_consult_click'] || 0),
                },
                {
                  title: '带看',
                  width: 100,
                  align: 'right',
                  render: (_, record) =>
                    record.metrics['viewing.requested'] || 0,
                },
                {
                  title: '租约',
                  width: 100,
                  align: 'right',
                  render: (_, record) => record.metrics['lease.created'] || 0,
                },
              ]}
            />
          )}
        </Card>
      </div>
    </TenantSelectionGuard>
  );
};

export default AnalyticsPage;
