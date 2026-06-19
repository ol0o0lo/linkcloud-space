/**
 * 地图标点类型定义
 * 后续对接真实业务模型（building/house 等）时会替换为后端 OpenAPI 类型
 */

/** 标点类型：楼栋、房屋等 */
export type GeoMarkerType = 'building' | 'house';

/** 单个地图标点 */
export interface GeoMarker {
  /** 唯一标识 */
  id: string;
  /** 标点名称 */
  name: string;
  /** 标点类型 */
  type: GeoMarkerType;
  /** 纬度 */
  lat: number;
  /** 经度 */
  lng: number;
  /** 附加描述，用于 InfoWindow 展示 */
  description?: string;
  /** 关联业务模型 ID（后续对接后端时使用） */
  modelId?: string;
}

/** 标点列表返回结构 */
export interface GeoMarkerListOut {
  /** 标点列表 */
  items: GeoMarker[];
  /** 总数 */
  total: number;
}

/** 筛选条件 */
export interface GeoMarkerFilter {
  /** 按类型筛选，空表示全部 */
  type?: GeoMarkerType;
  /** 关键词搜索（名称/描述） */
  keyword?: string;
}
