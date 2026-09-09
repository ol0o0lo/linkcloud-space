import {
  ArrowLeftOutlined,
  BankOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Link } from '@umijs/max';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react';
import { AppIcon } from '@/components/AppIcon';
import { AppStatusTag } from '@/components/AppStatus';
import type {
  BuildingMapMarkerOut,
  BuildingMapUnlocatedOut,
  HouseOut,
} from '@/services/manual/house';
import { housePrimaryLayoutText, moneyText } from '../constants';
import {
  type EstateMapDisplayPoint,
  getMapPrimaryMetric,
  sortMapItemsByMetric,
  sumMapCounts,
} from './map-display';

const MAP_RESULT_PANEL_WIDTH = 'clamp(320px, 28vw, 390px)';

function useCompactMapPanel() {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1000,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 999px)');
    const update = () => setCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return compact;
}

function useMapResultPanelStyles(top: number) {
  const { token } = theme.useToken();
  const compact = useCompactMapPanel();
  const common: CSSProperties = {
    position: 'absolute',
    left: 12,
    zIndex: 4,
    background: `color-mix(in srgb, ${token.colorBgElevated} 92%, transparent)`,
    backdropFilter: 'blur(12px)',
    borderColor: token.colorBorderSecondary,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };

  return {
    token,
    compact,
    expanded: {
      ...common,
      ...(compact
        ? { right: 12, bottom: 12, height: 'min(55vh, 480px)' }
        : { top, bottom: 12, width: MAP_RESULT_PANEL_WIDTH }),
      maxWidth: 'calc(100% - 24px)',
      overflow: 'hidden',
    },
    collapsed: {
      ...common,
      ...(compact
        ? { right: 12, bottom: 12 }
        : { top, minWidth: 168, maxWidth: MAP_RESULT_PANEL_WIDTH }),
      minHeight: 44,
    },
  };
}

function taskSummaryText(
  counts: BuildingMapMarkerOut['counts'],
  houseStatus?: string,
) {
  const metric = getMapPrimaryMetric(counts, houseStatus);
  return `${metric.label} ${metric.value} 套`;
}

function taskTitle(buildingCount: number, houseStatus?: string) {
  const label = getMapPrimaryMetric(
    { total: 0, vacant: 0, listed: 0, rented: 0, renovating: 0 },
    houseStatus,
  ).label;
  return `${label === '房源' ? '全部房源' : `${label}房源`} · ${buildingCount} 栋`;
}

function taskPanelLabel(houseStatus?: string) {
  const label = getMapPrimaryMetric(
    { total: 0, vacant: 0, listed: 0, rented: 0, renovating: 0 },
    houseStatus,
  ).label;
  return label === '房源' ? '全部房源' : `${label}房源`;
}

export function MapToolbar({
  keyword,
  houseStatus,
  counts,
  updating,
  onKeywordChange,
  onKeywordSearch,
  onHouseStatusChange,
}: {
  keyword: string;
  houseStatus?: string;
  counts: {
    levelLabel: string;
    located: number;
    buildings: number;
    unlocated: number;
    total: number;
    vacant: number;
    listed: number;
    rented: number;
    renovating: number;
  };
  updating: boolean;
  onKeywordChange: (value: string) => void;
  onKeywordSearch: (value: string) => void;
  onHouseStatusChange: (value?: string) => void;
}) {
  const { token } = theme.useToken();
  const floatingSurface: CSSProperties = {
    background: `color-mix(in srgb, ${token.colorBgElevated} 92%, transparent)`,
    backdropFilter: 'blur(12px)',
    borderColor: token.colorBorderSecondary,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowTertiary,
    pointerEvents: 'auto',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <Card
        size="small"
        styles={{ body: { padding: '10px 12px' } }}
        style={{ ...floatingSurface, width: '100%', minWidth: 0 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Input.Search
            allowClear
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onSearch={onKeywordSearch}
            placeholder="搜索小区、楼栋或地址"
            style={{ flex: '1 1 320px', minWidth: 200, maxWidth: 520 }}
          />
          <Segmented
            aria-label="房态筛选"
            value={houseStatus || 'all'}
            onChange={(value) =>
              onHouseStatusChange(value === 'all' ? undefined : value)
            }
            options={[
              { value: 'vacant', label: '空置' },
              { value: 'listed', label: '招租' },
              { value: 'all', label: '全部' },
            ]}
          />
          <Typography.Text
            strong
            style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
          >
            {getMapPrimaryMetric(counts, houseStatus).value} 套
            {getMapPrimaryMetric(counts, houseStatus).label} ·{' '}
            {counts.buildings} 栋
          </Typography.Text>
          {updating ? (
            <Typography.Text type="secondary">
              <ReloadOutlined spin /> 更新中
            </Typography.Text>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function EmptyTaskState({
  keyword,
  houseStatus,
  onClearKeyword,
  onShowAllStatuses,
  onShowAllResults,
}: {
  keyword?: string;
  houseStatus?: string;
  onClearKeyword?: () => void;
  onShowAllStatuses?: () => void;
  onShowAllResults?: () => void;
}) {
  const metric = getMapPrimaryMetric(
    { total: 0, vacant: 0, listed: 0, rented: 0, renovating: 0 },
    houseStatus,
  );
  const description = keyword
    ? `当前组织没有符合“${keyword}”和“${metric.label}”条件的楼栋`
    : `当前地图范围暂无${metric.label === '房源' ? '' : metric.label}楼栋`;

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space orientation="vertical" size={10}>
          <Typography.Text type="secondary">{description}</Typography.Text>
          <Space wrap size={8}>
            {keyword && onClearKeyword ? (
              <Button size="small" onClick={onClearKeyword}>
                清除搜索
              </Button>
            ) : null}
            {houseStatus && onShowAllStatuses ? (
              <Button size="small" onClick={onShowAllStatuses}>
                查看全部房态
              </Button>
            ) : null}
            {onShowAllResults ? (
              <Button size="small" type="primary" onClick={onShowAllResults}>
                查看全部结果
              </Button>
            ) : null}
          </Space>
        </Space>
      }
      style={{ padding: '36px 12px' }}
    />
  );
}

export function EstateResultPanel({
  points,
  houseStatus,
  collapsed,
  focusedKey,
  loading,
  error,
  truncated,
  onSelect,
  onToggleCollapsed,
  onRetry,
  keyword,
  onClearKeyword,
  onShowAllStatuses,
  onShowAllResults,
  topOffset = 12,
}: {
  points: EstateMapDisplayPoint[];
  houseStatus?: string;
  collapsed: boolean;
  focusedKey?: string;
  loading: boolean;
  error: boolean;
  truncated: boolean;
  onSelect: (point: EstateMapDisplayPoint) => void;
  onToggleCollapsed: () => void;
  onRetry: () => void;
  keyword?: string;
  onClearKeyword?: () => void;
  onShowAllStatuses?: () => void;
  onShowAllResults?: () => void;
  topOffset?: number;
}) {
  const {
    collapsed: collapsedStyle,
    expanded: expandedStyle,
    token,
  } = useMapResultPanelStyles(topOffset);
  const sortedPoints = sortMapItemsByMetric(points, houseStatus);
  const summaryCounts = sumMapCounts(points);
  const buildingCount = points.reduce(
    (total, point) => total + point.buildingCount,
    0,
  );

  if (collapsed) {
    return (
      <Card
        size="small"
        styles={{
          body: {
            display: 'flex',
            height: '100%',
            padding: 0,
          },
        }}
        style={collapsedStyle}
      >
        <Tooltip title="展开房源结果" placement="right">
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            aria-label={`展开${taskPanelLabel(houseStatus)}结果`}
            onClick={onToggleCollapsed}
            style={{
              width: '100%',
              minHeight: 42,
              justifyContent: 'flex-start',
            }}
          >
            {taskSummaryText(summaryCounts, houseStatus)}
          </Button>
        </Tooltip>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={taskTitle(buildingCount, houseStatus)}
      extra={
        <Button
          type="text"
          icon={<MenuFoldOutlined />}
          aria-label="收起房源结果"
          title="收起房源结果"
          onClick={onToggleCollapsed}
        />
      }
      styles={{
        header: {
          minHeight: 48,
          paddingInline: 12,
        },
        body: { padding: 0, height: 'calc(100% - 46px)', overflow: 'auto' },
      }}
      style={expandedStyle}
    >
      {error ? (
        <Alert
          type="error"
          title="小区结果加载失败"
          showIcon
          action={
            <Button size="small" onClick={onRetry}>
              重新加载
            </Button>
          }
          style={{ margin: 12 }}
        />
      ) : null}
      {truncated ? (
        <Alert
          type="info"
          showIcon
          title="当前区域结果较多"
          description="继续放大地图可查看更完整的小区与楼栋结果。"
          style={{ margin: 12 }}
        />
      ) : null}
      <Spin spinning={loading}>
        {!loading && !points.length ? (
          <EmptyTaskState
            keyword={keyword}
            houseStatus={houseStatus}
            onClearKeyword={onClearKeyword}
            onShowAllStatuses={onShowAllStatuses}
            onShowAllResults={onShowAllResults}
          />
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {sortedPoints.map((point) => {
              const metric = getMapPrimaryMetric(point.counts, houseStatus);
              const focused = focusedKey === point.key;
              return (
                <li key={point.key}>
                  <button
                    type="button"
                    aria-pressed={focused}
                    onClick={() => onSelect(point)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      gap: 12,
                      padding: 12,
                      border: 0,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      borderLeft: focused
                        ? `3px solid ${token.colorPrimary}`
                        : '3px solid transparent',
                      background: focused
                        ? token.colorPrimaryBg
                        : 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <AppIcon
                      name={point.kind === 'estate' ? 'estate' : 'building'}
                      style={{
                        marginTop: 3,
                        color: focused
                          ? token.colorPrimary
                          : token.colorTextSecondary,
                        fontSize: 18,
                      }}
                    />
                    <Space
                      orientation="vertical"
                      size={5}
                      className="min-w-0 flex-1"
                    >
                      <Space size={6} wrap>
                        <Typography.Text strong>{point.name}</Typography.Text>
                        {point.locationSource === 'building-centroid' ? (
                          <Tag color="cyan">楼栋中心</Tag>
                        ) : null}
                        {point.kind === 'independent-building' ? (
                          <Tag color="purple">独立楼栋</Tag>
                        ) : null}
                      </Space>
                      <Typography.Text type="secondary" ellipsis>
                        {point.address || '暂无地址'}
                      </Typography.Text>
                      <Space size={[4, 4]} wrap>
                        <Tag color="green">
                          {metric.label} {metric.value} 套
                        </Tag>
                        <Tag>{point.buildingCount} 栋</Tag>
                        {point.unlocatedBuildingCount ? (
                          <Tag color="orange">
                            待定位 {point.unlocatedBuildingCount}
                          </Tag>
                        ) : null}
                      </Space>
                    </Space>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Spin>
    </Card>
  );
}

export function BuildingResultPanel({
  located,
  unlocated,
  unlocatedTotal,
  collapsed,
  selectedId,
  selectedBuilding,
  houseStatus,
  contextName,
  loading,
  truncated,
  locatedError,
  unlocatedError,
  houses,
  houseTotal,
  housesLoading,
  housesError,
  returnTo,
  pendingListHref,
  onSelect,
  onBack,
  onBackToAllResults,
  onToggleCollapsed,
  onRetryLocated,
  onRetryUnlocated,
  onRetryHouses,
  keyword,
  onClearKeyword,
  onShowAllStatuses,
  onShowAllResults,
  topOffset = 12,
}: {
  located: BuildingMapMarkerOut[];
  unlocated: BuildingMapUnlocatedOut[];
  unlocatedTotal: number;
  collapsed: boolean;
  selectedId?: number;
  selectedBuilding?: BuildingMapMarkerOut;
  houseStatus?: string;
  contextName?: string;
  loading: boolean;
  truncated: boolean;
  locatedError: boolean;
  unlocatedError: boolean;
  houses: HouseOut[];
  houseTotal: number;
  housesLoading: boolean;
  housesError: boolean;
  returnTo: string;
  pendingListHref: string;
  onSelect: (building: BuildingMapMarkerOut) => void;
  onBack?: () => void;
  onBackToAllResults?: () => void;
  onToggleCollapsed: () => void;
  onRetryLocated: () => void;
  onRetryUnlocated: () => void;
  onRetryHouses: () => void;
  keyword?: string;
  onClearKeyword?: () => void;
  onShowAllStatuses?: () => void;
  onShowAllResults?: () => void;
  topOffset?: number;
}) {
  const {
    collapsed: collapsedStyle,
    expanded: expandedStyle,
    token,
  } = useMapResultPanelStyles(topOffset);
  const [showUnlocated, setShowUnlocated] = useState(false);
  const sortedLocated = sortMapItemsByMetric(located, houseStatus);
  const summaryCounts = sumMapCounts(located);
  const activeBuilding =
    selectedBuilding || located.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    const item = document.getElementById(`building-map-result-${selectedId}`);
    const scrollContainer = item?.closest<HTMLElement>('.ant-card-body');
    if (!item || !scrollContainer) return;
    const itemRect = item.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    if (itemRect.top < containerRect.top)
      scrollContainer.scrollTop -= containerRect.top - itemRect.top;
    else if (itemRect.bottom > containerRect.bottom)
      scrollContainer.scrollTop += itemRect.bottom - containerRect.bottom;
  }, [selectedId]);
  if (collapsed) {
    return (
      <Card
        size="small"
        styles={{
          body: {
            display: 'flex',
            height: '100%',
            padding: 0,
          },
        }}
        style={collapsedStyle}
      >
        <Tooltip title="展开房源结果" placement="right">
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            aria-label={`展开${taskPanelLabel(houseStatus)}结果`}
            onClick={onToggleCollapsed}
            style={{
              width: '100%',
              minHeight: 42,
              justifyContent: 'flex-start',
            }}
          >
            {taskSummaryText(summaryCounts, houseStatus)}
          </Button>
        </Tooltip>
      </Card>
    );
  }
  return (
    <Card
      size="small"
      title={
        activeBuilding ? (
          <Space size={4}>
            <Tooltip title="返回楼栋列表">
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined />}
                aria-label="返回楼栋列表"
                onClick={onBack}
                style={{ marginInlineStart: -8 }}
              />
            </Tooltip>
            <Typography.Title
              id="building-task-title"
              level={5}
              style={{ margin: 0 }}
            >
              {activeBuilding.name}
            </Typography.Title>
          </Space>
        ) : (
          taskTitle(located.length, houseStatus)
        )
      }
      extra={
        <Space size={2}>
          {unlocatedTotal ? (
            <Button
              type="text"
              size="small"
              aria-expanded={showUnlocated}
              onClick={() => setShowUnlocated((current) => !current)}
            >
              <Badge status="warning" /> 待定位楼栋 {unlocatedTotal}
            </Button>
          ) : null}
          <Button
            type="text"
            icon={<MenuFoldOutlined />}
            aria-label="收起房源结果"
            title="收起房源结果"
            onClick={onToggleCollapsed}
          />
        </Space>
      }
      styles={{
        header: {
          minHeight: 48,
          paddingInline: 12,
        },
        body: { padding: 0, height: 'calc(100% - 46px)', overflow: 'auto' },
      }}
      style={expandedStyle}
    >
      {activeBuilding ? (
        <section style={{ padding: 16 }} aria-labelledby="building-task-title">
          <Typography.Text type="secondary" style={{ display: 'block' }}>
            {activeBuilding.estate?.display_name ||
              activeBuilding.estate?.name ||
              '非小区楼栋'}{' '}
            · 共 {activeBuilding.counts.total} 套房源
          </Typography.Text>
          <Typography.Paragraph
            type="secondary"
            ellipsis={{ rows: 2, expandable: false }}
            style={{ marginBlock: '2px 0' }}
          >
            {activeBuilding.address || '暂无地址'}
          </Typography.Paragraph>
          <section
            aria-labelledby="building-houses-title"
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 10,
              }}
            >
              <Typography.Text id="building-houses-title" strong>
                房源明细
              </Typography.Text>
              <Space size={10}>
                <Typography.Text type="secondary">
                  {housesLoading ? '房源加载中' : `${houseTotal} 套`}
                </Typography.Text>
                <Link
                  to={`/rental/properties/list?${new URLSearchParams({
                    building_id: String(activeBuilding.id),
                    ...(houseStatus ? { status: houseStatus } : {}),
                  }).toString()}`}
                  target="_blank"
                  rel="noreferrer"
                  title="在新标签页打开"
                  aria-label={`查看 ${activeBuilding.name} 的${houseStatus ? getMapPrimaryMetric(activeBuilding.counts, houseStatus).label : '全部'}房源列表`}
                >
                  <Space size={4}>
                    <UnorderedListOutlined aria-hidden />
                    <span>查看全部</span>
                    <ExportOutlined aria-hidden style={{ fontSize: 11 }} />
                  </Space>
                </Link>
              </Space>
            </div>
            {housesError ? (
              <Alert
                type="error"
                showIcon
                title="房源加载失败"
                action={
                  <Button size="small" onClick={onRetryHouses}>
                    重新加载房源
                  </Button>
                }
              />
            ) : housesLoading ? (
              <div
                aria-hidden="true"
                style={{ minHeight: 72, display: 'grid', placeItems: 'center' }}
              >
                <Spin size="small" />
              </div>
            ) : houses.length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {houses.map((house, index) => {
                  const layout = housePrimaryLayoutText(house);
                  return (
                    <li
                      key={house.id}
                      style={{
                        borderBottom:
                          index < houses.length - 1
                            ? `1px solid ${token.colorBorderSecondary}`
                            : undefined,
                      }}
                    >
                      <Link
                        to={`/rental/properties/${house.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="在新标签页打开"
                        aria-label={`查看房源 ${house.room_number || house.id}`}
                        style={{
                          display: 'block',
                          marginInline: -8,
                          padding: '10px 8px',
                          borderRadius: token.borderRadiusLG,
                          outline: 'none',
                          color: 'inherit',
                          textDecoration: 'none',
                          transition:
                            'background-color 120ms ease, box-shadow 120ms ease',
                        }}
                        onMouseEnter={(
                          event: ReactMouseEvent<HTMLAnchorElement>,
                        ) => {
                          event.currentTarget.style.background =
                            token.colorPrimaryBg;
                        }}
                        onMouseLeave={(
                          event: ReactMouseEvent<HTMLAnchorElement>,
                        ) => {
                          if (document.activeElement !== event.currentTarget)
                            event.currentTarget.style.background =
                              'transparent';
                        }}
                        onFocus={(
                          event: ReactFocusEvent<HTMLAnchorElement>,
                        ) => {
                          event.currentTarget.style.background =
                            token.colorPrimaryBg;
                          event.currentTarget.style.boxShadow = `0 0 0 2px ${token.colorPrimaryBorder}`;
                        }}
                        onBlur={(event: ReactFocusEvent<HTMLAnchorElement>) => {
                          event.currentTarget.style.background = 'transparent';
                          event.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <Space size={4}>
                            <HomeOutlined aria-hidden />
                            <span style={{ fontWeight: 600 }}>
                              {house.room_number || `房源 ${house.id}`}
                            </span>
                          </Space>
                          <Space size={4}>
                            <Typography.Text strong>
                              {moneyText(house.asking_rent)} / 月
                            </Typography.Text>
                            <ExportOutlined
                              aria-hidden
                              style={{
                                color: token.colorTextSecondary,
                                fontSize: 11,
                              }}
                            />
                          </Space>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 6,
                          }}
                        >
                          <Space size={6} wrap>
                            {house.floor != null ? (
                              <Typography.Text type="secondary">
                                {house.floor}层
                              </Typography.Text>
                            ) : null}
                            {layout !== '-' ? (
                              <Typography.Text type="secondary">
                                {layout}
                              </Typography.Text>
                            ) : null}
                            {house.area ? (
                              <Typography.Text type="secondary">
                                {house.area}㎡
                              </Typography.Text>
                            ) : null}
                          </Space>
                          <AppStatusTag name="house" state={house.status}>
                            {house.status__mapping || house.status || '-'}
                          </AppStatusTag>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前筛选下暂无房源"
                styles={{ image: { height: 32 } }}
              >
                {houseStatus && onShowAllStatuses ? (
                  <Button type="link" onClick={onShowAllStatuses}>
                    查看全部房态
                  </Button>
                ) : null}
              </Empty>
            )}
          </section>
          <div
            style={{
              marginTop: 8,
              paddingTop: 12,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Space size={16} wrap>
              <Link
                to={`/rental/properties/buildings/${activeBuilding.id}?return_to=${encodeURIComponent(returnTo)}`}
                target="_blank"
                rel="noreferrer"
                title="在新标签页打开"
              >
                <Space size={4}>
                  <BankOutlined aria-hidden />
                  <span>楼栋详情</span>
                  <ExportOutlined aria-hidden style={{ fontSize: 11 }} />
                </Space>
              </Link>
              <Link
                to={`/rental/properties/list?building_id=${activeBuilding.id}&asset_tab=profile&asset_action=edit-building&return_to=${encodeURIComponent(returnTo)}`}
                target="_blank"
                rel="noreferrer"
                title="在新标签页打开"
              >
                <Space size={4}>
                  <EnvironmentOutlined aria-hidden />
                  <span>编辑位置</span>
                  <ExportOutlined aria-hidden style={{ fontSize: 11 }} />
                </Space>
              </Link>
            </Space>
          </div>
        </section>
      ) : (
        <>
          {contextName && onBackToAllResults ? (
            <div
              style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Button
                type="link"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={onBackToAllResults}
                style={{ paddingInline: 0 }}
              >
                全部结果 / {contextName}
              </Button>
              <Typography.Text type="secondary" style={{ display: 'block' }}>
                {located.length} 栋 ·{' '}
                {taskSummaryText(summaryCounts, houseStatus)}
              </Typography.Text>
            </div>
          ) : null}
          {unlocatedError ? (
            <Alert
              type="error"
              title="待定位任务加载失败"
              showIcon
              action={
                <Button size="small" onClick={onRetryUnlocated}>
                  重新加载
                </Button>
              }
              style={{ margin: 12 }}
            />
          ) : null}
          {showUnlocated && unlocatedTotal ? (
            <div
              style={{
                padding: 12,
                background: token.colorWarningBg,
                borderBottom: `1px solid ${token.colorWarningBorder}`,
              }}
            >
              <Typography.Text strong>
                <Badge status="warning" /> 待定位楼栋 {unlocatedTotal}
              </Typography.Text>
              <ul style={{ margin: '8px 0', padding: 0, listStyle: 'none' }}>
                {unlocated.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      paddingBlock: 6,
                    }}
                  >
                    <Space orientation="vertical" size={2} className="min-w-0">
                      <Typography.Text strong>{item.name}</Typography.Text>
                      <Typography.Text type="secondary" ellipsis>
                        {item.estate?.display_name ||
                          item.estate?.name ||
                          '非小区楼栋'}{' '}
                        · {item.address}
                      </Typography.Text>
                    </Space>
                    <Link
                      to={`/rental/properties/list?building_id=${item.id}&asset_tab=profile&asset_action=edit-building&return_to=${encodeURIComponent(returnTo)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="在新标签页打开"
                    >
                      <Space size={4}>
                        <EnvironmentOutlined aria-hidden />
                        <span>立即定位</span>
                      </Space>
                    </Link>
                  </li>
                ))}
              </ul>
              {unlocatedTotal > 5 ? (
                <Link
                  to={pendingListHref}
                  target="_blank"
                  rel="noreferrer"
                  title="在新标签页打开"
                >
                  <Space size={4}>
                    <UnorderedListOutlined aria-hidden />
                    <span>查看全部 {unlocatedTotal} 栋待定位楼栋</span>
                  </Space>
                </Link>
              ) : null}
            </div>
          ) : null}
          {locatedError ? (
            <Alert
              type="error"
              title="楼栋结果加载失败"
              showIcon
              action={
                <Button size="small" onClick={onRetryLocated}>
                  重新加载
                </Button>
              }
              style={{ margin: 12 }}
            />
          ) : null}
          {truncated ? (
            <Alert
              type="info"
              showIcon
              title="当前区域楼栋较多"
              description="继续放大地图可查看更完整的楼栋结果。"
              style={{ margin: 12 }}
            />
          ) : null}
          {!loading && !located.length ? (
            <EmptyTaskState
              keyword={keyword}
              houseStatus={houseStatus}
              onClearKeyword={onClearKeyword}
              onShowAllStatuses={onShowAllStatuses}
              onShowAllResults={onShowAllResults}
            />
          ) : (
            <Spin spinning={loading}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {sortedLocated.map((item) => {
                  const metric = getMapPrimaryMetric(item.counts, houseStatus);
                  return (
                    <li key={item.id}>
                      <button
                        id={`building-map-result-${item.id}`}
                        type="button"
                        aria-pressed={selectedId === item.id}
                        onClick={() => onSelect(item)}
                        style={{
                          display: 'flex',
                          width: '100%',
                          gap: 12,
                          padding: 12,
                          border: 0,
                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                          borderLeft:
                            selectedId === item.id
                              ? `3px solid ${token.colorPrimary}`
                              : '3px solid transparent',
                          background:
                            selectedId === item.id
                              ? token.colorPrimaryBg
                              : 'transparent',
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ marginTop: 3 }}>
                          <AppIcon
                            name="building"
                            style={{
                              color:
                                selectedId === item.id
                                  ? token.colorPrimary
                                  : token.colorTextSecondary,
                              fontSize: 18,
                            }}
                          />
                        </span>
                        <Space
                          orientation="vertical"
                          size={4}
                          className="min-w-0 flex-1"
                        >
                          <Space>
                            <Typography.Text strong>
                              {item.name}
                            </Typography.Text>
                          </Space>
                          <Typography.Text type="secondary" ellipsis>
                            {item.estate?.display_name ||
                              item.estate?.name ||
                              '非小区楼栋'}{' '}
                            · {item.address}
                          </Typography.Text>
                          <div>
                            <Tag color="green">
                              {metric.label} {metric.value} 套
                            </Tag>
                          </div>
                        </Space>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Spin>
          )}
        </>
      )}
    </Card>
  );
}
