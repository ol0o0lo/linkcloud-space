import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Link } from '@umijs/max';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  List,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { type CSSProperties, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { AppStatusTag } from '@/components/AppStatus';
import type {
  BuildingMapMarkerOut,
  BuildingMapUnlocatedOut,
} from '@/services/manual/house';
import { HOUSE_STATUS } from '../constants';
import { type EstateMapDisplayPoint, getMapPrimaryMetric } from './map-display';

const MAP_RESULT_PANEL_WIDTH = 'clamp(320px, 28vw, 390px)';

function useMapResultPanelStyles(top: number) {
  const { token } = theme.useToken();
  const common: CSSProperties = {
    position: 'absolute',
    top,
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
    expanded: {
      ...common,
      bottom: 12,
      width: MAP_RESULT_PANEL_WIDTH,
      maxWidth: 'calc(100% - 24px)',
      overflow: 'hidden',
    },
    collapsed: {
      ...common,
      width: 40,
      height: 40,
    },
  };
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
    rented: number;
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
        style={{
          ...floatingSurface,
          flex: '0 1 auto',
          width: 'fit-content',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Space wrap size={8} className="w-full">
          <Input.Search
            allowClear
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onSearch={onKeywordSearch}
            placeholder="搜索小区、楼栋或地址"
            style={{ flex: '1 1 280px', minWidth: 200 }}
          />
          <Select
            allowClear
            value={houseStatus}
            onChange={onHouseStatusChange}
            placeholder="全部房态"
            style={{ width: 130 }}
            options={[
              { value: 'vacant', label: '空置' },
              { value: 'listed', label: '招租' },
              { value: 'rented', label: '已租' },
              { value: 'renovating', label: '装修' },
            ]}
          />
        </Space>
      </Card>
      <Card
        size="small"
        styles={{ body: { padding: '10px 12px' } }}
        style={{
          ...floatingSurface,
          flex: '0 1 auto',
          maxWidth: '100%',
          marginLeft: 'auto',
        }}
      >
        <Space size={[12, 6]} wrap>
          <Typography.Text type="secondary">当前视野</Typography.Text>
          <Typography.Text type="secondary">
            {counts.levelLabel}{' '}
            <Typography.Text strong>{counts.located}</Typography.Text>
          </Typography.Text>
          {counts.levelLabel === '楼栋' ? null : (
            <Typography.Text type="secondary">
              楼栋 <Typography.Text strong>{counts.buildings}</Typography.Text>
            </Typography.Text>
          )}
          <Typography.Text type="secondary">
            房源 <Typography.Text strong>{counts.total}</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            空置 <Typography.Text strong>{counts.vacant}</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            已租 <Typography.Text strong>{counts.rented}</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            待定位任务{' '}
            <Typography.Text strong>{counts.unlocated}</Typography.Text>
          </Typography.Text>
          {updating ? (
            <Typography.Text type="secondary">
              <ReloadOutlined spin /> 更新中
            </Typography.Text>
          ) : null}
        </Space>
      </Card>
    </div>
  );
}

function CountTags({ counts }: { counts: BuildingMapMarkerOut['counts'] }) {
  return (
    <Space size={[4, 4]} wrap>
      <Tag color="blue">{counts.total} 套</Tag>
      <AppStatusTag name="house" state={HOUSE_STATUS.VACANT}>
        空置 {counts.vacant}
      </AppStatusTag>
      <AppStatusTag name="house" state={HOUSE_STATUS.RENTED}>
        已租 {counts.rented}
      </AppStatusTag>
    </Space>
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
  topOffset?: number;
}) {
  const {
    collapsed: collapsedStyle,
    expanded: expandedStyle,
    token,
  } = useMapResultPanelStyles(topOffset);

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
        <Tooltip title="展开小区结果" placement="right">
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            aria-label="展开小区结果"
            onClick={onToggleCollapsed}
            style={{ width: '100%', height: '100%' }}
          />
        </Tooltip>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={`小区结果 ${points.length}`}
      extra={
        <Button
          type="text"
          icon={<MenuFoldOutlined />}
          aria-label="收起小区结果"
          title="收起小区结果"
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
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前地图范围暂无已定位小区或独立楼栋"
            style={{ padding: '36px 12px' }}
          />
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {points.map((point) => {
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
                        <Tag color="blue">{point.buildingCount} 栋</Tag>
                        <Tag color="green">
                          {metric.label} {metric.value}
                        </Tag>
                        <Tag>已租 {point.counts.rented}</Tag>
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
  loading,
  truncated,
  locatedError,
  unlocatedError,
  returnTo,
  pendingListHref,
  onSelect,
  onToggleCollapsed,
  onRetryLocated,
  onRetryUnlocated,
  topOffset = 12,
}: {
  located: BuildingMapMarkerOut[];
  unlocated: BuildingMapUnlocatedOut[];
  unlocatedTotal: number;
  collapsed: boolean;
  selectedId?: number;
  loading: boolean;
  truncated: boolean;
  locatedError: boolean;
  unlocatedError: boolean;
  returnTo: string;
  pendingListHref: string;
  onSelect: (building: BuildingMapMarkerOut) => void;
  onToggleCollapsed: () => void;
  onRetryLocated: () => void;
  onRetryUnlocated: () => void;
  topOffset?: number;
}) {
  const {
    collapsed: collapsedStyle,
    expanded: expandedStyle,
    token,
  } = useMapResultPanelStyles(topOffset);
  const [showUnlocated, setShowUnlocated] = useState(false);

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
        <Tooltip title="展开楼栋结果" placement="right">
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            aria-label="展开楼栋结果"
            onClick={onToggleCollapsed}
            style={{ width: '100%', height: '100%' }}
          />
        </Tooltip>
      </Card>
    );
  }
  return (
    <Card
      size="small"
      title={`楼栋结果 ${located.length}`}
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
            aria-label="收起楼栋结果"
            title="收起楼栋结果"
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
          <List
            size="small"
            split={false}
            dataSource={unlocated.slice(0, 5)}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Link
                    key="locate"
                    to={`/rental/properties/list?building_id=${item.id}&asset_tab=profile&asset_action=edit-building&return_to=${encodeURIComponent(returnTo)}`}
                  >
                    立即定位
                  </Link>,
                ]}
              >
                <List.Item.Meta
                  title={item.name}
                  description={`${item.estate?.display_name || item.estate?.name || '非小区楼栋'} · ${item.address}`}
                />
              </List.Item>
            )}
          />
          {unlocatedTotal > 5 ? (
            <Link to={pendingListHref}>
              查看全部 {unlocatedTotal} 栋待定位楼栋
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
      <List
        loading={loading}
        dataSource={located}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前地图范围暂无已定位楼栋"
            />
          ),
        }}
        renderItem={(item) => (
          <List.Item
            id={`building-map-result-${item.id}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === item.id}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item);
              }
            }}
            style={{
              padding: 12,
              cursor: 'pointer',
              background:
                selectedId === item.id ? token.colorPrimaryBg : undefined,
              borderLeft:
                selectedId === item.id
                  ? `3px solid ${token.colorPrimary}`
                  : '3px solid transparent',
            }}
          >
            <List.Item.Meta
              avatar={
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
              }
              title={
                <Space>
                  <Typography.Text strong>{item.name}</Typography.Text>
                </Space>
              }
              description={
                <Space orientation="vertical" size={4}>
                  <Typography.Text type="secondary">
                    {item.estate?.display_name ||
                      item.estate?.name ||
                      '非小区楼栋'}{' '}
                    · {item.address}
                  </Typography.Text>
                  <CountTags counts={item.counts} />
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
