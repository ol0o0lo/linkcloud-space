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
  Col,
  Drawer,
  Empty,
  Input,
  List,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useEffect } from 'react';
import type {
  BuildingMapDetailOut,
  BuildingMapMarkerOut,
  BuildingMapUnlocatedOut,
  EstateOut,
} from '@/services/manual/house';

const countLabels: Record<string, string> = {
  total: '总房源',
  vacant: '空置',
  rented: '已租',
  renovating: '装修中',
  locked: '封存',
  published: '已发布',
};

export function MapToolbar({
  keyword,
  estateId,
  houseStatus,
  includeInactive,
  estates,
  counts,
  updating,
  onKeywordChange,
  onEstateChange,
  onHouseStatusChange,
  onIncludeInactiveChange,
  onClear,
}: {
  keyword: string;
  estateId?: number;
  houseStatus?: string;
  includeInactive: boolean;
  estates: EstateOut[];
  counts: {
    located: number;
    unlocated: number;
    total: number;
    vacant: number;
    rented: number;
  };
  updating: boolean;
  onKeywordChange: (value: string) => void;
  onEstateChange: (value?: number) => void;
  onHouseStatusChange: (value?: string) => void;
  onIncludeInactiveChange: (value: boolean) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(
    keyword || estateId || houseStatus || includeInactive,
  );
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <Space wrap size={10} className="w-full">
        <Input.Search
          allowClear
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="搜索小区、楼栋或地址"
          style={{ width: 300 }}
        />
        <Select
          allowClear
          showSearch
          value={estateId}
          onChange={onEstateChange}
          placeholder="全部小区"
          style={{ width: 180 }}
          options={estates.map((item) => ({
            value: item.id,
            label: item.display_name || item.name,
          }))}
        />
        <Select
          allowClear
          value={houseStatus}
          onChange={onHouseStatusChange}
          placeholder="全部房态"
          style={{ width: 130 }}
          options={[
            { value: 'vacant', label: '空置' },
            { value: 'rented', label: '已租' },
            { value: 'renovating', label: '装修中' },
            { value: 'locked', label: '封存' },
          ]}
        />
        <Space size={6}>
          <Switch
            size="small"
            checked={includeInactive}
            onChange={onIncludeInactiveChange}
            aria-label="包含停用楼栋"
          />
          <Typography.Text>包含停用</Typography.Text>
        </Space>
        {hasFilters ? (
          <Button type="link" onClick={onClear}>
            清除筛选
          </Button>
        ) : null}
        <Space size={16} style={{ marginLeft: 'auto' }}>
          <Typography.Text type="secondary">当前视野</Typography.Text>
          <Typography.Text type="secondary">
            楼栋 <Typography.Text strong>{counts.located}</Typography.Text>
          </Typography.Text>
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
            <Tag icon={<ReloadOutlined spin />} color="processing">
              正在更新地图
            </Tag>
          ) : null}
        </Space>
      </Space>
    </Card>
  );
}

function CountTags({ counts }: { counts: BuildingMapMarkerOut['counts'] }) {
  return (
    <Space size={[4, 4]} wrap>
      <Tag color="blue">{counts.total} 套</Tag>
      <Tag color="green">空置 {counts.vacant}</Tag>
      <Tag>已租 {counts.rented}</Tag>
    </Space>
  );
}

export function BuildingResultPanel({
  located,
  unlocated,
  unlocatedTotal,
  collapsed,
  selectedId,
  loading,
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
    if (selectedId)
      document
        .getElementById(`building-map-result-${selectedId}`)
        ?.scrollIntoView({ block: 'nearest' });
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
          style={{ display: 'block', marginTop: 8, textAlign: 'center' }}
        >
          {located.length}
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
                    to={`/property-rental/estates?view=buildings&task=building_location&building_edit=${item.id}&return_to=${encodeURIComponent(returnTo)}`}
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
                  {item.is_active ? null : <Tag>停用</Tag>}
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

export function BuildingDetailDrawer({
  open,
  loading,
  error,
  detail,
  returnTo,
  onClose,
  onRetry,
}: {
  open: boolean;
  loading: boolean;
  error: boolean;
  detail?: BuildingMapDetailOut;
  returnTo: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <Drawer
      open={open}
      loading={loading}
      onClose={onClose}
      title={detail?.name || '楼栋详情'}
      size={520}
      footer={
        detail ? (
          <Space>
            <Link
              to={`/property-rental/buildings/${detail.id}?return_to=${encodeURIComponent(returnTo)}`}
            >
              查看楼栋详情
            </Link>
            <Link to={`/property-rental/houses?building_id=${detail.id}`}>
              查看全部房源
            </Link>
            <Link
              to={`/property-rental/estates?view=buildings&building_edit=${detail.id}&return_to=${encodeURIComponent(returnTo)}`}
            >
              编辑楼栋位置
            </Link>
          </Space>
        ) : null
      }
    >
      {error ? (
        <Alert
          type="error"
          title="楼栋详情加载失败"
          showIcon
          action={
            <Button size="small" onClick={onRetry}>
              重新加载
            </Button>
          }
        />
      ) : null}
      {detail ? (
        <>
          <Typography.Paragraph type="secondary">
            {detail.estate?.display_name || detail.estate?.name || '非小区楼栋'}{' '}
            · {detail.address}
          </Typography.Paragraph>
          <Row gutter={[8, 8]}>
            {Object.entries(detail.counts).map(([key, value]) => (
              <Col span={8} key={key}>
                <Card size="small">
                  <Statistic
                    title={countLabels[key] || key}
                    value={value}
                    styles={{ content: { fontSize: 20 } }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
          <Card
            size="small"
            title={`房源 ${detail.houses.length} 套`}
            style={{ marginTop: 16 }}
          >
            <List
              size="small"
              dataSource={detail.houses.slice(0, 12)}
              locale={{ emptyText: '暂无有效房源' }}
              renderItem={(house) => (
                <List.Item extra={<Tag>{house.status__mapping}</Tag>}>
                  <Link to={`/property-rental/houses/${house.id}`}>
                    {house.room_number} 室
                  </Link>
                  <Typography.Text type="secondary">
                    {house.floor == null ? '' : ` · ${house.floor} 层`}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </>
      ) : null}
    </Drawer>
  );
}
