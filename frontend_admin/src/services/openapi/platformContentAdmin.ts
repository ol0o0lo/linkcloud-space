// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取首页 Banner GET /api/admin/platform-operations/content/banners/ */
export async function appsPlatformOperationsApiListBanners(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiListBannersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedHomeBannerAdminOut>(
    "/api/admin/platform-operations/content/banners/",
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

/** 创建首页 Banner POST /api/admin/platform-operations/content/banners/ */
export async function appsPlatformOperationsApiCreateBanner(
  body: API.HomeBannerCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.HomeBannerAdminOut>(
    "/api/admin/platform-operations/content/banners/",
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

/** 获取首页 Banner 详情 GET /api/admin/platform-operations/content/banners/${param0}/ */
export async function appsPlatformOperationsApiGetBanner(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiGetBannerParams,
  options?: { [key: string]: any }
) {
  const { banner_id: param0, ...queryParams } = params;
  return request<API.HomeBannerAdminOut>(
    `/api/admin/platform-operations/content/banners/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新首页 Banner PATCH /api/admin/platform-operations/content/banners/${param0}/ */
export async function appsPlatformOperationsApiPatchBanner(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiPatchBannerParams,
  body: API.HomeBannerPatchIn,
  options?: { [key: string]: any }
) {
  const { banner_id: param0, ...queryParams } = params;
  return request<API.HomeBannerAdminOut>(
    `/api/admin/platform-operations/content/banners/${param0}/`,
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

/** 获取运营专题和指南 GET /api/admin/platform-operations/content/entries/ */
export async function appsPlatformOperationsApiListEntries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiListEntriesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedContentEntryAdminOut>(
    "/api/admin/platform-operations/content/entries/",
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

/** 创建运营专题或指南 POST /api/admin/platform-operations/content/entries/ */
export async function appsPlatformOperationsApiCreateEntry(
  body: API.ContentEntryCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.ContentEntryAdminOut>(
    "/api/admin/platform-operations/content/entries/",
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

/** 获取运营专题或指南详情 GET /api/admin/platform-operations/content/entries/${param0}/ */
export async function appsPlatformOperationsApiGetEntry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiGetEntryParams,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.ContentEntryAdminOut>(
    `/api/admin/platform-operations/content/entries/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新运营专题或指南 PATCH /api/admin/platform-operations/content/entries/${param0}/ */
export async function appsPlatformOperationsApiPatchEntry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiPatchEntryParams,
  body: API.ContentEntryPatchIn,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.ContentEntryAdminOut>(
    `/api/admin/platform-operations/content/entries/${param0}/`,
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

/** 获取专题已选房源 GET /api/admin/platform-operations/content/entries/${param0}/houses/ */
export async function appsPlatformOperationsApiListEntryHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiListEntryHousesParams,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.PagedContentEntryHouseAdminOut>(
    `/api/admin/platform-operations/content/entries/${param0}/houses/`,
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

/** 保存专题房源 PUT /api/admin/platform-operations/content/entries/${param0}/houses/ */
export async function appsPlatformOperationsApiPutEntryHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiPutEntryHousesParams,
  body: API.ContentEntryHousesPutIn,
  options?: { [key: string]: any }
) {
  const { entry_id: param0, ...queryParams } = params;
  return request<API.ContentEntryHouseAdminOut[]>(
    `/api/admin/platform-operations/content/entries/${param0}/houses/`,
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

/** 获取运营专题候选房源 GET /api/admin/platform-operations/content/house-candidates/ */
export async function appsPlatformOperationsApiListHouseCandidates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiListHouseCandidatesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedContentHouseAdminOut>(
    "/api/admin/platform-operations/content/house-candidates/",
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
