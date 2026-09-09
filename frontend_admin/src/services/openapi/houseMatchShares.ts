// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取我的配房分享 GET /api/house-match-shares/ */
export async function appsHouseMatchApiListShares(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseMatchApiListSharesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedHouseMatchShareOut>("/api/house-match-shares/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 生成配房分享链接 POST /api/house-match-shares/ */
export async function appsHouseMatchApiCreateShare(
  body: API.HouseMatchShareCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.HouseMatchShareCreateOut>("/api/house-match-shares/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 延期配房分享 POST /api/house-match-shares/${param0}/extend/ */
export async function appsHouseMatchApiExtendShare(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseMatchApiExtendShareParams,
  body: API.HouseMatchShareExtendIn,
  options?: { [key: string]: any }
) {
  const { share_id: param0, ...queryParams } = params;
  return request<API.HouseMatchShareOut>(
    `/api/house-match-shares/${param0}/extend/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 失效配房分享 POST /api/house-match-shares/${param0}/revoke/ */
export async function appsHouseMatchApiRevokeShare(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseMatchApiRevokeShareParams,
  options?: { [key: string]: any }
) {
  const { share_id: param0, ...queryParams } = params;
  return request<API.HouseMatchShareOut>(
    `/api/house-match-shares/${param0}/revoke/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
