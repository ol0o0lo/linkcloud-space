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
