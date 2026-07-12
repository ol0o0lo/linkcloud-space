import AMapLoader from '@amap/amap-jsapi-loader';
import { useEffect, useRef, useState } from 'react';
import { appsBaseApiAppContext } from '@/services/openapi/appSystem';

// 高德地图 SDK 实例类型（loader 返回的是全局 AMap 对象）
type AMapInstance = any;

interface UseAmapResult {
  AMap: AMapInstance | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

/**
 * useAmap - 加载高德 JSAPI 2.0 SDK 的 React Hook
 * 从后端 app-context 获取 amapJsapiKey 和 amapSecurityJsCode，
 * 在加载前设置 window._AMapSecurityConfig，返回 { AMap, loading, error }。
 */
export function useAmap(plugins: string[] = []): UseAmapResult {
  const [AMap, setAMap] = useState<AMapInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;

    async function loadAmap() {
      try {
        const ctx = await appsBaseApiAppContext({ skipErrorHandler: true });
        const key = ctx?.amapJsapiKey || '';
        const securityJsCode = ctx?.amapSecurityJsCode || '';

        if (!key) {
          throw new Error(
            '高德地图 JSAPI Key 未配置，请在后端 .env 中设置 AMAP_JSAPI_KEY',
          );
        }

        if (securityJsCode) {
          window._AMapSecurityConfig = { securityJsCode };
        }

        const amap = await AMapLoader.load({
          key,
          version: '2.0',
          plugins: [...new Set(['AMap.Scale', 'AMap.ToolBar', ...plugins])],
        });

        if (cancelled) return;
        setAMap(amap);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }

    loadAmap();

    return () => {
      cancelled = true;
    };
  }, [plugins.join(','), retry]);

  return {
    AMap,
    loading,
    error,
    reload: () => {
      loadedRef.current = false;
      setAMap(null);
      setError(null);
      setLoading(true);
      setRetry((value) => value + 1);
    },
  };
}
