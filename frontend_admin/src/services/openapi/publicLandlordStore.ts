// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取房东公开店铺 GET /api/public/landlords/${param0}/ */
export async function appsHouseApiGetPublicLandlordProfile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetPublicLandlordProfileParams,
  options?: { [key: string]: any }
) {
  const { public_key: param0, ...queryParams } = params;
  return request<API.PublicLandlordProfileOut>(
    `/api/public/landlords/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取房东店铺公开房源 GET /api/public/landlords/${param0}/houses/ */
export async function appsHouseApiListPublicLandlordHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListPublicLandlordHousesParams,
  options?: { [key: string]: any }
) {
  const { public_key: param0, ...queryParams } = params;
  return request<API.PagedPublicHouseListOut>(
    `/api/public/landlords/${param0}/houses/`,
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

/** 获取房东店铺公开房源详情 GET /api/public/landlords/${param0}/houses/${param1}/ */
export async function appsHouseApiGetPublicLandlordHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetPublicLandlordHouseParams,
  options?: { [key: string]: any }
) {
  const { public_key: param0, house_id: param1, ...queryParams } = params;
  return request<API.PublicHouseDetailOut>(
    `/api/public/landlords/${param0}/houses/${param1}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
