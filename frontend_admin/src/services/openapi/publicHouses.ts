// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 全局搜索公开房源 GET /api/public/houses/ */
export async function appsHouseApiListPublicHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListPublicHousesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedPublicHouseListOut>("/api/public/houses/", {
    method: "GET",
    params: {
      // radius_m has a default value: 1000
      radius_m: "1000",

      // sort has a default value: latest
      sort: "latest",
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取公开房源详情 GET /api/public/houses/${param0}/ */
export async function appsHouseApiGetPublicHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetPublicHouseParams,
  options?: { [key: string]: any }
) {
  const { house_id: param0, ...queryParams } = params;
  return request<API.PublicHouseDetailOut>(`/api/public/houses/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取公开房源筛选项 GET /api/public/houses/filters/ */
export async function appsHouseApiGetPublicHouseFilters(options?: {
  [key: string]: any;
}) {
  return request<API.PublicHouseFiltersOut>("/api/public/houses/filters/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 按地图视野获取公开房源聚合标点 GET /api/public/houses/map/ */
export async function appsHouseApiListPublicHouseMap(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListPublicHouseMapParams,
  options?: { [key: string]: any }
) {
  return request<API.PublicHouseMapOut>("/api/public/houses/map/", {
    method: "GET",
    params: {
      // zoom has a default value: 8
      zoom: "8",

      // radius_m has a default value: 3000
      radius_m: "3000",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取公开房源地区目录 GET /api/public/houses/regions/ */
export async function appsHouseApiGetPublicHouseRegions(options?: {
  [key: string]: any;
}) {
  return request<API.PublicHouseRegionsOut>("/api/public/houses/regions/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 根据坐标解析所在地区 GET /api/public/houses/regions/resolve/ */
export async function appsHouseApiResolvePublicHouseRegion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiResolvePublicHouseRegionParams,
  options?: { [key: string]: any }
) {
  return request<API.PublicHouseLocatedRegionOut>(
    "/api/public/houses/regions/resolve/",
    {
      method: "GET",
      params: {
        // coordinate_system has a default value: gcj02
        coordinate_system: "gcj02",
        ...params,
      },
      ...(options || {}),
    }
  );
}
