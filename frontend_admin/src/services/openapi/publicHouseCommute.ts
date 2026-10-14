// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 保存通勤目的地 POST /api/public/houses/commute/destinations/ */
export async function appsHouseCommuteApiSaveCommuteDestination(
  body: API.CommuteDestinationIn,
  options?: { [key: string]: any }
) {
  return request<API.CommuteDestinationOut>(
    "/api/public/houses/commute/destinations/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 搜索或推荐通勤目的地 GET /api/public/houses/commute/places/ */
export async function appsHouseCommuteApiSearchCommutePlaces(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseCommuteApiSearchCommutePlacesParams,
  options?: { [key: string]: any }
) {
  return request<API.CommutePlaceOut[]>("/api/public/houses/commute/places/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取房源通勤路线 GET /api/public/houses/commute/routes/${param0}/ */
export async function appsHouseCommuteApiGetCommuteRoute(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseCommuteApiGetCommuteRouteParams,
  options?: { [key: string]: any }
) {
  const { route_id: param0, ...queryParams } = params;
  return request<API.CommuteRouteOut>(
    `/api/public/houses/commute/routes/${param0}/`,
    {
      method: "GET",
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 计算房源到上班地点的通勤路线 POST /api/public/houses/commute/routes/for-house/ */
export async function appsHouseCommuteApiGetHouseCommuteRoute(
  body: API.CommuteRouteForHouseIn,
  options?: { [key: string]: any }
) {
  return request<API.CommuteRouteOut>(
    "/api/public/houses/commute/routes/for-house/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 创建通勤找房搜索 POST /api/public/houses/commute/searches/ */
export async function appsHouseCommuteApiStartCommuteSearch(
  body: API.CommuteSearchIn,
  options?: { [key: string]: any }
) {
  return request<API.CommuteSearchCreatedOut>(
    "/api/public/houses/commute/searches/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取通勤计算进度 GET /api/public/houses/commute/searches/${param0}/ */
export async function appsHouseCommuteApiGetCommuteSearch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseCommuteApiGetCommuteSearchParams,
  options?: { [key: string]: any }
) {
  const { search_id: param0, ...queryParams } = params;
  return request<API.CommuteProgressOut>(
    `/api/public/houses/commute/searches/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取通勤房源 GET /api/public/houses/commute/searches/${param0}/houses/ */
export async function appsHouseCommuteApiListCommuteHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseCommuteApiListCommuteHousesParams,
  options?: { [key: string]: any }
) {
  const { search_id: param0, ...queryParams } = params;
  return request<API.PagedCommuteHouseOut>(
    `/api/public/houses/commute/searches/${param0}/houses/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}
