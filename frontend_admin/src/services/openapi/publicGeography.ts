// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取坐标周边设施 GET /api/geography/nearby-pois/ */
export async function appsGeographyApiListLocationNearbyPois(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsGeographyApiListLocationNearbyPoisParams,
  options?: { [key: string]: any }
) {
  return request<API.NearbyPoisOut>("/api/geography/nearby-pois/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 根据坐标解析所在地区 GET /api/geography/regions/resolve/ */
export async function appsGeographyApiResolveLocationRegion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsGeographyApiResolveLocationRegionParams,
  options?: { [key: string]: any }
) {
  return request<API.LocatedRegionOut>("/api/geography/regions/resolve/", {
    method: "GET",
    params: {
      // coordinate_system has a default value: gcj02
      coordinate_system: "gcj02",
      ...params,
    },
    ...(options || {}),
  });
}
