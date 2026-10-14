// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取公开配房分享 GET /api/public/house-match-shares/${param0}/ */
export async function appsHouseApiMatchingGetShare(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMatchingGetShareParams,
  options?: { [key: string]: any }
) {
  const { share_key: param0, ...queryParams } = params;
  return request<API.PublicHouseMatchShareOut>(
    `/api/public/house-match-shares/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取公开配房房源 GET /api/public/house-match-shares/${param0}/houses/ */
export async function appsHouseApiMatchingListShareHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMatchingListShareHousesParams,
  options?: { [key: string]: any }
) {
  const { share_key: param0, ...queryParams } = params;
  return request<API.PagedPublicHouseListOut>(
    `/api/public/house-match-shares/${param0}/houses/`,
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

/** 获取公开配房房源详情 GET /api/public/house-match-shares/${param0}/houses/${param1}/ */
export async function appsHouseApiMatchingGetShareHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMatchingGetShareHouseParams,
  options?: { [key: string]: any }
) {
  const { share_key: param0, house_id: param1, ...queryParams } = params;
  return request<API.PublicHouseDetailOut>(
    `/api/public/house-match-shares/${param0}/houses/${param1}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
