import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { Alert, Card, Drawer, Empty, Input, Select, Space, Spin, Switch, Tag, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { useAmap } from '@/services/manual/amap';
import { houseApi } from '@/services/manual/house';
import { readMapSearchState } from './map-state';

const CHINA_CENTER: [number, number] = [104.1954, 35.8617];

type MapBounds = { west: number; south: number; east: number; north: number };

const PropertyRentalMapPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const initialState = useRef(readMapSearchState(window.location.search));
  const [keyword, setKeyword] = useState(initialState.current.keyword);
  const [estateId, setEstateId] = useState<number | undefined>(initialState.current.estateId);
  const [houseStatus, setHouseStatus] = useState<string | undefined>(initialState.current.houseStatus);
  const [includeInactive, setIncludeInactive] = useState(initialState.current.includeInactive);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | undefined>(initialState.current.selectedBuildingId);
  const [bounds, setBounds] = useState<MapBounds>();
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const fittedInitialMarkersRef = useRef(false);
  const { AMap, loading, error, reload } = useAmap(['AMap.MarkerClusterer']);
  const estates = useQuery({ queryKey: ['map-estates', workspace.selectedOrgSlug], queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }), enabled: Boolean(workspace.selectedOrgSlug) });
  const markers = useQuery({ queryKey: ['building-map', workspace.selectedOrgSlug, keyword, estateId, houseStatus, includeInactive, bounds], queryFn: () => houseApi.listBuildingMap({ keyword: keyword || undefined, estate_id: estateId, house_status: houseStatus, include_inactive: includeInactive, ...bounds, page: 1, page_size: 200 }), enabled: Boolean(workspace.selectedOrgSlug) });
  const unlocated = useQuery({ queryKey: ['building-map-unlocated', workspace.selectedOrgSlug], queryFn: houseApi.getBuildingMapUnlocatedCount, enabled: Boolean(workspace.selectedOrgSlug) });
  const detail = useQuery({ queryKey: ['building-map-detail', workspace.selectedOrgSlug, selectedBuildingId], queryFn: () => houseApi.getBuildingMapDetail(selectedBuildingId!), enabled: Boolean(selectedBuildingId && workspace.selectedOrgSlug) });

  useEffect(() => {
    const next = new URLSearchParams();
    if (keyword) next.set('keyword', keyword); if (estateId) next.set('estate_id', String(estateId)); if (houseStatus) next.set('house_status', houseStatus); if (includeInactive) next.set('include_inactive', 'true'); if (selectedBuildingId) next.set('selected_building_id', String(selectedBuildingId));
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${next.size ? `?${next}` : ''}`);
  }, [estateId, houseStatus, includeInactive, keyword, selectedBuildingId]);
  useEffect(() => {
    if (!AMap || !mapNode.current || mapRef.current) return;
    const map = new AMap.Map(mapNode.current, { zoom: 4, center: CHINA_CENTER });
    let timer: number | undefined;
    map.on('moveend', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = map.getBounds();
        const southWest = next.getSouthWest();
        const northEast = next.getNorthEast();
        setBounds({ west: southWest.lng, south: southWest.lat, east: northEast.lng, north: northEast.lat });
      }, 300);
    });
    mapRef.current = map;
    return () => { window.clearTimeout(timer); mapRef.current?.destroy(); mapRef.current = null; };
  }, [AMap]);
  useEffect(() => {
    if (!AMap || !mapRef.current) return;
    mapRef.current.clearMap();
    const points = markers.data?.items || [];
    const instances = points.map((item) => {
      const muted = item.counts.total === 0 ? '#8c8c8c' : '#1677ff';
      const marker = new AMap.Marker({
        position: [Number(item.lng), Number(item.lat)],
        title: `${item.name} · ${item.counts.total} 套`,
        content: `<div style="background:${muted};color:#fff;border-radius:16px;padding:4px 8px;white-space:nowrap;box-shadow:0 2px 6px #0003">${item.name} · ${item.counts.total}</div>`,
      });
      marker.on('click', () => setSelectedBuildingId(item.id));
      return marker;
    });
    if (AMap.MarkerClusterer) new AMap.MarkerClusterer(mapRef.current, instances);
    else mapRef.current.add(instances);
    if (instances.length && !fittedInitialMarkersRef.current && !bounds) {
      mapRef.current.setFitView(instances);
      fittedInitialMarkersRef.current = true;
    }
  }, [AMap, bounds, markers.data]);
  return <TenantSelectionGuard title="房源地图">
    <div style={{ height: 'calc(100vh - 120px)', position: 'relative' }}>
      {error ? <Alert type="error" message="高德地图加载失败" action={<a onClick={reload}>重试</a>} /> : <div ref={mapNode} style={{ position: 'absolute', inset: 0 }} />}
      <Card size="small" style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, width: 360 }}>
        <Space direction="vertical" className="w-full"><Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索小区、楼栋或地址" />
          <Select allowClear value={estateId} onChange={setEstateId} placeholder="全部小区" options={(estates.data?.items || []).map((item) => ({ value: item.id, label: item.display_name || item.name }))} />
          <Select allowClear value={houseStatus} onChange={setHouseStatus} placeholder="全部房态" options={[['vacant','空置'],['rented','已租'],['renovating','装修中'],['locked','封存']].map(([value,label]) => ({ value, label }))} />
          <Switch checked={includeInactive} onChange={setIncludeInactive} /> 包含停用楼栋
          <Typography.Text>结果 {markers.data?.total || 0} 栋 · 待定位 {unlocated.data?.count || 0} 栋</Typography.Text>
          <Link to="/property-rental/estates?task=building_location">补充楼栋位置</Link>
        </Space>
      </Card>
      {loading && <Spin style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 3 }} />}
      {!markers.isLoading && !markers.data?.items.length && <Empty style={{ position: 'absolute', left: '50%', top: '45%', zIndex: 3 }} description="没有匹配的已定位楼栋" />}
    </div>
    <Drawer open={Boolean(selectedBuildingId)} onClose={() => setSelectedBuildingId(undefined)} title={detail.data?.name || '楼栋汇总'} size="large">
      {detail.isLoading ? <Spin /> : detail.data && <><Typography.Paragraph>{detail.data.address}</Typography.Paragraph><Space wrap>{Object.entries(detail.data.counts).map(([key, value]) => <Tag key={key}>{key}: {value}</Tag>)}</Space><Card size="small" title="房源汇总" style={{ marginTop: 16 }}>{detail.data.houses.map((house) => <p key={house.id}><Link to={`/property-rental/houses/${house.id}`}>{house.room_number}</Link> · {house.status__mapping}</p>)}</Card><Space><Link to={`/property-rental/houses?building_id=${detail.data.id}`}>查看楼栋全部房源</Link><Link to={`/property-rental/buildings/${detail.data.id}?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`}>查看楼栋详情</Link></Space></>}
    </Drawer>
  </TenantSelectionGuard>;
};
export default PropertyRentalMapPage;
