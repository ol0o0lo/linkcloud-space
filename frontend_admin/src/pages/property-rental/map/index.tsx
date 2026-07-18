import { AimOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Spin, Tag } from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  BuildingResultPanel,
  EstateResultPanel,
  MapToolbar,
} from './components';
import {
  type EstateMapDisplayPoint,
  getMapDisplayLevel,
  getMapPrimaryMetric,
  isBuildingDisplayLevel,
  isEstateDisplayLevel,
  mergeEstateMapDisplayPoints,
  sumMapCounts,
  summarizeEstateMapPoints,
} from './map-display';
import { readMapSearchState, sameBounds } from './map-state';
import {
  createBuildingClusterMarkerContent,
  createBuildingCompactMarkerContent,
  createBuildingInfoWindowContent,
  createBuildingLocationMarkerContent,
  createEstateClusterMarkerContent,
  createEstateMapMarkerContent,
} from './marker-content';

const CHINA_CENTER: [number, number] = [104.1954, 35.8617];
const VIEWPORT_DEBOUNCE_MS = 500;
const VIEWPORT_MAX_WAIT_MS = 1500;
const DIRECT_MARKER_LIMIT = 80;
const EMPTY_MARKERS: BuildingMapMarkerOut[] = [];
const RESULT_PANEL_COLLAPSED_KEY = 'property-rental-map:result-panel-collapsed';

type MapBounds = { west: number; south: number; east: number; north: number };
type ClusterPoint = {
  lnglat: [number, number];
  building: BuildingMapMarkerOut;
};
type EstateClusterPoint = {
  lnglat: [number, number];
  point: EstateMapDisplayPoint;
};

function currentReturnTo() {
  return `${ADMIN_BASE_PATH}${normalizeAdminPath(window.location.pathname)}${window.location.search}`;
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
  const [selectedBuildingId, setSelectedBuildingId] = useState<
    number | undefined
  >(initialState.current.selectedBuildingId);
  const [focusedBuildingId, setFocusedBuildingId] = useState<
    number | undefined
  >(initialState.current.selectedBuildingId);
  const [focusedEstateKey, setFocusedEstateKey] = useState<
    string | undefined
  >();
  const [bounds, setBounds] = useState<MapBounds>();
  const [viewport, setViewport] = useState(initialState.current.viewport);
  const [resultPanelCollapsed, setResultPanelCollapsed] = useState(
    () =>
      window.innerWidth < 1000 ||
      window.localStorage.getItem(RESULT_PANEL_COLLAPSED_KEY) === 'true',
  );
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const infoWindowBuildingIdRef = useRef<number | undefined>(undefined);
  const committedKeywordRef = useRef(initialState.current.keyword);
  const debounceRef = useRef<number | undefined>(undefined);
  const maxWaitRef = useRef<number | undefined>(undefined);
  const pendingBoundsRef = useRef<MapBounds | undefined>(undefined);
  const pendingDeepLinkIdRef = useRef(initialState.current.selectedBuildingId);
  const pendingInfoBuildingRef = useRef<BuildingMapMarkerOut | undefined>(
    undefined,
  );
  const programmaticMoveRef = useRef(false);
  const mapCompletedRef = useRef(false);
  const userMovedRef = useRef(Boolean(initialState.current.viewport));
  const fittedInitialMarkersRef = useRef(false);
  const geolocationRequestedRef = useRef(false);
  const activeOrgSlugRef = useRef(workspace.selectedOrgSlug);
  const {
    AMap,
    loading: mapLoading,
    error: mapError,
    reload,
  } = useAmap(['AMap.MarkerCluster']);
  const mapLevel = getMapDisplayLevel(viewport?.zoom ?? 4);
  const estateDisplayLevel = isEstateDisplayLevel(mapLevel);
  const buildingDisplayLevel = isBuildingDisplayLevel(mapLevel);

  const cancelPendingBounds = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    window.clearTimeout(maxWaitRef.current);
    debounceRef.current = undefined;
    maxWaitRef.current = undefined;
    pendingBoundsRef.current = undefined;
  }, []);

  const cancelPendingDeepLink = useCallback(() => {
    pendingDeepLinkIdRef.current = undefined;
    pendingInfoBuildingRef.current = undefined;
    initialState.current.selectedBuildingId = undefined;
  }, []);

  const resetViewportScope = useCallback(() => {
    cancelPendingBounds();
    setBounds(undefined);
    initialState.current.viewport = undefined;
    userMovedRef.current = false;
    fittedInitialMarkersRef.current = false;
  }, [cancelPendingBounds]);

  const closeBuildingInfo = useCallback((clearSelection = false) => {
    const current = infoWindowRef.current;
    infoWindowRef.current = null;
    infoWindowBuildingIdRef.current = undefined;
    current?.close?.();
    if (clearSelection) setSelectedBuildingId(undefined);
  }, []);

  useEffect(() => {
    const previousOrgSlug = activeOrgSlugRef.current;
    const nextOrgSlug = workspace.selectedOrgSlug;
    activeOrgSlugRef.current = nextOrgSlug;
    if (!previousOrgSlug || !nextOrgSlug || previousOrgSlug === nextOrgSlug)
      return;
    initialState.current.estateId = undefined;
    setEstateId(undefined);
    cancelPendingDeepLink();
    resetViewportScope();
    setViewport(undefined);
    closeBuildingInfo(true);
    setFocusedBuildingId(undefined);
    setFocusedEstateKey(undefined);
    geolocationRequestedRef.current = false;
  }, [
    cancelPendingDeepLink,
    closeBuildingInfo,
    resetViewportScope,
    workspace.selectedOrgSlug,
  ]);

  const applyKeyword = useCallback(
    (value: string, forceGlobal = false) => {
      const next = value.trim();
      setKeywordInput(value);
      if (next === committedKeywordRef.current && !forceGlobal) return;
      if (next !== committedKeywordRef.current) {
        committedKeywordRef.current = next;
        setKeyword(next);
      }
      cancelPendingDeepLink();
      resetViewportScope();
      closeBuildingInfo(true);
      setFocusedBuildingId(undefined);
      setFocusedEstateKey(undefined);
    },
    [cancelPendingDeepLink, closeBuildingInfo, resetViewportScope],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => applyKeyword(keywordInput), 300);
    return () => window.clearTimeout(timer);
  }, [applyKeyword, keywordInput]);

  const selectedEstateQuery = useQuery({
    queryKey: ['map-selected-estate', workspace.selectedOrgSlug, estateId],
    queryFn: () => {
      if (!estateId) throw new Error('缺少小区 ID');
      return houseApi.getEstate(estateId);
    },
    enabled: Boolean(workspace.selectedOrgSlug && estateId),
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
    }),
    [estateId, houseStatus, keyword],
  );
  const buildingMarkers = useQuery({
    queryKey: [
      'building-map',
      workspace.selectedOrgSlug,
      businessFilters,
      bounds,
    ],
    queryFn: () =>
      houseApi.listBuildingMap({
        ...businessFilters,
        ...bounds,
        page: 1,
        page_size: 500,
      }),
    enabled: Boolean(workspace.selectedOrgSlug && buildingDisplayLevel),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === workspace.selectedOrgSlug
        ? previousData
        : undefined,
  });
  const estateMarkers = useQuery({
    queryKey: [
      'estate-map',
      workspace.selectedOrgSlug,
      businessFilters,
      bounds,
    ],
    queryFn: () =>
      houseApi.listEstateMap({
        ...businessFilters,
        ...bounds,
        page: 1,
        page_size: 500,
      }),
    enabled: Boolean(workspace.selectedOrgSlug && estateDisplayLevel),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === workspace.selectedOrgSlug
        ? previousData
        : undefined,
  });
  const standaloneMarkers = useQuery({
    queryKey: [
      'building-map-standalone',
      workspace.selectedOrgSlug,
      businessFilters,
      bounds,
    ],
    queryFn: () =>
      houseApi.listBuildingMap({
        ...businessFilters,
        ...bounds,
        standalone_only: true,
        page: 1,
        page_size: 500,
      }),
    enabled: Boolean(workspace.selectedOrgSlug && estateDisplayLevel),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === workspace.selectedOrgSlug
        ? previousData
        : undefined,
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
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === workspace.selectedOrgSlug
        ? previousData
        : undefined,
  });
  const selectedEstate = selectedEstateQuery.data;
  const estateLocation =
    selectedEstate && selectedEstate.lat != null && selectedEstate.lng != null
      ? { lat: Number(selectedEstate.lat), lng: Number(selectedEstate.lng) }
      : undefined;
  const defaultLocation = settingLocation(
    settings.data?.find(
      (item) => item.key === 'property_rental.default_location',
    )?.value,
  );
  const locatedItems = buildingMarkers.data?.items || EMPTY_MARKERS;
  const estateDisplayPoints = useMemo(
    () =>
      mergeEstateMapDisplayPoints(
        estateMarkers.data?.items || [],
        standaloneMarkers.data?.items || EMPTY_MARKERS,
      ),
    [estateMarkers.data?.items, standaloneMarkers.data?.items],
  );
  const estateSummary = useMemo(
    () => summarizeEstateMapPoints(estateDisplayPoints),
    [estateDisplayPoints],
  );
  const aggregateCounts = useMemo(
    () =>
      estateDisplayLevel ? estateSummary.counts : sumMapCounts(locatedItems),
    [estateDisplayLevel, estateSummary.counts, locatedItems],
  );
  const visiblePointCount = estateDisplayLevel
    ? estateDisplayPoints.length
    : locatedItems.length;
  const visibleBuildingCount = estateDisplayLevel
    ? estateSummary.buildingCount
    : locatedItems.length;
  const mapDataLoading = estateDisplayLevel
    ? estateMarkers.isLoading || standaloneMarkers.isLoading
    : buildingMarkers.isLoading;
  const mapDataFetching = estateDisplayLevel
    ? estateMarkers.isFetching || standaloneMarkers.isFetching
    : buildingMarkers.isFetching;
  const mapDataError = estateDisplayLevel
    ? estateMarkers.isError || standaloneMarkers.isError
    : buildingMarkers.isError;
  const mapDataSuccess = estateDisplayLevel
    ? estateMarkers.isSuccess && standaloneMarkers.isSuccess
    : buildingMarkers.isSuccess;
  const mapResultsTruncated = estateDisplayLevel
    ? (estateMarkers.data?.total || 0) >
        (estateMarkers.data?.items.length || 0) ||
      (standaloneMarkers.data?.total || 0) >
        (standaloneMarkers.data?.items.length || 0)
    : (buildingMarkers.data?.total || 0) >
      (buildingMarkers.data?.items.length || 0);
  const unlocatedItems = unlocated.data?.items || [];
  const pendingDeepLinkId = pendingDeepLinkIdRef.current;
  const pendingDeepLinkIsLocated = Boolean(
    pendingDeepLinkId &&
      locatedItems.some((item) => item.id === pendingDeepLinkId),
  );
  const pendingDeepLinkBuilding = useQuery({
    queryKey: [
      'building-map-deep-link',
      workspace.selectedOrgSlug,
      pendingDeepLinkId,
    ],
    queryFn: () => {
      if (!pendingDeepLinkId) throw new Error('缺少楼栋 ID');
      return houseApi.getBuildingMapDetail(pendingDeepLinkId);
    },
    enabled: Boolean(
      workspace.selectedOrgSlug &&
        pendingDeepLinkId &&
        !pendingDeepLinkIsLocated,
    ),
    retry: false,
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (keyword) next.set('keyword', keyword);
    if (estateId) next.set('estate_id', String(estateId));
    if (houseStatus) next.set('house_status', houseStatus);
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
  }, [estateId, houseStatus, keyword, selectedBuildingId, viewport]);

  const commitPendingBounds = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    window.clearTimeout(maxWaitRef.current);
    debounceRef.current = undefined;
    maxWaitRef.current = undefined;
    const next = pendingBoundsRef.current;
    pendingBoundsRef.current = undefined;
    if (next)
      setBounds((current) => (sameBounds(current, next) ? current : next));
  }, []);

  const captureMapViewport = useCallback(
    (map: any, immediate = false) => {
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
    },
    [commitPendingBounds],
  );

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
      if (!programmaticMoveRef.current) {
        if (mapCompletedRef.current && pendingDeepLinkIdRef.current) {
          cancelPendingDeepLink();
          setSelectedBuildingId(undefined);
          setFocusedBuildingId(undefined);
        }
        userMovedRef.current = true;
      }
    };
    const handleViewportEnd = () => {
      const programmatic = programmaticMoveRef.current;
      programmaticMoveRef.current = false;
      captureMapViewport(map, programmatic);
    };
    const handleMapClick = () => {
      cancelPendingDeepLink();
      closeBuildingInfo(true);
      setFocusedBuildingId(undefined);
      setFocusedEstateKey(undefined);
    };
    map.on('movestart', handleInteractionStart);
    map.on('zoomstart', handleInteractionStart);
    map.on('moveend', handleViewportEnd);
    map.on('zoomend', handleViewportEnd);
    map.on('click', handleMapClick);
    map.on('complete', () => {
      mapCompletedRef.current = true;
      captureMapViewport(map, true);
    });
    mapRef.current = map;
    return () => {
      cancelPendingBounds();
      closeBuildingInfo();
      clusterRef.current?.setMap?.(null);
      clusterRef.current = null;
      map.destroy();
      mapRef.current = null;
      mapCompletedRef.current = false;
    };
  }, [
    AMap,
    cancelPendingBounds,
    cancelPendingDeepLink,
    captureMapViewport,
    closeBuildingInfo,
  ]);

  const moveMapTo = (lng: number, lat: number, zoom = 16) => {
    if (!mapRef.current) return;
    const currentCenter = mapRef.current.getCenter?.();
    const currentZoom = Number(mapRef.current.getZoom?.());
    programmaticMoveRef.current = !(
      currentCenter &&
      Math.abs(Number(currentCenter.lng) - lng) < 0.000001 &&
      Math.abs(Number(currentCenter.lat) - lat) < 0.000001 &&
      Math.abs(currentZoom - zoom) < 0.01
    );
    mapRef.current.setZoomAndCenter(zoom, [lng, lat]);
    setViewport({ lat, lng, zoom });
  };

  const fitMapToCoordinates = useCallback(
    (points: Array<[number, number]>, maxZoom = 16) => {
      const map = mapRef.current;
      const validPoints = points.filter(
        ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat),
      );
      if (!AMap || !map || !validPoints.length) return;
      programmaticMoveRef.current = true;
      if (validPoints.length === 1) {
        const [lng, lat] = validPoints[0];
        map.setZoomAndCenter(Math.min(15, maxZoom), [lng, lat]);
        setViewport({ lat, lng, zoom: Math.min(15, maxZoom) });
        return;
      }
      const lngs = validPoints.map(([lng]) => lng);
      const lats = validPoints.map(([, lat]) => lat);
      const southWest: [number, number] = [
        Math.min(...lngs),
        Math.min(...lats),
      ];
      const northEast: [number, number] = [
        Math.max(...lngs),
        Math.max(...lats),
      ];
      if (southWest[0] === northEast[0] && southWest[1] === northEast[1]) {
        map.setZoomAndCenter(Math.min(15, maxZoom), southWest);
        setViewport({
          lat: southWest[1],
          lng: southWest[0],
          zoom: Math.min(15, maxZoom),
        });
        return;
      }
      map.setBounds(
        new AMap.Bounds(southWest, northEast),
        true,
        [56, 56, 56, 56],
      );
      const center = map.getCenter?.();
      const fittedZoom = Number(map.getZoom?.());
      const nextZoom = Number.isFinite(fittedZoom)
        ? Math.min(fittedZoom, maxZoom)
        : maxZoom;
      if (center && fittedZoom > maxZoom)
        map.setZoomAndCenter(nextZoom, [center.lng, center.lat]);
      if (center)
        setViewport({ lat: center.lat, lng: center.lng, zoom: nextZoom });
    },
    [AMap],
  );

  const openBuildingInfoWindow = useCallback(
    (building: BuildingMapMarkerOut) => {
      if (!AMap || !mapRef.current) return;
      closeBuildingInfo();
      const infoWindow = new AMap.InfoWindow({
        content: createBuildingInfoWindowContent(building, {
          adminBasePath: ADMIN_BASE_PATH,
          returnTo: currentReturnTo(),
        }),
        offset: new AMap.Pixel(0, -34),
        closeWhenClickMap: true,
        autoMove: true,
      });
      infoWindowRef.current = infoWindow;
      infoWindowBuildingIdRef.current = building.id;
      infoWindow.on?.('close', () => {
        if (infoWindowRef.current !== infoWindow) return;
        infoWindowRef.current = null;
        infoWindowBuildingIdRef.current = undefined;
        setSelectedBuildingId(undefined);
      });
      infoWindow.open(mapRef.current, [
        Number(building.lng),
        Number(building.lat),
      ]);
    },
    [AMap, closeBuildingInfo],
  );

  useEffect(() => {
    if (
      !mapRef.current ||
      initialState.current.viewport ||
      userMovedRef.current
    )
      return;
    if (estateLocation) moveMapTo(estateLocation.lng, estateLocation.lat);
    else if (mapDataSuccess && !visiblePointCount && defaultLocation)
      moveMapTo(defaultLocation.lng, defaultLocation.lat, 14);
  }, [
    AMap,
    estateLocation?.lat,
    estateLocation?.lng,
    defaultLocation?.lat,
    defaultLocation?.lng,
    mapDataSuccess,
    visiblePointCount,
  ]);

  useEffect(() => {
    if (!AMap || !mapRef.current) return;
    const map = mapRef.current;
    const openedBuildingId = infoWindowBuildingIdRef.current;
    closeBuildingInfo();
    clusterRef.current?.setMap?.(null);
    clusterRef.current = null;
    map.clearMap();

    const openBuildingMarker = (
      building: BuildingMapMarkerOut,
      compact: boolean,
    ) => {
      cancelPendingDeepLink();
      setFocusedEstateKey(undefined);
      setFocusedBuildingId(building.id);
      setSelectedBuildingId(building.id);
      userMovedRef.current = true;
      if (compact) {
        pendingInfoBuildingRef.current = building;
        moveMapTo(Number(building.lng), Number(building.lat), 16);
      } else {
        openBuildingInfoWindow(building);
      }
    };

    const drillEstatePoint = (point: EstateMapDisplayPoint) => {
      cancelPendingDeepLink();
      closeBuildingInfo(true);
      setFocusedBuildingId(point.buildingId);
      setFocusedEstateKey(point.key);
      userMovedRef.current = true;
      fittedInitialMarkersRef.current = true;
      moveMapTo(point.lng, point.lat, mapLevel === 'estate-cluster' ? 10 : 14);
    };

    let instances: any[] = [];
    let clustered = false;

    if (estateDisplayLevel) {
      const createEstateMarker = (point: EstateMapDisplayPoint) => {
        const metric = getMapPrimaryMetric(point.counts, houseStatus);
        const marker = new AMap.Marker({
          position: [point.lng, point.lat],
          title: `${point.name} · ${metric.label} ${metric.value} 套`,
          content: createEstateMapMarkerContent({
            name: point.name,
            primaryLabel: metric.label,
            primaryValue: metric.value,
            buildingCount: point.buildingCount,
            selected: focusedEstateKey === point.key,
          }),
          anchor: 'center',
          bubble: false,
          clickable: true,
          zIndex: focusedEstateKey === point.key ? 120 : 100,
        });
        marker.on('click', () => drillEstatePoint(point));
        return marker;
      };

      const useEstateSdkCluster =
        (mapLevel === 'estate-cluster' ||
          estateDisplayPoints.length > DIRECT_MARKER_LIMIT) &&
        AMap.MarkerCluster;
      if (!useEstateSdkCluster) {
        const groupThreshold = mapLevel === 'estate-cluster' ? 160 : 96;
        const markerGroups: Array<{
          points: EstateMapDisplayPoint[];
          x: number;
          y: number;
          lng: number;
          lat: number;
        }> = [];
        for (const point of estateDisplayPoints) {
          const pixel = map.lngLatToContainer?.(
            new AMap.LngLat(point.lng, point.lat),
          );
          const x = Number(pixel?.x);
          const y = Number(pixel?.y);
          const group = markerGroups.find(
            (candidate) =>
              Number.isFinite(x) &&
              Number.isFinite(y) &&
              Math.hypot(candidate.x - x, candidate.y - y) < groupThreshold,
          );
          if (!group) {
            markerGroups.push({
              points: [point],
              x,
              y,
              lng: point.lng,
              lat: point.lat,
            });
            continue;
          }
          const nextSize = group.points.length + 1;
          group.x = (group.x * group.points.length + x) / nextSize;
          group.y = (group.y * group.points.length + y) / nextSize;
          group.lng = (group.lng * group.points.length + point.lng) / nextSize;
          group.lat = (group.lat * group.points.length + point.lat) / nextSize;
          group.points.push(point);
        }
        instances = markerGroups.map((group) => {
          if (group.points.length === 1)
            return createEstateMarker(group.points[0]);
          const counts = sumMapCounts(group.points);
          const metric = getMapPrimaryMetric(counts, houseStatus);
          const marker = new AMap.Marker({
            position: [group.lng, group.lat],
            title: `${group.points.length} 个项目`,
            content: createEstateClusterMarkerContent({
              estateCount: group.points.length,
              buildingCount: group.points.reduce(
                (total, point) => total + point.buildingCount,
                0,
              ),
              primaryLabel: metric.label,
              primaryValue: metric.value,
            }),
            anchor: 'center',
            bubble: false,
            clickable: true,
            zIndex: 100,
          });
          marker.on('click', () => {
            cancelPendingDeepLink();
            closeBuildingInfo(true);
            setFocusedBuildingId(undefined);
            setFocusedEstateKey(undefined);
            userMovedRef.current = true;
            fittedInitialMarkersRef.current = true;
            moveMapTo(
              group.lng,
              group.lat,
              mapLevel === 'estate-cluster'
                ? 10
                : Math.min(Number(map.getZoom?.() || 10) + 2, 14),
            );
          });
          return marker;
        });
      } else {
        instances = estateDisplayPoints.map(createEstateMarker);
      }

      if (useEstateSdkCluster) {
        const points = estateDisplayPoints.map(
          (point): EstateClusterPoint => ({
            lnglat: [point.lng, point.lat],
            point,
          }),
        );
        let cluster: any;
        try {
          cluster = new AMap.MarkerCluster(map, points, {
            gridSize: mapLevel === 'estate-cluster' ? 86 : 60,
            renderMarker: ({ marker, data }: any) => {
              const point = (data?.[0] as EstateClusterPoint | undefined)
                ?.point;
              if (!point) return;
              const metric = getMapPrimaryMetric(point.counts, houseStatus);
              marker.setTitle?.(
                `${point.name} · ${metric.label} ${metric.value} 套`,
              );
              marker.setContent?.(
                createEstateMapMarkerContent({
                  name: point.name,
                  primaryLabel: metric.label,
                  primaryValue: metric.value,
                  buildingCount: point.buildingCount,
                  selected: focusedEstateKey === point.key,
                }),
              );
              marker.setAnchor?.('center');
            },
            renderClusterMarker: ({ marker, clusterData, count }: any) => {
              const clusterPoints = (clusterData || []) as EstateClusterPoint[];
              const includesAllPoints = count === estateDisplayPoints.length;
              const buildingCount = includesAllPoints
                ? estateSummary.buildingCount
                : clusterPoints.reduce(
                    (total, item) => total + item.point.buildingCount,
                    0,
                  );
              const counts = includesAllPoints
                ? estateSummary.counts
                : sumMapCounts(clusterPoints.map((item) => item.point));
              const metric = getMapPrimaryMetric(counts, houseStatus);
              marker.setContent?.(
                createEstateClusterMarkerContent({
                  estateCount: count,
                  buildingCount,
                  primaryLabel: metric.label,
                  primaryValue: metric.value,
                }),
              );
              marker.setAnchor?.('center');
            },
          });
          if (typeof cluster.on !== 'function') {
            cluster.setMap?.(null);
            throw new Error('小区聚合器不支持点击事件');
          }
          cluster.on('click', (event: any) => {
            const clusterPoints = (event.clusterData ||
              []) as EstateClusterPoint[];
            if (clusterPoints.length === 1) {
              drillEstatePoint(clusterPoints[0].point);
              return;
            }
            if (clusterPoints.length > 1) {
              cancelPendingDeepLink();
              closeBuildingInfo(true);
              setFocusedBuildingId(undefined);
              setFocusedEstateKey(undefined);
              userMovedRef.current = true;
              fittedInitialMarkersRef.current = true;
              const position = event.lnglat || event.marker?.getPosition?.();
              if (position)
                map.setZoomAndCenter(
                  Math.min(Number(map.getZoom?.() || 8) + 2, 14),
                  position,
                );
            }
          });
          clusterRef.current = cluster;
          clustered = true;
        } catch {
          cluster?.setMap?.(null);
          clusterRef.current = null;
        }
      }
    } else {
      const compact = mapLevel === 'building-compact';
      const createBuildingMarker = (
        item: BuildingMapMarkerOut,
        compactMarker: boolean,
      ) => {
        const metric = getMapPrimaryMetric(item.counts, houseStatus);
        const focused = focusedBuildingId === item.id;
        const marker = new AMap.Marker({
          position: [Number(item.lng), Number(item.lat)],
          title: `${item.name} · ${metric.label} ${metric.value} 套`,
          ...(compactMarker
            ? {
                content: createBuildingCompactMarkerContent({
                  name: item.name,
                  primaryLabel: metric.label,
                  primaryValue: metric.value,
                  selected: focused,
                }),
                anchor: 'center',
              }
            : {
                label: {
                  content: `${metric.value} 套`,
                  direction: 'top',
                },
                anchor: 'bottom-center',
              }),
          bubble: false,
          clickable: true,
          zIndex: focused ? 120 : 100,
        });
        marker.on('click', () => openBuildingMarker(item, compactMarker));
        return marker;
      };

      const useSdkCluster =
        locatedItems.length > DIRECT_MARKER_LIMIT && AMap.MarkerCluster;
      if (!useSdkCluster) {
        const groupThreshold = compact ? 72 : 28;
        const markerGroups: Array<{
          items: BuildingMapMarkerOut[];
          x: number;
          y: number;
          lng: number;
          lat: number;
        }> = [];
        for (const item of locatedItems) {
          const lng = Number(item.lng);
          const lat = Number(item.lat);
          const pixel = map.lngLatToContainer?.(new AMap.LngLat(lng, lat));
          const x = Number(pixel?.x);
          const y = Number(pixel?.y);
          const group = markerGroups.find(
            (candidate) =>
              Number.isFinite(x) &&
              Number.isFinite(y) &&
              Math.hypot(candidate.x - x, candidate.y - y) < groupThreshold,
          );
          if (!group) {
            markerGroups.push({ items: [item], x, y, lng, lat });
            continue;
          }
          const nextSize = group.items.length + 1;
          group.x = (group.x * group.items.length + x) / nextSize;
          group.y = (group.y * group.items.length + y) / nextSize;
          group.lng = (group.lng * group.items.length + lng) / nextSize;
          group.lat = (group.lat * group.items.length + lat) / nextSize;
          group.items.push(item);
        }
        instances = markerGroups.map((group) => {
          if (group.items.length === 1)
            return createBuildingMarker(group.items[0], compact);
          const marker = new AMap.Marker({
            position: [group.lng, group.lat],
            title: `${group.items.length} 栋楼栋`,
            content: createBuildingClusterMarkerContent(group.items.length),
            anchor: 'center',
            bubble: false,
            clickable: true,
            zIndex: 100,
          });
          marker.on('click', () => {
            cancelPendingDeepLink();
            closeBuildingInfo(true);
            setFocusedBuildingId(undefined);
            setFocusedEstateKey(undefined);
            userMovedRef.current = true;
            fittedInitialMarkersRef.current = true;
            moveMapTo(
              group.lng,
              group.lat,
              compact ? 16 : Math.min(Number(map.getZoom?.() || 16) + 2, 20),
            );
          });
          return marker;
        });
      } else {
        instances = locatedItems.map((item) =>
          createBuildingMarker(item, compact),
        );
      }

      if (useSdkCluster) {
        const points = locatedItems.map(
          (building): ClusterPoint => ({
            lnglat: [Number(building.lng), Number(building.lat)],
            building,
          }),
        );
        let cluster: any;
        try {
          cluster = new AMap.MarkerCluster(map, points, {
            gridSize: 60,
            renderMarker: ({ marker, data }: any) => {
              const building = (data?.[0] as ClusterPoint | undefined)
                ?.building;
              if (!building) return;
              const metric = getMapPrimaryMetric(building.counts, houseStatus);
              marker.setTitle?.(
                `${building.name} · ${metric.label} ${metric.value} 套`,
              );
              marker.setContent?.(
                compact
                  ? createBuildingCompactMarkerContent({
                      name: building.name,
                      primaryLabel: metric.label,
                      primaryValue: metric.value,
                      selected: focusedBuildingId === building.id,
                    })
                  : createBuildingLocationMarkerContent(metric.value),
              );
              marker.setAnchor?.(compact ? 'center' : 'bottom-center');
            },
            renderClusterMarker: ({ marker, count }: any) => {
              marker.setContent?.(createBuildingClusterMarkerContent(count));
              marker.setAnchor?.('center');
            },
          });
          if (typeof cluster.on !== 'function') {
            cluster.setMap?.(null);
            throw new Error('楼栋聚合器不支持点击事件');
          }
          cluster.on('click', (event: any) => {
            const clusterPoints = (event.clusterData || []) as ClusterPoint[];
            if (clusterPoints.length === 1) {
              openBuildingMarker(clusterPoints[0].building, compact);
              return;
            }
            if (clusterPoints.length > 1) {
              cancelPendingDeepLink();
              closeBuildingInfo(true);
              setFocusedBuildingId(undefined);
              userMovedRef.current = true;
              fittedInitialMarkersRef.current = true;
              const position = event.lnglat || event.marker?.getPosition?.();
              if (position)
                map.setZoomAndCenter(
                  Math.min(Number(map.getZoom?.() || 16) + 2, 19),
                  position,
                );
            }
          });
          clusterRef.current = cluster;
          clustered = true;
        } catch {
          cluster?.setMap?.(null);
          clusterRef.current = null;
        }
      }
    }

    if (!clustered) map.add(instances);

    if (buildingDisplayLevel) {
      const openedBuilding = locatedItems.find(
        (item) => item.id === openedBuildingId,
      );
      if (openedBuilding) openBuildingInfoWindow(openedBuilding);
    }

    const visibleCoordinates = estateDisplayLevel
      ? estateDisplayPoints.map(
          (point) => [point.lng, point.lat] as [number, number],
        )
      : locatedItems.map(
          (item) => [Number(item.lng), Number(item.lat)] as [number, number],
        );
    if (
      visibleCoordinates.length &&
      !fittedInitialMarkersRef.current &&
      !initialState.current.viewport &&
      !estateLocation &&
      !userMovedRef.current
    ) {
      fitMapToCoordinates(visibleCoordinates, estateDisplayLevel ? 13 : 16);
      fittedInitialMarkersRef.current = true;
    }
  }, [
    AMap,
    buildingDisplayLevel,
    cancelPendingDeepLink,
    closeBuildingInfo,
    estateDisplayLevel,
    estateDisplayPoints,
    estateSummary,
    estateLocation?.lat,
    estateLocation?.lng,
    fitMapToCoordinates,
    focusedBuildingId,
    focusedEstateKey,
    houseStatus,
    locatedItems,
    mapLevel,
    openBuildingInfoWindow,
  ]);

  useEffect(() => {
    if (
      geolocationRequestedRef.current ||
      initialState.current.viewport ||
      estateLocation ||
      defaultLocation ||
      !mapDataSuccess ||
      visiblePointCount ||
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
  }, [defaultLocation, estateLocation, mapDataSuccess, visiblePointCount]);

  const selectBuilding = (building: BuildingMapMarkerOut) => {
    cancelPendingDeepLink();
    closeBuildingInfo(true);
    setFocusedEstateKey(undefined);
    setFocusedBuildingId(building.id);
    moveMapTo(Number(building.lng), Number(building.lat));
  };

  const selectEstatePoint = (point: EstateMapDisplayPoint) => {
    cancelPendingDeepLink();
    closeBuildingInfo(true);
    setFocusedBuildingId(point.buildingId);
    setFocusedEstateKey(point.key);
    userMovedRef.current = true;
    fittedInitialMarkersRef.current = true;
    moveMapTo(point.lng, point.lat, mapLevel === 'estate-cluster' ? 10 : 14);
  };

  const fitVisibleResults = () => {
    const points = estateDisplayLevel
      ? estateDisplayPoints.map(
          (point) => [point.lng, point.lat] as [number, number],
        )
      : locatedItems.map(
          (item) => [Number(item.lng), Number(item.lat)] as [number, number],
        );
    if (!points.length) return;
    userMovedRef.current = true;
    fittedInitialMarkersRef.current = true;
    fitMapToCoordinates(points, estateDisplayLevel ? 13 : 16);
  };

  const toggleResultPanel = () => {
    setResultPanelCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(RESULT_PANEL_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!mapNode.current || !window.ResizeObserver) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map) return;
        map.resize();
        captureMapViewport(map, true);
      });
    });
    observer.observe(mapNode.current);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [captureMapViewport]);

  useEffect(() => {
    const buildingId = pendingDeepLinkIdRef.current;
    if (
      !buildingId ||
      pendingInfoBuildingRef.current ||
      !AMap ||
      !mapRef.current
    )
      return;
    const locatedBuilding = locatedItems.find((item) => item.id === buildingId);
    if (locatedBuilding) {
      cancelPendingBounds();
      userMovedRef.current = true;
      fittedInitialMarkersRef.current = true;
      setFocusedBuildingId(locatedBuilding.id);
      setFocusedEstateKey(undefined);
      pendingInfoBuildingRef.current = locatedBuilding;
      moveMapTo(Number(locatedBuilding.lng), Number(locatedBuilding.lat));
      return;
    }
    if (pendingDeepLinkBuilding.isError) {
      cancelPendingDeepLink();
      closeBuildingInfo(true);
      return;
    }
    const detail = pendingDeepLinkBuilding.data;
    if (!detail) return;
    if (detail.lat == null || detail.lng == null) {
      cancelPendingDeepLink();
      closeBuildingInfo(true);
      return;
    }
    const building: BuildingMapMarkerOut = {
      id: detail.id,
      estate: detail.estate,
      name: detail.name,
      address: detail.address,
      lat: detail.lat,
      lng: detail.lng,
      counts: detail.counts,
    };
    cancelPendingBounds();
    userMovedRef.current = true;
    fittedInitialMarkersRef.current = true;
    setFocusedBuildingId(building.id);
    setFocusedEstateKey(undefined);
    pendingInfoBuildingRef.current = building;
    moveMapTo(Number(building.lng), Number(building.lat));
  }, [
    AMap,
    cancelPendingBounds,
    cancelPendingDeepLink,
    closeBuildingInfo,
    locatedItems,
    pendingDeepLinkBuilding.data,
    pendingDeepLinkBuilding.isError,
  ]);

  useEffect(() => {
    const building = pendingInfoBuildingRef.current;
    if (
      !building ||
      !AMap ||
      !mapRef.current ||
      programmaticMoveRef.current ||
      buildingMarkers.isFetching
    )
      return;
    openBuildingInfoWindow(building);
    pendingInfoBuildingRef.current = undefined;
    cancelPendingDeepLink();
  }, [
    AMap,
    bounds,
    buildingMarkers.isFetching,
    cancelPendingDeepLink,
    openBuildingInfoWindow,
    viewport,
  ]);

  useEffect(() => {
    if (
      !estateDisplayLevel ||
      pendingDeepLinkIdRef.current ||
      !selectedBuildingId
    )
      return;
    closeBuildingInfo(true);
    setFocusedBuildingId(undefined);
  }, [closeBuildingInfo, estateDisplayLevel, selectedBuildingId]);

  useEffect(() => {
    if (
      !selectedBuildingId ||
      buildingMarkers.isFetching ||
      !buildingMarkers.isSuccess ||
      infoWindowBuildingIdRef.current === selectedBuildingId ||
      pendingDeepLinkIdRef.current === selectedBuildingId ||
      locatedItems.some((item) => item.id === selectedBuildingId)
    )
      return;
    closeBuildingInfo(true);
  }, [
    closeBuildingInfo,
    buildingMarkers.isFetching,
    buildingMarkers.isSuccess,
    locatedItems,
    selectedBuildingId,
  ]);

  const clearFilters = () => {
    committedKeywordRef.current = '';
    setKeywordInput('');
    setKeyword('');
    setEstateId(undefined);
    setHouseStatus(undefined);
    cancelPendingDeepLink();
    resetViewportScope();
    closeBuildingInfo(true);
    setFocusedBuildingId(undefined);
    setFocusedEstateKey(undefined);
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
          houseStatus={houseStatus}
          hasFilters={Boolean(keywordInput || estateId || houseStatus)}
          counts={{
            levelLabel:
              mapLevel === 'estate-cluster'
                ? '聚合'
                : estateDisplayLevel
                  ? '小区'
                  : '楼栋',
            located: visiblePointCount,
            buildings: visibleBuildingCount,
            unlocated: unlocated.data?.total || 0,
            ...aggregateCounts,
          }}
          updating={mapDataFetching || unlocated.isFetching}
          onKeywordChange={setKeywordInput}
          onKeywordSearch={(value) => applyKeyword(value, true)}
          onHouseStatusChange={(value) => {
            cancelPendingDeepLink();
            closeBuildingInfo(true);
            setFocusedBuildingId(undefined);
            setFocusedEstateKey(undefined);
            setHouseStatus(value);
          }}
          onClear={clearFilters}
        />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8 }}>
          {estateDisplayLevel ? (
            <EstateResultPanel
              points={estateDisplayPoints}
              houseStatus={houseStatus}
              collapsed={resultPanelCollapsed}
              focusedKey={focusedEstateKey}
              loading={mapDataLoading}
              error={mapDataError}
              truncated={mapResultsTruncated}
              onSelect={selectEstatePoint}
              onToggleCollapsed={toggleResultPanel}
              onRetry={() => {
                estateMarkers.refetch();
                standaloneMarkers.refetch();
              }}
            />
          ) : (
            <BuildingResultPanel
              located={locatedItems}
              unlocated={unlocatedItems}
              unlocatedTotal={unlocated.data?.total || 0}
              collapsed={resultPanelCollapsed}
              selectedId={focusedBuildingId}
              loading={buildingMarkers.isLoading || unlocated.isLoading}
              truncated={mapResultsTruncated}
              locatedError={buildingMarkers.isError}
              unlocatedError={unlocated.isError}
              returnTo={returnTo}
              pendingListHref={pendingListHref}
              onSelect={selectBuilding}
              onToggleCollapsed={toggleResultPanel}
              onRetryLocated={() => buildingMarkers.refetch()}
              onRetryUnlocated={() => unlocated.refetch()}
            />
          )}
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
              <section
                aria-label="房源楼栋地图"
                style={{ position: 'absolute', inset: 0 }}
              >
                <div ref={mapNode} style={{ width: '100%', height: '100%' }} />
              </section>
            )}
            {!mapError ? (
              <Tag
                color="blue"
                style={{ position: 'absolute', top: 12, left: 12, zIndex: 3 }}
              >
                {mapLevel === 'estate-cluster'
                  ? '概览视图 · 点击聚合点或放大查看小区'
                  : mapLevel === 'estate'
                    ? '小区视图 · 点击气泡查看楼栋'
                    : mapLevel === 'building-compact'
                      ? '楼栋视图 · 继续放大查看详细位置'
                      : '楼栋详情视图'}
              </Tag>
            ) : null}
            {!mapError && visiblePointCount ? (
              <Button
                icon={<AimOutlined />}
                onClick={fitVisibleResults}
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}
              >
                适配当前结果
              </Button>
            ) : null}
            {mapLoading || mapDataLoading ? (
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
    </TenantSelectionGuard>
  );
};

export default PropertyRentalMapPage;
