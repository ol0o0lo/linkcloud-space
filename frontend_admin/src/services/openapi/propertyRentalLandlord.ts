// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 房东查询名下房源 GET /api/house/landlord/my-houses/ */
export async function appsHouseApiListMyHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListMyHousesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedHouseOut>("/api/house/landlord/my-houses/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 房东查询名下租约 GET /api/house/landlord/my-leases/ */
export async function appsHouseApiListMyLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListMyLeasesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedLeaseOut>("/api/house/landlord/my-leases/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}
