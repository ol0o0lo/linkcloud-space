// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取小程序首页 Banner GET /api/admin/miniprogram-home/banners/ */
export async function appsMiniprogramHomeApiListBanners(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiListBannersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMiniProgramHomeBannerAdminOut>(
    "/api/admin/miniprogram-home/banners/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建小程序首页 Banner POST /api/admin/miniprogram-home/banners/ */
export async function appsMiniprogramHomeApiCreateBanner(
  body: API.MiniProgramHomeBannerCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.MiniProgramHomeBannerAdminOut>(
    "/api/admin/miniprogram-home/banners/",
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

/** 获取小程序首页 Banner 详情 GET /api/admin/miniprogram-home/banners/${param0}/ */
export async function appsMiniprogramHomeApiGetBanner(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiGetBannerParams,
  options?: { [key: string]: any }
) {
  const { banner_id: param0, ...queryParams } = params;
  return request<API.MiniProgramHomeBannerAdminOut>(
    `/api/admin/miniprogram-home/banners/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新小程序首页 Banner PATCH /api/admin/miniprogram-home/banners/${param0}/ */
export async function appsMiniprogramHomeApiPatchBanner(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiPatchBannerParams,
  body: API.MiniProgramHomeBannerPatchIn,
  options?: { [key: string]: any }
) {
  const { banner_id: param0, ...queryParams } = params;
  return request<API.MiniProgramHomeBannerAdminOut>(
    `/api/admin/miniprogram-home/banners/${param0}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取小程序首页专题和指南 GET /api/admin/miniprogram-home/entries/ */
export async function appsMiniprogramHomeApiListEntries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiListEntriesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMiniProgramHomeEntryAdminOut>(
    "/api/admin/miniprogram-home/entries/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建小程序首页专题或指南 POST /api/admin/miniprogram-home/entries/ */
export async function appsMiniprogramHomeApiCreateEntry(
  body: API.MiniProgramHomeEntryCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.MiniProgramHomeEntryAdminOut>(
    "/api/admin/miniprogram-home/entries/",
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

/** 获取小程序首页专题或指南详情 GET /api/admin/miniprogram-home/entries/${param0}/ */
export async function appsMiniprogramHomeApiGetEntry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiGetEntryParams,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.MiniProgramHomeEntryAdminOut>(
    `/api/admin/miniprogram-home/entries/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新小程序首页专题或指南 PATCH /api/admin/miniprogram-home/entries/${param0}/ */
export async function appsMiniprogramHomeApiPatchEntry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiPatchEntryParams,
  body: API.MiniProgramHomeEntryPatchIn,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.MiniProgramHomeEntryAdminOut>(
    `/api/admin/miniprogram-home/entries/${param0}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取专题已选房源 GET /api/admin/miniprogram-home/entries/${param0}/houses/ */
export async function appsMiniprogramHomeApiListEntryHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiListEntryHousesParams,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.PagedMiniProgramHomeEntryHouseAdminOut>(
    `/api/admin/miniprogram-home/entries/${param0}/houses/`,
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

/** 保存专题房源 PUT /api/admin/miniprogram-home/entries/${param0}/houses/ */
export async function appsMiniprogramHomeApiPutEntryHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiPutEntryHousesParams,
  body: API.MiniProgramHomeEntryHousesPutIn,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.MiniProgramHomeEntryHouseAdminOut[]>(
    `/api/admin/miniprogram-home/entries/${param0}/houses/`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取小程序首页专题候选房源 GET /api/admin/miniprogram-home/house-candidates/ */
export async function appsMiniprogramHomeApiListHouseCandidates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiListHouseCandidatesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMiniProgramHomeHouseAdminOut>(
    "/api/admin/miniprogram-home/house-candidates/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}
