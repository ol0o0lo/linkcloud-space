# 高德地图接入 — 管理后台地图页面（Phase 1）

**日期**: 2026-06-20
**状态**: 设计完成，待实施

## 背景

在 frontend_admin（Ant Design Pro 管理后台）中新增一个业务地图页面，接入高德地图 JSAPI 2.0 SDK。Phase 1 使用前端 mock 数据验证地图渲染和交互，后续 Phase 2 再建立后端业务模型（GeoMixin + Building/House 等）。

## 范围

### 本轮（Phase 1）

- frontend_admin 新增 `/geo/map` 路由和页面
- 接入高德 JSAPI 2.0 SDK（`@amap/amap-jsapi-loader`），真实 API Key
- 前端 mock 数据模拟标点列表（lat/lng/名称/类型）
- 高德 Key 通过后端 app-context 接口下发，不写死在前端代码中
- 地图基础交互：缩放、拖拽、标点展示、信息窗点击弹出
- 悬浮筛选面板（类型筛选、关键词搜索、标点计数）
- SDK 加载失败和 Key 未配置的错误处理

### 不在本轮

- 后端 GeoPoint / Building / House 等业务模型
- 模型 CRUD API + 管理列表页面
- 组织级数据隔离
- GeoMixin 基类 + 模型注册表
- 标点聚合、区域绘制等高级交互

## 布局方案

**采用方案 A：全屏地图 + 悬浮面板**

- 地图占满 PageContainer 内容区（`height: calc(100vh - 56px)`）
- 左上悬浮可折叠筛选面板（类型 Select、搜索 Input.Search、标点计数 Badge）
- 右侧悬浮缩放按钮（+/-）
- 右下图层切换/定位按钮（预留）
- 点击标点弹出 AMap.InfoWindow，内容由 React 组件渲染

## 架构

### 模块层次

1. **前端页面层** — `src/pages/geo/map/index.tsx` 地图主组件，`components/` 子组件
2. **SDK 适配层** — `src/services/manual/amap.ts` hook 封装高德加载和实例管理
3. **数据层 (Mock)** — `src/pages/geo/map/_mock.ts` 标点数据，`data.d.ts` 类型定义
4. **配置通道** — 后端 `apps/base/api.py` app-context 接口追加 `amap_jsapi_key` 字段
5. **路由 & 菜单** — `config/routes.ts` 新增 `/geo/map` 路由

### 数据流

1. 用户访问 `/geo/map` → Umi 渲染 GeoMapPage
2. `useModel('@@initialState')` 取 `amapKey`（来自 getInitialState）
3. `useAmap(key)` hook 异步加载高德 SDK → 返回 `AMap` 命名空间
4. useEffect 创建地图实例 → 绑定到容器 div#amap-container
5. 从 mock 数据读取标点列表 → 批量 `AMap.Marker` 渲染
6. 点击标点 → 打开信息窗 → 展示 mock 详情
7. 筛选面板切换 → 过滤 mock 数据 → 更新地图标点

## 组件树

```
GeoMapPage
├── PageContainer (面包屑 + 标题)
│   └── MapContainer (全屏地图外壳)
│       ├── div#amap-container (高德地图挂载点)
│       ├── FilterPanel (左上悬浮筛选面板)
│       │   ├── antd Select (类型: 全部 / 楼栋 / 住宅)
│       │   ├── antd Input.Search (关键词搜索)
│       │   └── antd Badge (标点计数)
│       ├── ZoomControl (右侧 ± 按钮)
│       ├── LayerControl (右下图层切换，预留)
│       ├── AMap.Marker × N (批量标点)
│       └── InfoWindow (点击标点弹出的详情卡片)
```

## 关键组件规格

### MapContainer

- 自身撑满 PageContainer 的 children 区域（`height: calc(100vh - 56px)` 扣除顶栏）
- 内部 `div#amap-container` 宽高 100%，`AMap.Map` 绑定到它
- 通过 `useAmap(key)` hook 管理 AMap 实例生命周期
- cleanup 时调用 `map.destroy()` 释放资源
- loading 态显示 antd Spin 全容器居中，error 态显示 antd Result 或 Alert

### FilterPanel

- `position: absolute; top: 16px; left: 16px; z-index: 100`
- 白色背景 + 阴影，圆角 6px，宽度约 200px
- 包含：类型 Select（antd）、搜索 Input.Search（antd）、结果计数 Badge
- 可折叠：标题栏右侧箭头按钮，收起后仅显示一个图标按钮

### InfoWindow

- 点击 Marker 时弹出，使用 `AMap.InfoWindow` 原生组件
- 内容用 `createRoot` 渲染 React 组件，保持风格统一
- 展示：名称、类型标签、经纬度、地址、描述等 mock 字段
- 单个 InfoWindow 实例，切换标点时复用（update 而非 destroy+create）

### useAmap Hook

- 接收 `key: string`，返回 `{ AMap, loading, error }`
- 内部使用 `useEffect` 调用 `AMapLoader.load({ key, version: '2.0' })`
- SDK 只加载一次，key 变化时不重新加载（正常场景 key 不变）
- 安装 `@amap/amap-jsapi-loader` npm 包

## Mock 数据

在 `src/pages/geo/map/_mock.ts` 中使用 Umi 内置 mock 体系：

```typescript
export default {
  'GET /api/geo/markers': {
    items: [
      { id: 1, name: 'A栋办公楼', type: 'building', lng: 120.1234, lat: 30.2556, address: '杭州市余杭区...', description: '12层办公楼...' },
      { id: 2, name: '1号住宅', type: 'house', lng: 120.1301, lat: 30.2602, address: '杭州市西湖区...' },
      // 约 5-10 个杭州范围的标点，覆盖 building/house 两种类型
    ],
  },
};
```

### 类型定义 (`data.d.ts`)

```typescript
export interface GeoMarker {
  id: number;
  name: string;
  type: 'building' | 'house';
  lng: number;
  lat: number;
  address?: string;
  description?: string;
}
```

## 配置通道

### 后端

1. `.env` 新增 `AMAP_JSAPI_KEY=<你的高德Key>`
2. `pyproject.toml` `[tool.epicenv.variables]` 新增配置项
3. `config/settings/_base.py` 读取环境变量 `AMAP_JSAPI_KEY`
4. `apps/base/api.py` 的 `AppContextOut` Schema 和 `app_context()` 函数追加 `amapJsapiKey` 字段

### 前端

1. `src/app.tsx` 的 `getInitialState()` 从 `/api/app-context/` 返回值中提取 `amapJsapiKey`
2. 页面组件通过 `useModel('@@initialState')` 获取 key

## 错误处理

| 场景 | 处理 |
|------|------|
| 高德 Key 未配置 | app-context 无 amapKey → 地图区域显示 antd Result，提示 "请先在 .env 中配置 AMAP_JSAPI_KEY" |
| SDK 加载失败 | useAmap 返回 error → 显示 antd Alert + 重试按钮 |
| 标点数据为空 | 地图正常显示，FilterPanel 计数为 0，无 Error 态 |
| 坐标越界 | 渲染标点前校验 lat ∈ [-90, 90], lng ∈ [-180, 180]，非法跳过并 console.warn |

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/pages/geo/map/index.tsx` | 地图主页面 |
| 新增 | `src/pages/geo/map/_mock.ts` | 标点 mock 数据 |
| 新增 | `src/pages/geo/map/data.d.ts` | 类型定义 |
| 新增 | `src/services/manual/amap.ts` | 高德 SDK 加载 hook |
| 安装 | `package.json` | `npm install @amap/amap-jsapi-loader` |
| 修改 | `config/routes.ts` | 新增 `/geo/map` 路由 |
| 修改 | `src/app.tsx` | getInitialState 追加 amapJsapiKey |
| 修改 | `apps/base/api.py` | app-context 接口追加 amap_jsapi_key |
| 修改 | `.env` | 新增 `AMAP_JSAPI_KEY` |
| 修改 | `pyproject.toml` | 新增 `AMAP_JSAPI_KEY` 配置项 |
| 修改 | `config/settings/_base.py` | 读取 `AMAP_JSAPI_KEY` |
