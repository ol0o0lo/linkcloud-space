import { ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Segmented,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { useAmap } from '@/services/manual/amap';

const POI_RADIUS = 2000;
const POI_LIMIT = 4;

const POI_CATEGORIES = [
  { key: 'bus', label: '公交站', type: '150700' },
  { key: 'subway', label: '地铁站', type: '150500' },
  { key: 'education', label: '教育', type: '140000' },
  { key: 'medical', label: '医疗', type: '090000' },
] as const;

type PoiCategoryKey = (typeof POI_CATEGORIES)[number]['key'];

type NearbyPoi = {
  id: string;
  name: string;
  address: string;
  distance: number;
};

type Coordinates = {
  lat: number;
  lng: number;
};

const useStyles = createStyles(({ css, token }) => ({
  mapShell: css`
    position: relative;
    height: 210px;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  map: css`
    width: 100%;
    height: 210px;
    pointer-events: none;
  `,
  mapLoading: css`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, ${token.colorBgContainer} 76%, transparent);
  `,
  mapErrorPlaceholder: css`
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextTertiary};
  `,
  poiPanel: css`
    display: flex;
    flex-direction: column;
    margin-top: 14px;
  `,
  poiHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  `,
  categorySwitch: css`
    width: 100%;
    margin-bottom: 8px;

    .ant-segmented-group {
      width: 100%;
    }

    .ant-segmented-item {
      flex: 1;
      min-width: 0;
    }
  `,
  poiList: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  poiItem: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-bottom: 0;
    }
  `,
  poiMain: css`
    min-width: 0;
  `,
  poiAddress: css`
    display: block;
    margin-top: 3px;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  if (
    lat == null ||
    lng == null ||
    (typeof lat === 'string' && !lat.trim()) ||
    (typeof lng === 'string' && !lng.trim())
  ) {
    return null;
  }
  const nextLat = Number(lat);
  const nextLng = Number(lng);
  if (
    !Number.isFinite(nextLat) ||
    !Number.isFinite(nextLng) ||
    nextLat < -90 ||
    nextLat > 90 ||
    nextLng < -180 ||
    nextLng > 180
  ) {
    return null;
  }
  return { lat: nextLat, lng: nextLng };
}

function coordinateFromPoi(location: any, key: 'lat' | 'lng') {
  const getter = key === 'lat' ? 'getLat' : 'getLng';
  const value = location?.[key] ?? location?.[getter]?.();
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function approximateDistance(
  center: Coordinates,
  point: { lat?: number; lng?: number },
) {
  if (point.lat == null || point.lng == null) return 0;
  const earthRadius = 6371000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latDelta = radians(point.lat - center.lat);
  const lngDelta = radians(point.lng - center.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(center.lat)) *
      Math.cos(radians(point.lat)) *
      Math.sin(lngDelta / 2) ** 2;
  return Math.round(
    earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
}

function normalizePois(result: any, center: Coordinates): NearbyPoi[] {
  const rawPois = Array.isArray(result?.poiList?.pois)
    ? result.poiList.pois
    : [];
  return rawPois.slice(0, POI_LIMIT).flatMap((poi: any, index: number) => {
    const name = typeof poi?.name === 'string' ? poi.name.trim() : '';
    if (!name) return [];
    const lat = coordinateFromPoi(poi.location, 'lat');
    const lng = coordinateFromPoi(poi.location, 'lng');
    const rawDistance = Number(poi.distance);
    const distance = Number.isFinite(rawDistance)
      ? Math.max(0, Math.round(rawDistance))
      : approximateDistance(center, { lat, lng });
    const address = [poi.pname, poi.cityname, poi.adname, poi.address]
      .filter((item) => typeof item === 'string' && item.trim())
      .join('');
    return [
      {
        id: String(poi.id || `${name}-${index}`),
        name,
        address: address || '暂无详细地址',
        distance,
      },
    ];
  });
}

function distanceText(distance: number) {
  if (distance < 1000) return `${distance} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

function LocatedPoiContent({
  buildingName,
  coordinates,
}: {
  buildingName: string;
  coordinates: Coordinates;
}) {
  const { styles } = useStyles();
  const {
    AMap,
    loading: mapLoading,
    error: mapError,
    reload,
  } = useAmap(['AMap.PlaceSearch']);
  const [categoryKey, setCategoryKey] = useState<PoiCategoryKey>('bus');
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiError, setPoiError] = useState<string>();
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const requestRef = useRef(0);
  const category =
    POI_CATEGORIES.find((item) => item.key === categoryKey) ||
    POI_CATEGORIES[0];

  useEffect(() => {
    if (!AMap || !mapNodeRef.current || mapRef.current) return;
    const map = new AMap.Map(mapNodeRef.current, {
      center: [coordinates.lng, coordinates.lat],
      zoom: 16,
      resizeEnable: true,
      dragEnable: false,
      zoomEnable: false,
      doubleClickZoom: false,
      keyboardEnable: false,
      scrollWheel: false,
      touchZoom: false,
      rotateEnable: false,
      pitchEnable: false,
    });
    const marker = new AMap.Marker({
      position: [coordinates.lng, coordinates.lat],
      title: buildingName,
      zIndex: 200,
    });
    map.add(marker);
    mapRef.current = map;
    window.requestAnimationFrame(() => map.resize?.());

    return () => {
      map.destroy?.();
      mapRef.current = null;
    };
  }, [AMap, buildingName, coordinates.lat, coordinates.lng]);

  useEffect(() => {
    if (!AMap) return;
    const requestId = ++requestRef.current;
    setPoiLoading(true);
    setPoiError(undefined);
    const placeSearch = new AMap.PlaceSearch({
      type: category.type,
      pageIndex: 1,
      pageSize: POI_LIMIT,
      extensions: 'base',
    });
    placeSearch.searchNearBy(
      '',
      [coordinates.lng, coordinates.lat],
      POI_RADIUS,
      (status: string, result: any) => {
        if (requestId !== requestRef.current) return;
        if (status !== 'complete') {
          setPois([]);
          setPoiError('暂时无法获取周边设施，请稍后重试。');
          setPoiLoading(false);
          return;
        }
        setPois(normalizePois(result, coordinates));
        setPoiLoading(false);
      },
    );
    return () => {
      requestRef.current += 1;
    };
  }, [AMap, category.type, coordinates]);

  return (
    <>
      {mapError ? (
        <>
          <div className={styles.mapShell}>
            <div className={styles.mapErrorPlaceholder}>地图暂不可用</div>
          </div>
          <Alert
            action={
              <Button icon={<ReloadOutlined />} size="small" onClick={reload}>
                重试
              </Button>
            }
            description={mapError.message}
            showIcon
            style={{ marginTop: 12 }}
            title="地图与周边设施加载失败"
            type="error"
          />
        </>
      ) : (
        <>
          <div className={styles.mapShell}>
            <div
              aria-label={`${buildingName} 当前定位只读地图`}
              className={styles.map}
              ref={mapNodeRef}
              role="img"
            />
            {mapLoading ? (
              <div className={styles.mapLoading}>
                <Spin description="正在加载地图" />
              </div>
            ) : null}
          </div>

          <div className={styles.poiPanel}>
            <div className={styles.poiHeader}>
              <Typography.Text strong>2 公里内周边设施</Typography.Text>
              {!poiLoading && !poiError ? (
                <Tag color="blue">{pois.length} 个结果</Tag>
              ) : null}
            </div>
            <Segmented
              aria-label="周边设施分类"
              block
              className={styles.categorySwitch}
              onChange={(value) => setCategoryKey(value as PoiCategoryKey)}
              options={POI_CATEGORIES.map((item) => ({
                label: item.label,
                value: item.key,
              }))}
              value={categoryKey}
            />
            {poiError ? (
              <Alert description={poiError} showIcon type="warning" />
            ) : poiLoading ? (
              <div className={styles.mapLoading} style={{ position: 'static' }}>
                <Spin description={`正在获取${category.label}设施`} />
              </div>
            ) : pois.length ? (
              <ul
                aria-label={`${category.label} POI`}
                className={styles.poiList}
              >
                {pois.map((poi) => (
                  <li className={styles.poiItem} key={poi.id}>
                    <div className={styles.poiMain}>
                      <Typography.Text strong>{poi.name}</Typography.Text>
                      <span className={styles.poiAddress} title={poi.address}>
                        {poi.address}
                      </span>
                    </div>
                    <Tag>{distanceText(poi.distance)}</Tag>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                description={`2 公里内暂无${category.label}设施`}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function HouseLocationPoiCard({
  buildingId,
  buildingName,
  lat,
  lng,
  returnTo,
}: {
  buildingId: number;
  buildingName: string;
  lat?: number | string | null;
  lng?: number | string | null;
  returnTo: string;
}) {
  const coordinates = useMemo(() => toCoordinates(lat, lng), [lat, lng]);
  const mapHref = coordinates
    ? `/dashboard/rental/properties/map?selected_building_id=${buildingId}&center_lat=${coordinates.lat.toFixed(6)}&center_lng=${coordinates.lng.toFixed(6)}&zoom=16`
    : undefined;
  const editHref = `/dashboard/rental/properties/estates?view=buildings&task=building_location&building_edit=${buildingId}&return_to=${encodeURIComponent(returnTo)}`;

  return (
    <Card
      extra={
        mapHref ? (
          <Button href={mapHref} type="link">
            在房源地图查看
          </Button>
        ) : null
      }
      title="位置与周边"
    >
      {coordinates ? (
        <LocatedPoiContent
          buildingName={buildingName}
          coordinates={coordinates}
        />
      ) : (
        <Empty description="楼栋尚未维护地图定位">
          <Button
            aria-label="去维护定位"
            href={editHref}
            icon={<AppIcon name="location" />}
          >
            去维护定位
          </Button>
        </Empty>
      )}
    </Card>
  );
}

export { distanceText, normalizePois, toCoordinates };
