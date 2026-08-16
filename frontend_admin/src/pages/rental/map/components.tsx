import {
  EnvironmentOutlined,
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
  Typography,
} from 'antd';
import { useEffect } from 'react';
import type {
  BuildingMapMarkerOut,
  BuildingMapUnlocatedOut,
} from '@/services/manual/house';
import { HOUSE_STATUS, STATUS_COLOR } from '../constants';
import { type EstateMapDisplayPoint, getMapPrimaryMetric } from './map-display';

export function MapToolbar({
  keyword,
  houseStatus,
  hasFilters,
  counts,
  updating,
  onKeywordChange,
  onKeywordSearch,
  onHouseStatusChange,
  onClear,
}: {
  keyword: string;
  houseStatus?: string;
  hasFilters: boolean;
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
  onClear: () => void;
}) {
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <Space wrap size={10} className="w-full">
        <Input.Search
          allowClear
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          onSearch={onKeywordSearch}
          placeholder="搜索小区、楼栋或地址"
          style={{ width: 300 }}
        />
        <Select
          allowClear
          value={houseStatus}
          onChange={onHouseStatusChange}
          placeholder="全部房态"
          style={{ width: 130 }}
          options={[
            { value: 'vacant', label: '空置' },
            { value: 'listed', label: '招租中' },
            { value: 'rented', label: '已租' },
            { value: 'renovating', label: '装修中' },
          ]}
        />
        {hasFilters ? (
          <Button type="link" onClick={onClear}>
            清除筛选
          </Button>
        ) : null}
        <Space size={16} style={{ marginLeft: 'auto' }}>
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
          <Tag
            icon={<ReloadOutlined spin={updating} />}
            color="processing"
            aria-hidden={!updating}
            style={{ visibility: updating ? 'visible' : 'hidden' }}
          >
            正在更新地图
          </Tag>
        </Space>
      </Space>
    </Card>
  );
}

function CountTags({ counts }: { counts: BuildingMapMarkerOut['counts'] }) {
  return (
    <Space size={[4, 4]} wrap>
      <Tag color="blue">{counts.total} 套</Tag>
      <Tag color={STATUS_COLOR[HOUSE_STATUS.VACANT]}>空置 {counts.vacant}</Tag>
      <Tag color={STATUS_COLOR[HOUSE_STATUS.RENTED]}>已租 {counts.rented}</Tag>
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
}) {
  if (collapsed) {
    return (
      <Card
        size="small"
        styles={{ body: { padding: 7 } }}
        style={{ width: 48, flex: '0 0 48px', height: '100%' }}
      >
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          aria-label="展开小区结果"
          title="展开小区结果"
          onClick={onToggleCollapsed}
        />
        <Typography.Text
          type="secondary"
          aria-label={`当前视野项目 ${points.length} 个`}
          title={`当前视野项目 ${points.length} 个`}
          style={{ display: 'block', marginTop: 8, textAlign: 'center' }}
        >
          {points.length}个
        </Typography.Text>
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
        body: { padding: 0, height: 'calc(100% - 46px)', overflow: 'auto' },
      }}
      style={{
        width: 'clamp(320px, 28vw, 390px)',
        flex: '0 0 clamp(320px, 28vw, 390px)',
        height: '100%',
      }}
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
                      borderBottom: '1px solid #f0f0f0',
                      borderLeft: focused
                        ? '3px solid #1677ff'
                        : '3px solid transparent',
                      background: focused ? '#e6f4ff' : '#fff',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <EnvironmentOutlined
                      style={{
                        marginTop: 3,
                        color: focused ? '#1677ff' : '#8c8c8c',
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
}) {
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
        styles={{ body: { padding: 7 } }}
        style={{ width: 48, flex: '0 0 48px', height: '100%' }}
      >
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          aria-label="展开楼栋结果"
          title="展开楼栋结果"
          onClick={onToggleCollapsed}
        />
        {unlocatedTotal ? (
          <Badge
            count={unlocatedTotal}
            overflowCount={99}
            color="#faad14"
            title={`待定位楼栋 ${unlocatedTotal}`}
            style={{ marginTop: 12 }}
          />
        ) : null}
        <Typography.Text
          type="secondary"
          aria-label={`当前视野楼栋 ${located.length} 栋`}
          title={`当前视野楼栋 ${located.length} 栋`}
          style={{ display: 'block', marginTop: 8, textAlign: 'center' }}
        >
          {located.length}栋
        </Typography.Text>
      </Card>
    );
  }
  return (
    <Card
      size="small"
      title={`楼栋结果 ${located.length}`}
      extra={
        <Button
          type="text"
          icon={<MenuFoldOutlined />}
          aria-label="收起楼栋结果"
          title="收起楼栋结果"
          onClick={onToggleCollapsed}
        />
      }
      styles={{
        body: { padding: 0, height: 'calc(100% - 46px)', overflow: 'auto' },
      }}
      style={{
        width: 'clamp(320px, 28vw, 390px)',
        flex: '0 0 clamp(320px, 28vw, 390px)',
        height: '100%',
      }}
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
      {unlocatedTotal ? (
        <div
          style={{
            padding: 12,
            background: '#fffbe6',
            borderBottom: '1px solid #ffe58f',
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
                    to={`/rental/properties/estates?view=buildings&task=building_location&building_edit=${item.id}&return_to=${encodeURIComponent(returnTo)}`}
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
              background: selectedId === item.id ? '#e6f4ff' : undefined,
              borderLeft:
                selectedId === item.id
                  ? '3px solid #1677ff'
                  : '3px solid transparent',
            }}
          >
            <List.Item.Meta
              avatar={
                <EnvironmentOutlined
                  style={{
                    color: selectedId === item.id ? '#1677ff' : '#8c8c8c',
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
