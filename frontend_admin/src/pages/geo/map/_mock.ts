import type { GeoMarker, GeoMarkerListOut } from './data.d';

/**
 * mock 标点数据 - 杭州范围，building/house 两种类型
 * 后续对接后端 API 后替换为真实请求
 */
const mockMarkers: GeoMarker[] = [
  {
    id: 'b001',
    name: 'A 座办公楼',
    type: 'building',
    lat: 30.2741,
    lng: 120.1551,
    description: '武林广场 A 座，共 28 层',
    modelId: 'BLD-001',
  },
  {
    id: 'b002',
    name: 'B 座办公楼',
    type: 'building',
    lat: 30.2755,
    lng: 120.1583,
    description: '武林广场 B 座，共 32 层',
    modelId: 'BLD-002',
  },
  {
    id: 'b003',
    name: '科技园 3 号楼',
    type: 'building',
    lat: 30.3008,
    lng: 120.1242,
    description: '未来科技城核心区',
    modelId: 'BLD-003',
  },
  {
    id: 'b004',
    name: '滨江研发中心',
    type: 'building',
    lat: 30.2085,
    lng: 120.2113,
    description: '滨江区互联网小镇',
    modelId: 'BLD-004',
  },
  {
    id: 'h001',
    name: '翠苑一区 12 幢',
    type: 'house',
    lat: 30.2887,
    lng: 120.0985,
    description: '老旧小区改造示范',
    modelId: 'HSE-001',
  },
  {
    id: 'h002',
    name: '城西银泰公寓',
    type: 'house',
    lat: 30.2901,
    lng: 120.1312,
    description: '城西银泰商圈配套公寓',
    modelId: 'HSE-002',
  },
  {
    id: 'h003',
    name: '钱江新城住宅',
    type: 'house',
    lat: 30.2498,
    lng: 120.2067,
    description: '钱江新城核心区江景房',
    modelId: 'HSE-003',
  },
  {
    id: 'h004',
    name: '之江花园别墅',
    type: 'house',
    lat: 30.1865,
    lng: 120.1201,
    description: '之江旅游度假区低密度住宅',
    modelId: 'HSE-004',
  },
];

/** 模拟获取标点列表（带延迟） */
export function fetchMockMarkers(): Promise<GeoMarkerListOut> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ items: mockMarkers, total: mockMarkers.length });
    }, 200);
  });
}
