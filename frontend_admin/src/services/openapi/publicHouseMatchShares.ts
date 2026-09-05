// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取公开配房分享 GET /api/public/house-match-shares/${param0}/ */
export async function appsHouseMatchApiGetShare(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseMatchApiGetShareParams,
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
export async function appsHouseMatchApiListShareHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseMatchApiListShareHousesParams,
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
export async function appsHouseMatchApiGetShareHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseMatchApiGetShareHouseParams,
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
