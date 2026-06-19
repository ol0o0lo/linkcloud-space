import { EnvironmentOutlined, HomeOutlined } from '@ant-design/icons';
import { Alert, Card, Empty, Input, Segmented, Spin, Tag, Typography } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { useAmap } from '@/services/manual/amap';
import { fetchMockMarkers } from './_mock';
import type { GeoMarker, GeoMarkerFilter, GeoMarkerType } from './data.d';

const { Title, Text, Paragraph } = Typography;

/** 标点类型 -> 颜色/图标映射 */
const MARKER_STYLES: Record<
  GeoMarkerType,
  { color: string; label: string; icon: React.ReactNode }
> = {
  building: { color: '#1677ff', label: '楼栋', icon: <EnvironmentOutlined /> },
  house: { color: '#52c41a', label: '房屋', icon: <HomeOutlined /> },
};

/** InfoWindow 内部渲染组件 */
const InfoWindowContent: React.FC<{ marker: GeoMarker }> = ({ marker }) => {
  const style = MARKER_STYLES[marker.type];
  return (
    <div style={{ minWidth: 200, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color: style.color, fontSize: 16 }}>{style.icon}</span>
        <Text strong style={{ fontSize: 14 }}>
          {marker.name}
        </Text>
      </div>
      <div style={{ marginBottom: 6 }}>
        <Tag color={marker.type === 'building' ? 'blue' : 'green'}>
          {style.label}
        </Tag>
        {marker.modelId && (
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
            ID: {marker.modelId}
          </Text>
        )}
      </div>
      {marker.description && (
        <Paragraph
          type="secondary"
          style={{ fontSize: 12, marginBottom: 6, marginTop: 0 }}
        >
          {marker.description}
        </Paragraph>
      )}
      <div style={{ fontSize: 12, color: '#999' }}>
        {marker.lng.toFixed(6)}, {marker.lat.toFixed(6)}
      </div>
    </div>
  );
};

const MapPage: React.FC = () => {
  const { AMap, loading, error } = useAmap();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markersMapRef = useRef<Map<string, { marker: GeoMarker; instance: any }>>(new Map());
  const infoWindowRef = useRef<any>(null);

  const [markers, setMarkers] = useState<GeoMarker[]>([]);
  const [filter, setFilter] = useState<GeoMarkerFilter>({ type: undefined, keyword: '' });
  const [markersLoading, setMarkersLoading] = useState(true);

  // 加载 mock 标点数据
  useEffect(() => {
    let cancelled = false;
    setMarkersLoading(true);
    fetchMockMarkers().then((res) => {
      if (cancelled) return;
      setMarkers(res.items);
      setMarkersLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 按筛选条件过滤标点
  const filteredMarkers = useMemo(() => {
    return markers.filter((m) => {
      if (filter.type && m.type !== filter.type) return false;
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase();
        if (
          !m.name.toLowerCase().includes(kw) &&
          !(m.description?.toLowerCase().includes(kw) ?? false)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [markers, filter]);

  // 初始化地图
  useEffect(() => {
    if (!AMap || !containerRef.current || mapRef.current) return;

    const map = new AMap.Map(containerRef.current, {
      zoom: 12,
      center: [120.1551, 30.2741], // 杭州
      viewMode: '2D',
    });
    mapRef.current = map;

    // Scale 和 ToolBar 插件
    AMap.plugin(['AMap.Scale', 'AMap.ToolBar'], () => {
      map.addControl(new AMap.Scale());
      map.addControl(
        new AMap.ToolBar({ position: { right: '20px', bottom: '90px' } }),
      );
    });

    // InfoWindow
    infoWindowRef.current = new AMap.InfoWindow({
      offset: new AMap.Pixel(0, -30),
      closeWhenClickMap: true,
    });

    return () => {
      map.destroy();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [AMap]);

  // 渲染标点
  useEffect(() => {
    if (!AMap || !mapRef.current) return;

    // 清除旧标点
    markersRef.current.forEach((m) => { mapRef.current.remove(m); });
    markersRef.current = [];
    markersMapRef.current.clear();

    filteredMarkers.forEach((marker) => {
      const style = MARKER_STYLES[marker.type];
      // 使用 SimpleMarker 风格的自定义内容标点
      const content = `<div style="
        width: 24px; height: 24px; border-radius: 50% 50% 50% 0;
        background: ${style.color}; transform: rotate(-45deg);
        border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      "><span style="transform: rotate(45deg); color: #fff; font-size: 12px;">${style.label[0]}</span></div>`;

      const m = new AMap.Marker({
        position: [marker.lng, marker.lat],
        content,
        offset: new AMap.Pixel(-12, -24),
      });

      m.on('click', () => {
        openInfoWindow(marker, m);
      });

      mapRef.current.add(m);
      markersRef.current.push(m);
      markersMapRef.current.set(marker.id, { marker, instance: m });
    });
  }, [AMap, filteredMarkers]);

  /** 打开 InfoWindow 并平移到指定标点 */
  const openInfoWindow = (marker: GeoMarker, instance?: any) => {
    if (!mapRef.current || !infoWindowRef.current) return;
    const target = instance || markersMapRef.current.get(marker.id)?.instance;
    if (!target) return;
    const container = document.createElement('div');
    const root = createRoot(container);
    root.render(<InfoWindowContent marker={marker} />);
    infoWindowRef.current.setContent(container);
    infoWindowRef.current.open(mapRef.current, target.getPosition());
    mapRef.current.setZoomAndCenter(15, [marker.lng, marker.lat]);
  };

  /** 列表项点击：聚焦到标点 */
  const handleListClick = (marker: GeoMarker) => {
    openInfoWindow(marker);
  };

  const typeOptions = useMemo(
    () => [
      { label: '全部', value: 'all' as const },
      { label: '楼栋', value: 'building' as const },
      { label: '房屋', value: 'house' as const },
    ],
    [],
  );

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="高德地图加载失败"
          description={error.message}
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="geo-map-fullscreen">
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* 加载遮罩 */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            zIndex: 100,
          }}
        >
          <Spin tip="正在加载高德地图..." size="large">
            <div style={{ padding: '40px' }} />
          </Spin>
        </div>
      )}

      {/* 悬浮筛选面板 */}
      {!loading && (
        <Card
          size="small"
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 280,
            zIndex: 90,
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            borderRadius: 8,
          }}
          styles={{ body: { padding: 12 } }}
        >
          <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
            <EnvironmentOutlined style={{ marginRight: 6, color: '#1677ff' }} />
            地图标点
          </Title>

          <div style={{ marginBottom: 12 }}>
            <Segmented
              options={typeOptions}
              value={filter.type ?? 'all'}
              onChange={(val) => {
                setFilter((f) => ({
                  ...f,
                  type: val === 'all' ? undefined : (val as GeoMarkerType),
                }));
              }}
              block
            />
          </div>

          <Input.Search
            placeholder="搜索名称或描述"
            allowClear
            value={filter.keyword}
            onChange={(e) =>
              setFilter((f) => ({ ...f, keyword: e.target.value }))
            }
            style={{ marginBottom: 12 }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {markersLoading ? '加载中...' : `共 ${filteredMarkers.length} 个标点`}
            </Text>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['building', 'house'] as GeoMarkerType[]).map((t) => (
                <Tag
                  key={t}
                  color={t === 'building' ? 'blue' : 'green'}
                  style={{ margin: 0 }}
                >
                  {MARKER_STYLES[t].label}
                </Tag>
              ))}
            </div>
          </div>

          {/* 搜索结果列表 */}
          {!markersLoading && filteredMarkers.length > 0 && (
            <div
              style={{
                marginTop: 12,
                maxHeight: 320,
                overflowY: 'auto',
                borderTop: '1px solid #f0f0f0',
                paddingTop: 8,
              }}
            >
              {filteredMarkers.map((marker) => {
                const style = MARKER_STYLES[marker.type];
                return (
                  <div
                    key={marker.id}
                    onClick={() => handleListClick(marker)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ color: style.color, fontSize: 14, flexShrink: 0 }}>
                      {style.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {marker.name}
                      </div>
                      {marker.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#999',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {marker.description}
                        </div>
                      )}
                    </div>
                    <Tag
                      color={marker.type === 'building' ? 'blue' : 'green'}
                      style={{ margin: 0, flexShrink: 0 }}
                    >
                      {style.label}
                    </Tag>
                  </div>
                );
              })}
            </div>
          )}

          {!markersLoading && filteredMarkers.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="无匹配标点"
              style={{ marginTop: 12, marginBottom: 0 }}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default MapPage;
