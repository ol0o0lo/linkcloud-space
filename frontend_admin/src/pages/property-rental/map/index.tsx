import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Spin } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import { useAmap } from '@/services/manual/amap';
import { type BuildingMapMarkerOut, houseApi } from '@/services/manual/house';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import { ADMIN_BASE_PATH, normalizeAdminPath } from '@/utils/adminRouting';
import { settingLocation } from '../location-utils';
import {
  BuildingDetailDrawer,
  BuildingResultPanel,
  MapToolbar,
} from './components';
import { readMapSearchState, sameBounds } from './map-state';
import { createBuildingMarkerContent } from './marker-content';

const CHINA_CENTER: [number, number] = [104.1954, 35.8617];
const VIEWPORT_DEBOUNCE_MS = 500;
const VIEWPORT_MAX_WAIT_MS = 1500;
const EMPTY_MARKERS: BuildingMapMarkerOut[] = [];

type MapBounds = { west: number; south: number; east: number; north: number };

function currentReturnTo() {
  return `${ADMIN_BASE_PATH}${normalizeAdminPath(window.location.pathname)}${window.location.search}`;
}

async function fetchAllMapPages<T>(
  fetchPage: (
    page: number,
  ) => Promise<{ items: T[]; total: number; page: number; page_size: number }>,
  pageSize = 200,
) {
  const first = await fetchPage(1);
  const pages = Math.ceil(first.total / pageSize);
  if (pages <= 1) return first;
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_item, index) => fetchPage(index + 2)),
  );
  return {
    ...first,
    items: [...first.items, ...rest.flatMap((page) => page.items)],
  };
}

const PropertyRentalMapPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const initialState = useRef(readMapSearchState(window.location.search));
  const [keywordInput, setKeywordInput] = useState(
    initialState.current.keyword,
  );
  const [keyword, setKeyword] = useState(initialState.current.keyword);
  const [estateId, setEstateId] = useState<number | undefined>(
    initialState.current.estateId,
  );
  const [houseStatus, setHouseStatus] = useState<string | undefined>(
    initialState.current.houseStatus,
  );
  const [includeInactive, setIncludeInactive] = useState(
    initialState.current.includeInactive,
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<
    number | undefined
  >(initialState.current.selectedBuildingId);
  const [bounds, setBounds] = useState<MapBounds>();
  const [viewport, setViewport] = useState(initialState.current.viewport);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const maxWaitRef = useRef<number | undefined>(undefined);
  const pendingBoundsRef = useRef<MapBounds | undefined>(undefined);
  const programmaticMoveRef = useRef(false);
  const userMovedRef = useRef(Boolean(initialState.current.viewport));
  const fittedInitialMarkersRef = useRef(false);
  const geolocationRequestedRef = useRef(false);
  const {
    AMap,
    loading: mapLoading,
    error: mapError,
    reload,
  } = useAmap(['AMap.MarkerClusterer']);

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const estates = useQuery({
    queryKey: ['map-estates', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 500 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const settings = useQuery({
    queryKey: ['map-settings', workspace.selectedOrgSlug],
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const businessFilters = useMemo(
    () => ({
      keyword: keyword || undefined,
      estate_id: estateId,
      house_status: houseStatus,
      include_inactive: includeInactive,
      page_size: 200,
    }),
    [estateId, houseStatus, includeInactive, keyword],
  );
  const markers = useQuery({
    queryKey: [
      'building-map',
      workspace.selectedOrgSlug,
      businessFilters,
      bounds,
    ],
    queryFn: () =>
      fetchAllMapPages((page) =>
        houseApi.listBuildingMap({ ...businessFilters, ...bounds, page }),
      ),
    enabled: Boolean(workspace.selectedOrgSlug),
    placeholderData: keepPreviousData,
  });
  const unlocated = useQuery({
    queryKey: [
      'building-map-unlocated',
      workspace.selectedOrgSlug,
      businessFilters,
    ],
    queryFn: () =>
      houseApi.listBuildingMapUnlocated({
        ...businessFilters,
        page: 1,
        page_size: 5,
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
    placeholderData: keepPreviousData,
  });
  const detail = useQuery({
    queryKey: [
      'building-map-detail',
      workspace.selectedOrgSlug,
      selectedBuildingId,
    ],
    queryFn: () => {
      if (!selectedBuildingId) throw new Error('缺少楼栋 ID');
      return houseApi.getBuildingMapDetail(selectedBuildingId);
    },
    enabled: Boolean(selectedBuildingId && workspace.selectedOrgSlug),
  });

  const selectedEstate = estates.data?.items.find(
    (item) => item.id === estateId,
  );
  const estateLocation =
    selectedEstate && selectedEstate.lat != null && selectedEstate.lng != null
      ? { lat: Number(selectedEstate.lat), lng: Number(selectedEstate.lng) }
      : undefined;
  const defaultLocation = settingLocation(
    settings.data?.find(
      (item) => item.key === 'property_rental.default_location',
    )?.value,
  );
  const locatedItems = markers.data?.items || EMPTY_MARKERS;
  const unlocatedItems = unlocated.data?.items || [];
  const aggregateCounts = locatedItems.reduce(
    (result, item) => ({
      total: result.total + item.counts.total,
      vacant: result.vacant + item.counts.vacant,
      rented: result.rented + item.counts.rented,
    }),
    { total: 0, vacant: 0, rented: 0 },
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (keyword) next.set('keyword', keyword);
    if (estateId) next.set('estate_id', String(estateId));
    if (houseStatus) next.set('house_status', houseStatus);
    if (includeInactive) next.set('include_inactive', 'true');
    if (selectedBuildingId)
      next.set('selected_building_id', String(selectedBuildingId));
    if (viewport) {
      next.set('center_lat', viewport.lat.toFixed(6));
      next.set('center_lng', viewport.lng.toFixed(6));
      next.set('zoom', String(Math.round(viewport.zoom * 10) / 10));
    }
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${next.size ? `?${next}` : ''}`,
    );
  }, [
    estateId,
    houseStatus,
    includeInactive,
    keyword,
    selectedBuildingId,
    viewport,
  ]);

  const commitPendingBounds = () => {
    window.clearTimeout(debounceRef.current);
    window.clearTimeout(maxWaitRef.current);
    debounceRef.current = undefined;
    maxWaitRef.current = undefined;
    const next = pendingBoundsRef.current;
    if (next)
      setBounds((current) => (sameBounds(current, next) ? current : next));
  };

  const captureMapViewport = (map: any, immediate = false) => {
    const next = map.getBounds();
    const southWest = next.getSouthWest();
    const northEast = next.getNorthEast();
    pendingBoundsRef.current = {
      west: southWest.lng,
      south: southWest.lat,
      east: northEast.lng,
      north: northEast.lat,
    };
    const center = map.getCenter();
    setViewport({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    window.clearTimeout(debounceRef.current);
    if (immediate) {
      commitPendingBounds();
      return;
    }
    debounceRef.current = window.setTimeout(
      commitPendingBounds,
      VIEWPORT_DEBOUNCE_MS,
    );
    if (!maxWaitRef.current)
      maxWaitRef.current = window.setTimeout(
        commitPendingBounds,
        VIEWPORT_MAX_WAIT_MS,
      );
  };

  useEffect(() => {
    if (!AMap || !mapNode.current || mapRef.current) return;
    const initial = initialState.current.viewport;
    const map = new AMap.Map(mapNode.current, {
      zoom: initial?.zoom || 4,
      center: initial ? [initial.lng, initial.lat] : CHINA_CENTER,
    });
    map.addControl(new AMap.Scale());
    map.addControl(
      new AMap.ToolBar({ position: { right: '20px', bottom: '90px' } }),
    );
    const handleInteractionStart = () => {
      if (!programmaticMoveRef.current) userMovedRef.current = true;
    };
    const handleViewportEnd = () => {
      const programmatic = programmaticMoveRef.current;
      programmaticMoveRef.current = false;
      captureMapViewport(map, programmatic);
    };
    map.on('movestart', handleInteractionStart);
    map.on('zoomstart', handleInteractionStart);
    map.on('moveend', handleViewportEnd);
    map.on('zoomend', handleViewportEnd);
    map.on('complete', () => captureMapViewport(map, true));
    mapRef.current = map;
    return () => {
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(maxWaitRef.current);
      map.destroy();
      mapRef.current = null;
    };
  }, [AMap]);

  const moveMapTo = (lng: number, lat: number, zoom = 16) => {
    if (!mapRef.current) return;
    programmaticMoveRef.current = true;
    mapRef.current.setZoomAndCenter(zoom, [lng, lat]);
    setViewport({ lat, lng, zoom });
  };

  useEffect(() => {
    if (
      !mapRef.current ||
      initialState.current.viewport ||
      userMovedRef.current
    )
      return;
    if (estateLocation) moveMapTo(estateLocation.lng, estateLocation.lat);
    else if (markers.isSuccess && !locatedItems.length && defaultLocation)
      moveMapTo(defaultLocation.lng, defaultLocation.lat, 14);
  }, [
    AMap,
    estateLocation?.lat,
    estateLocation?.lng,
    defaultLocation?.lat,
    defaultLocation?.lng,
    locatedItems.length,
    markers.isSuccess,
  ]);

  useEffect(() => {
    if (!AMap || !mapRef.current) return;
    clusterRef.current?.setMap?.(null);
    clusterRef.current = null;
    mapRef.current.clearMap();
    const instances = locatedItems.map((item) => {
      const selected = item.id === selectedBuildingId;
      const color = selected
        ? '#0958d9'
        : item.counts.total === 0
          ? '#8c8c8c'
          : '#1677ff';
      const marker = new AMap.Marker({
        position: [Number(item.lng), Number(item.lat)],
        title: `${item.name} · ${item.counts.total} 套`,
        content: createBuildingMarkerContent(
          item.name,
          item.counts.total,
          color,
        ),
        zIndex: selected ? 120 : 100,
      });
      marker.on('click', () => setSelectedBuildingId(item.id));
      return marker;
    });
    if (AMap.MarkerClusterer)
      clusterRef.current = new AMap.MarkerClusterer(mapRef.current, instances);
    else mapRef.current.add(instances);
    if (
      instances.length &&
      !fittedInitialMarkersRef.current &&
      !initialState.current.viewport &&
      !estateLocation &&
      !userMovedRef.current
    ) {
      programmaticMoveRef.current = true;
      mapRef.current.setFitView(instances);
      fittedInitialMarkersRef.current = true;
    }
  }, [
    AMap,
    estateLocation?.lat,
    estateLocation?.lng,
    locatedItems,
    selectedBuildingId,
  ]);

  useEffect(() => {
    if (
      geolocationRequestedRef.current ||
      initialState.current.viewport ||
      estateLocation ||
      defaultLocation ||
      !markers.isSuccess ||
      locatedItems.length ||
      !mapRef.current ||
      !navigator.geolocation
    )
      return;
    geolocationRequestedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) =>
        moveMapTo(position.coords.longitude, position.coords.latitude, 14),
      () => undefined,
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  }, [defaultLocation, estateLocation, locatedItems.length, markers.isSuccess]);

  const selectBuilding = (building: BuildingMapMarkerOut) => {
    setSelectedBuildingId(building.id);
    moveMapTo(Number(building.lng), Number(building.lat));
  };

  useEffect(() => {
    if (
      !detail.data ||
      detail.data.lat == null ||
      detail.data.lng == null ||
      !initialState.current.selectedBuildingId
    )
      return;
    moveMapTo(Number(detail.data.lng), Number(detail.data.lat));
    initialState.current.selectedBuildingId = undefined;
  }, [detail.data?.id]);
  const clearFilters = () => {
    setKeywordInput('');
    setKeyword('');
    setEstateId(undefined);
    setHouseStatus(undefined);
    setIncludeInactive(false);
  };
  const returnTo = currentReturnTo();
  const pendingListParams = new URLSearchParams({
    view: 'buildings',
    task: 'building_location',
  });
  if (estateId) pendingListParams.set('estate_id', String(estateId));
  if (keyword) pendingListParams.set('keyword', keyword);
  const pendingListHref = `/property-rental/estates?${pendingListParams.toString()}`;

  return (
    <TenantSelectionGuard title="房源地图">
      <div
        style={{
          height: 'calc(100vh - 128px)',
          minHeight: 620,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <MapToolbar
          keyword={keywordInput}
          estateId={estateId}
          houseStatus={houseStatus}
          includeInactive={includeInactive}
          estates={estates.data?.items || []}
          counts={{
            located: markers.data?.total || 0,
            unlocated: unlocated.data?.total || 0,
            ...aggregateCounts,
          }}
          updating={markers.isFetching || unlocated.isFetching}
          onKeywordChange={setKeywordInput}
          onEstateChange={(value) => {
            setEstateId(value);
            setBounds(undefined);
            userMovedRef.current = false;
            fittedInitialMarkersRef.current = false;
          }}
          onHouseStatusChange={setHouseStatus}
          onIncludeInactiveChange={setIncludeInactive}
          onClear={clearFilters}
        />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8 }}>
          <BuildingResultPanel
            located={locatedItems}
            unlocated={unlocatedItems}
            unlocatedTotal={unlocated.data?.total || 0}
            selectedId={selectedBuildingId}
            loading={markers.isLoading || unlocated.isLoading}
            locatedError={markers.isError}
            unlocatedError={unlocated.isError}
            returnTo={returnTo}
            pendingListHref={pendingListHref}
            onSelect={selectBuilding}
          />
          <Card
            size="small"
            styles={{ body: { padding: 0, height: '100%' } }}
            style={{
              flex: 1,
              minWidth: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {mapError ? (
              <Alert
                type="error"
                title="高德地图加载失败"
                description={mapError.message}
                action={<Button onClick={reload}>重试</Button>}
              />
            ) : (
              <div ref={mapNode} style={{ position: 'absolute', inset: 0 }} />
            )}
            {mapLoading ? (
              <Spin
                size="large"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  zIndex: 3,
                }}
              />
            ) : null}
          </Card>
        </div>
      </div>
      <BuildingDetailDrawer
        open={Boolean(selectedBuildingId)}
        loading={detail.isLoading}
        error={detail.isError}
        detail={detail.data}
        returnTo={returnTo}
        onClose={() => setSelectedBuildingId(undefined)}
      />
    </TenantSelectionGuard>
  );
};

export default PropertyRentalMapPage;
