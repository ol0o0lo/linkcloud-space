# 高德地图接入 — 管理后台地图页面 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 frontend_admin 中新增一个全屏地图页面，接入高德 JSAPI 2.0 SDK，使用 mock 数据渲染标点，支持筛选和信息窗交互。

**Architecture:** 后端通过 app-context API 下发高德 Key 和安全密钥；前端通过 `@amap/amap-jsapi-loader` 动态加载 SDK，用 React hook 封装生命周期；地图页面采用全屏地图 + 悬浮控制面板的布局方式；mock 数据通过 Umi 内置 mock 体系提供。

**Tech Stack:** React 18 + Umi Max v4 + antd v6 + @amap/amap-jsapi-loader + Django Ninja (app-context API)

---

## Task 1: 后端 — 添加高德配置项到 settings

**Files:**
- Modify: `config/settings/_base.py` — 新增 `AMAP_JSAPI_KEY` 和 `AMAP_SECURITY_JS_CODE` 读取
- Modify: `pyproject.toml` — 新增 epicenv 变量定义

- [ ] **Step 1: 在 pyproject.toml 中添加环境变量定义**

在 `[tool.epicenv.variables]` 区块末尾（Social 提供商配置之前或末尾均可），添加：

```toml
# Amap (高德地图)
AMAP_JSAPI_KEY = { type = "str", default = "", help_text = "Amap JSAPI key for map rendering" }
AMAP_SECURITY_JS_CODE = { type = "str", default = "", help_text = "Amap JSAPI security code (required for JSAPI 2.0)" }
```

- [ ] **Step 2: 在 config/settings/_base.py 中读取环境变量**

在 `SITE_URL` 定义之后（约 335 行附近），添加：

```python
# Amap (高德地图)
AMAP_JSAPI_KEY = env("AMAP_JSAPI_KEY", default="")
AMAP_SECURITY_JS_CODE = env("AMAP_SECURITY_JS_CODE", default="")
```

- [ ] **Step 3: 在 .env 中添加配置（开发用）**

在项目根 `.env` 文件中追加（值为空，留占位）：

```
AMAP_JSAPI_KEY=
AMAP_SECURITY_JS_CODE=
```

- [ ] **Step 4: 提交**

```bash
git add config/settings/_base.py pyproject.toml .env
git commit -m "feat: 添加高德地图 JSAPI Key 和安全密钥配置项"
```

---

## Task 2: 后端 — app-context API 追加高德字段

**Files:**
- Modify: `apps/base/api.py` — AppContextOut Schema 追加两个字段，app_context() 追加返回值

- [ ] **Step 1: 修改 AppContextOut Schema**

在 `apps/base/api.py` 的 `AppContextOut` 类中，`version` 字段之后追加：

```python
    amapJsapiKey: str = ""
    amapSecurityJsCode: str = ""
```

- [ ] **Step 2: 修改 app_context() 返回值**

在 `app_context()` 函数中，未认证分支的返回值追加：

```python
            "amapJsapiKey": getattr(settings, "AMAP_JSAPI_KEY", ""),
            "amapSecurityJsCode": getattr(settings, "AMAP_SECURITY_JS_CODE", ""),
```

在已认证分支的返回值中也追加同样的两个字段。

- [ ] **Step 3: 提交**

```bash
git add apps/base/api.py
git commit -m "feat: app-context API 追加高德地图配置字段"
```

---

## Task 3: 前端 — 安装高德 SDK loader + 重新生成 OpenAPI 客户端

**Files:**
- Modify: `frontend_admin/package.json` — 新增 `@amap/amap-jsapi-loader` 依赖
- Regenerate: `frontend_admin/src/services/openapi/` — 运行 OpenAPI 代码生成

- [ ] **Step 1: 安装 @amap/amap-jsapi-loader**

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin
nvm use 22
npm install @amap/amap-jsapi-loader
```

- [ ] **Step 2: 重新生成 OpenAPI 客户端**

需要先确保后端容器正在运行且 app-context 接口已更新（包含 amapJsapiKey 和 amapSecurityJsCode 字段）。然后：

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin
nvm use 22
npm run openapi
```

验证生成结果中 `AppContextOut` 类型包含 `amapJsapiKey` 和 `amapSecurityJsCode` 字段：

```bash
grep -A15 'type AppContextOut' src/services/openapi/typings.d.ts
```

预期输出中应包含：
```typescript
    amapJsapiKey: string;
    amapSecurityJsCode: string;
```

- [ ] **Step 3: 提交**

```bash
git add frontend_admin/package.json frontend_admin/package-lock.json frontend_admin/src/services/openapi/
git commit -m "feat: 安装 @amap/amap-jsapi-loader 并重新生成 OpenAPI 客户端"
```

---

## Task 4: 前端 — 添加路由和 i18n 菜单

**Files:**
- Modify: `frontend_admin/config/routes.ts` — 新增 `/geo` 分组和 `/geo/map` 子路由
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts` — 中文菜单翻译
- Modify: `frontend_admin/src/locales/en-US/menu.ts` — 英文菜单翻译

- [ ] **Step 1: 在 config/routes.ts 中添加路由**

在 `personal-business` 路由块之前，添加新的路由分组：

```typescript
  {
    path: '/geo',
    name: 'geo',
    icon: 'environment',
    routes: [
      {
        path: '/geo',
        redirect: '/geo/map',
      },
      {
        name: 'map',
        icon: 'global',
        path: '/geo/map',
        component: './geo/map',
      },
    ],
  },
```

注意：放在 `personal-business` 路由块之前以保持路由表的结构一致性。

- [ ] **Step 2: 在 zh-CN/menu.ts 中添加翻译**

在文件末尾 `};` 之前追加：

```typescript
  'menu.geo': '地理',
  'menu.geo.map': '地图',
```

- [ ] **Step 3: 在 en-US/menu.ts 中添加翻译**

在文件末尾 `};` 之前追加：

```typescript
  'menu.geo': 'Geo',
  'menu.geo.map': 'Map',
```

- [ ] **Step 4: 提交**

```bash
git add frontend_admin/config/routes.ts frontend_admin/src/locales/zh-CN/menu.ts frontend_admin/src/locales/en-US/menu.ts
git commit -m "feat: 添加 /geo/map 路由和 i18n 菜单翻译"
```

---

## Task 5: 前端 — 创建类型定义和 mock 数据

**Files:**
- Create: `frontend_admin/src/pages/geo/map/data.d.ts` — GeoMarker 类型
- Create: `frontend_admin/src/pages/geo/map/_mock.ts` — Mock 标点数据

- [ ] **Step 1: 创建类型定义文件**

创建 `frontend_admin/src/pages/geo/map/data.d.ts`：

```typescript
declare namespace API {
  interface GeoMarker {
    id: number;
    name: string;
    type: 'building' | 'house';
    lng: number;
    lat: number;
    address?: string;
    description?: string;
  }

  interface GeoMarkerListOut {
    items: GeoMarker[];
  }
}
```

- [ ] **Step 2: 创建 mock 数据文件**

创建 `frontend_admin/src/pages/geo/map/_mock.ts`：

```typescript
export default {
  'GET /api/geo/markers': {
    items: [
      {
        id: 1,
        name: 'A栋办公楼',
        type: 'building',
        lng: 120.0268,
        lat: 30.2796,
        address: '杭州市西湖区文三路 478 号',
        description: '12层办公楼，含地下停车场',
      },
      {
        id: 2,
        name: 'B栋研发楼',
        type: 'building',
        lng: 120.0321,
        lat: 30.2815,
        address: '杭州市西湖区文三路 500 号',
        description: '8层研发楼，配有实验室',
      },
      {
        id: 3,
        name: '1号住宅',
        type: 'house',
        lng: 120.1298,
        lat: 30.2602,
        address: '杭州市上城区延安路 88 号',
        description: '6层住宅楼，共 48 户',
      },
      {
        id: 4,
        name: '2号住宅',
        type: 'house',
        lng: 120.1365,
        lat: 30.2631,
        address: '杭州市上城区延安路 102 号',
        description: '18层高层住宅，共 216 户',
      },
      {
        id: 5,
        name: 'C栋综合楼',
        type: 'building',
        lng: 120.0195,
        lat: 30.2752,
        address: '杭州市西湖区学院路 58 号',
        description: '商住综合楼，1-3 层商业',
      },
      {
        id: 6,
        name: '3号住宅',
        type: 'house',
        lng: 120.1553,
        lat: 30.2548,
        address: '杭州市拱墅区湖墅南路 66 号',
        description: '4层低层住宅，含花园',
      },
      {
        id: 7,
        name: 'D栋创业中心',
        type: 'building',
        lng: 120.0412,
        lat: 30.2878,
        address: '杭州市余杭区海创路 18 号',
        description: '5层创业孵化中心',
      },
      {
        id: 8,
        name: '4号住宅',
        type: 'house',
        lng: 120.1023,
        lat: 30.2455,
        address: '杭州市滨江区江南大道 399 号',
        description: '25层高层住宅，共 300 户',
      },
    ],
  },
};
```

- [ ] **Step 3: 提交**

```bash
git add frontend_admin/src/pages/geo/map/data.d.ts frontend_admin/src/pages/geo/map/_mock.ts
git commit -m "feat: 添加地图标点类型定义和 mock 数据"
```

---

## Task 6: 前端 — 创建 useAmap hook

**Files:**
- Create: `frontend_admin/src/services/manual/amap.ts` — SDK 加载 hook

- [ ] **Step 1: 创建 useAmap hook**

创建 `frontend_admin/src/services/manual/amap.ts`：

```typescript
import AMapLoader from '@amap/amap-jsapi-loader';
import { useEffect, useState } from 'react';

interface UseAmapResult {
  AMap: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  loading: boolean;
  error: Error | null;
}

export function useAmap(key: string, securityJsCode?: string): UseAmapResult {
  const [AMap, setAMap] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!key) {
      setLoading(false);
      setError(new Error('高德地图 Key 未配置，请在 .env 中设置 AMAP_JSAPI_KEY'));
      return;
    }

    // Set security config before loading (required for JSAPI 2.0)
    if (securityJsCode) {
      (window as any)._AMapSecurityConfig = { securityJsCode }; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    let cancelled = false;

    AMapLoader.load({ key, version: '2.0' })
      .then((AMapInstance: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!cancelled) {
          setAMap(AMapInstance);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, securityJsCode]);

  return { AMap, loading, error };
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend_admin/src/services/manual/amap.ts
git commit -m "feat: 添加 useAmap hook 封装高德 SDK 加载"
```

---

## Task 7: 前端 — 创建地图主页面

**Files:**
- Create: `frontend_admin/src/pages/geo/map/index.tsx` — 地图主页面（含 MapContainer、FilterPanel、InfoWindow）

- [ ] **Step 1: 创建地图主页面**

创建 `frontend_admin/src/pages/geo/map/index.tsx`：

```tsx
import { EnvironmentOutlined, GlobalOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Alert, Badge, Button, Input, Result, Select, Spin, Tooltip } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { appsBaseApiAppContext } from '@/services/openapi/appSystem';
import { useAmap } from '@/services/manual/amap';

const MARKER_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'building', label: '楼栋' },
  { value: 'house', label: '住宅' },
] as const;

const DEFAULT_CENTER: [number, number] = [120.15, 30.28];
const DEFAULT_ZOOM = 12;

const MOCK_MARKERS: API.GeoMarker[] = [
  // Mock data is in _mock.ts, but we also provide a fallback here
  // in case the mock endpoint is not reachable
];

function MarkerIcon({ type }: { type: string }) {
  const isBuilding = type === 'building';
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        background: isBuilding ? '#1677ff' : '#52c41a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ transform: 'rotate(45deg)', fontSize: 14, color: '#fff' }}>
        {isBuilding ? '🏢' : '🏠'}
      </span>
    </div>
  );
}

function InfoWindowContent({ marker }: { marker: API.GeoMarker }) {
  return (
    <div style={{ padding: '8px 4px', minWidth: 180 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{marker.name}</div>
      <div style={{ marginBottom: 4 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            fontSize: 11,
            borderRadius: 4,
            background: marker.type === 'building' ? '#e6f4ff' : '#f6ffed',
            color: marker.type === 'building' ? '#1677ff' : '#52c41a',
          }}
        >
          {marker.type === 'building' ? '楼栋' : '住宅'}
        </span>
      </div>
      {marker.address && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>📍 {marker.address}</div>
      )}
      <div style={{ fontSize: 12, color: '#999' }}>
        {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
      </div>
      {marker.description && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{marker.description}</div>
      )}
    </div>
  );
}

const GeoMapPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const [filterType, setFilterType] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Fetch app context to get amap keys
  const { data: appContext } = useRequest(() => appsBaseApiAppContext());

  const amapKey = appContext?.amapJsapiKey || '';
  const securityJsCode = appContext?.amapSecurityJsCode || '';

  const { AMap, loading: amapLoading, error: amapError } = useAmap(amapKey, securityJsCode);

  // Fetch mock markers
  const { data: markersData, loading: markersLoading } = useRequest(
    () => fetch('/api/geo/markers').then((r) => r.json()) as Promise<API.GeoMarkerListOut>,
    { manual: !amapKey },
  );

  const markers = markersData?.items || [];
  const filteredMarkers = markers.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.address && m.address.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Validate coordinates
  const validMarkers = filteredMarkers.filter((m) => {
    const valid = m.lat >= -90 && m.lat <= 90 && m.lng >= -180 && m.lng <= 180;
    if (!valid) {
      console.warn(`Skipping marker with invalid coordinates: ${m.name} (${m.lat}, ${m.lng})`);
    }
    return valid;
  });

  // Initialize map
  useEffect(() => {
    if (!AMap || !mapContainerRef.current) return;

    // Destroy previous instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy();
      mapInstanceRef.current = null;
    }

    const map = new AMap.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [AMap]);

  // Render markers
  useEffect(() => {
    if (!AMap || !mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Close info window
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const map = mapInstanceRef.current;

    // Create an info window (single instance, reused)
    const infoWindow = new AMap.InfoWindow({
      isCustom: true,
      offset: new AMap.Pixel(0, -40),
    });
    infoWindowRef.current = infoWindow;

    const newMarkers = validMarkers.map((m) => {
      const iconDiv = document.createElement('div');
      const root = (React as any).createRoot(iconDiv); // eslint-disable-line @typescript-eslint/no-explicit-any
      root.render(<MarkerIcon type={m.type} />);

      const marker = new AMap.Marker({
        position: [m.lng, m.lat],
        content: iconDiv,
        offset: new AMap.Pixel(-16, -32),
        title: m.name,
        extData: m,
      });

      marker.on('click', () => {
        const contentDiv = document.createElement('div');
        const contentRoot = (React as any).createRoot(contentDiv); // eslint-disable-line @typescript-eslint/no-explicit-any
        contentRoot.render(<InfoWindowContent marker={m} />);
        infoWindow.setContent(contentDiv);
        infoWindow.open(map, marker.getPosition());
      });

      marker.setMap(map);
      return marker;
    });

    markersRef.current = newMarkers;

    return () => {
      newMarkers.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [AMap, validMarkers]);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Error states
  if (!amapKey && !amapLoading) {
    return (
      <PageContainer title="地图" subTitle="地理信息">
        <Result
          status="warning"
          title="高德地图 Key 未配置"
          subTitle="请在 .env 中设置 AMAP_JSAPI_KEY 和 AMAP_SECURITY_JS_CODE，然后重启服务。"
        />
      </PageContainer>
    );
  }

  if (amapError) {
    return (
      <PageContainer title="地图" subTitle="地理信息">
        <Alert
          type="error"
          message="地图加载失败"
          description={amapError.message}
          showIcon
          action={
            <Button icon={<ReloadOutlined />} onClick={handleRetry}>
              重试
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="地图" subTitle="地理信息">
      <div style={{ position: 'relative', height: 'calc(100vh - 112px)' }}>
        {(amapLoading || markersLoading) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              zIndex: 50,
            }}
          >
            <Spin size="large" tip="地图加载中..." />
          </div>
        )}

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Filter Panel */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 100,
            background: '#fff',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            width: panelCollapsed ? 'auto' : 200,
            overflow: 'hidden',
          }}
        >
          {panelCollapsed ? (
            <Tooltip title="展开筛选面板">
              <Button
                icon={<SearchOutlined />}
                onClick={() => setPanelCollapsed(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}
              />
            </Tooltip>
          ) : (
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  <EnvironmentOutlined style={{ marginRight: 4 }} />
                  标点筛选
                </span>
                <Button type="text" size="small" onClick={() => setPanelCollapsed(true)}>
                  收起
                </Button>
              </div>
              <Select
                value={filterType}
                onChange={setFilterType}
                options={MARKER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                style={{ width: '100%', marginBottom: 8 }}
                size="small"
              />
              <Input.Search
                placeholder="搜索标点..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                size="small"
                allowClear
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                <Badge count={validMarkers.length} overflowCount={999} size="small" />
                {' '}个标点
              </div>
            </div>
          )}
        </div>

        {/* Zoom Controls (decorative — AMap has built-in zoom) */}
      </div>
    </PageContainer>
  );
};

export default GeoMapPage;
```

注意：此页面使用 `useRequest` 从 `/api/geo/markers` mock 端点获取数据。`AMap.Marker` 的 `content` 属性使用 React `createRoot` 渲染自定义 HTML 标记。`InfoWindow` 同样使用 `createRoot` 渲染 React 内容。

- [ ] **Step 2: 提交**

```bash
git add frontend_admin/src/pages/geo/map/index.tsx
git commit -m "feat: 创建高德地图主页面（全屏地图 + 悬浮筛选面板）"
```

---

## Task 8: 集成验证

**Files:** 无新增，验证现有流程

- [ ] **Step 1: 启动后端容器确保 app-context API 可用**

```bash
docker compose exec web python -c "from django.conf import settings; print('AMAP_JSAPI_KEY:', settings.AMAP_JSAPI_KEY); print('AMAP_SECURITY_JS_CODE:', settings.AMAP_SECURITY_JS_CODE)"
```

预期输出：两个值（空字符串或实际值都正常）。

- [ ] **Step 2: 启动前端开发服务器**

```bash
cd /Users/lan/Project/django/linkcloud-space/frontend_admin
nvm use 22
npm run dev
```

- [ ] **Step 3: 浏览器验证**

1. 访问 `http://localhost:8080/geo/map`
2. 验证侧边栏出现"地理 > 地图"菜单项
3. 如果 `.env` 中未配置高德 Key，应看到"高德地图 Key 未配置"的提示
4. 配置真实 Key 后重新加载，验证地图加载成功
5. 验证 Mock 数据标点渲染在地图上（杭州范围，约 8 个标点）
6. 验证筛选面板：选择"楼栋"只显示蓝色标记，选择"住宅"只显示绿色标记
7. 验证搜索：输入"A栋"应只显示匹配的标点
8. 验证点击标点弹出信息窗
9. 验证收起/展开筛选面板

- [ ] **Step 4: 最终提交**

如果最终验证需要微调 CSS 或逻辑，在此提交所有微调：

```bash
git add -A
git commit -m "fix: 地图页面集成验证微调"
```
