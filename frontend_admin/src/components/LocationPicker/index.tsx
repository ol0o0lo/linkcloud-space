import { EnvironmentOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Modal, Space, Spin, Typography, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useAmap } from '@/services/manual/amap';

export type LocationValue = { address: string; lat: number; lng: number };

const CHINA_LOCATION: LocationValue = { address: '', lat: 35.8617, lng: 104.1954 };

function isLocation(value: LocationValue | null): value is LocationValue {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng));
}

function toLocation(value: unknown): LocationValue | null {
  if (!value || typeof value !== 'object') return null;
  const { address, lat, lng } = value as LocationValue;
  return typeof address === 'string' && Number.isFinite(lat) && Number.isFinite(lng) ? { address, lat, lng } : null;
}

export function LocationPicker({
  ariaLabel,
  value,
  fallbackLocation,
  onChange,
  disabled = false,
  allowClear = false,
}: {
  ariaLabel: string;
  value: LocationValue | null;
  fallbackLocation: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const { AMap, loading, error, reload } = useAmap(['AMap.PlaceSearch', 'AMap.Geocoder']);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LocationValue | null>(null);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const draftRef = useRef<LocationValue | null>(null);

  const updateDraft = (next: LocationValue) => {
    draftRef.current = next;
    setDraft(next);
  };

  const reverseGeocode = (next: LocationValue) => {
    if (!geocoderRef.current) {
      updateDraft(next);
      return;
    }
    geocoderRef.current.getAddress([next.lng, next.lat], (status: string, result: any) => {
      const address = status === 'complete' ? result?.regeocode?.formattedAddress || next.address : next.address;
      updateDraft({ ...next, address });
    });
  };

  const requestBrowserLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const next = { address: '', lat: position.coords.latitude, lng: position.coords.longitude };
        mapRef.current?.setZoomAndCenter(16, [next.lng, next.lat]);
        reverseGeocode(next);
      },
      () => {
        message.warning('未获取当前位置，已显示中国范围。');
        updateDraft(CHINA_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  const show = () => {
    const initial = toLocation(value) || toLocation(fallbackLocation);
    updateDraft(initial || CHINA_LOCATION);
    setOpen(true);
    if (!initial) requestBrowserLocation();
  };

  useEffect(() => {
    if (!open || !AMap || !draft) return;
    let map: any = null;
    let initializeFrame = 0;
    const mountFrame = window.requestAnimationFrame(() => {
      initializeFrame = window.requestAnimationFrame(() => {
        const initial = draftRef.current;
        if (!containerRef.current || mapRef.current || !initial) return;
        map = new AMap.Map(containerRef.current, {
          zoom: initial === CHINA_LOCATION ? 4 : 16,
          center: [initial.lng, initial.lat],
        });
        mapRef.current = map;
        geocoderRef.current = new AMap.Geocoder();
        map.on('click', (event: any) => reverseGeocode({ address: '', lat: event.lnglat.lat, lng: event.lnglat.lng }));
        map.on('dragend', () => {
          const center = map.getCenter();
          reverseGeocode({ address: '', lat: center.lat, lng: center.lng });
        });
        map.resize();
      });
    });
    return () => {
      window.cancelAnimationFrame(mountFrame);
      window.cancelAnimationFrame(initializeFrame);
      map?.destroy();
      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, [AMap, open]);

  const search = () => {
    if (!AMap || !searchText.trim()) return;
    const placeSearch = new AMap.PlaceSearch({ pageSize: 1 });
    placeSearch.search(searchText, (status: string, result: any) => {
      const poi = status === 'complete' ? result?.poiList?.pois?.[0] : null;
      if (!poi?.location) {
        message.warning('未找到匹配地址，请在地图上选择。');
        return;
      }
      mapRef.current?.setZoomAndCenter(16, poi.location);
      updateDraft({ address: poi.address || poi.name || '', lat: poi.location.lat, lng: poi.location.lng });
    });
  };

  return (
    <>
      <Button aria-label={ariaLabel} icon={<EnvironmentOutlined />} disabled={disabled} onClick={show}>
        {ariaLabel}
      </Button>
      <Modal
        open={open}
        title={ariaLabel}
        width={760}
        destroyOnHidden
        onCancel={() => setOpen(false)}
        footer={
          <Space>
            {allowClear && value && <Button onClick={() => { onChange(null); setOpen(false); }}>清除定位</Button>}
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button type="primary" disabled={!isLocation(draft)} onClick={() => { if (draft) onChange(draft); setOpen(false); }}>
              确定位置
            </Button>
          </Space>
        }
      >
        {error ? (
          <Alert type="error" showIcon title="高德地图加载失败" description={error.message} action={<Button size="small" onClick={reload}>重试</Button>} />
        ) : (
          <Space orientation="vertical" size="middle" className="w-full">
            <Space.Compact className="w-full">
              <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} onPressEnter={search} placeholder="搜索地址、POI、小区或楼栋" />
              <Button onClick={search}>搜索</Button>
              <Button onClick={requestBrowserLocation}>定位到当前位置</Button>
            </Space.Compact>
            <div ref={containerRef} style={{ width: '100%', height: 380, background: '#f5f5f5' }} />
            {loading && <Spin description="正在加载地图" />}
            <Typography.Text type={draft?.address ? undefined : 'secondary'}>
              {draft?.address || '未获取标准地址'} {draft ? `（${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}）` : ''}
            </Typography.Text>
          </Space>
        )}
      </Modal>
    </>
  );
}
