// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取运营专题和指南列表 GET /api/public/content/entries/ */
export async function appsPlatformOperationsApiPublicEntries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiPublicEntriesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedContentEntrySummaryOut>(
    "/api/public/content/entries/",
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

/** 获取运营专题或指南详情 GET /api/public/content/entries/${param0}/ */
export async function appsPlatformOperationsApiPublicEntryDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiPublicEntryDetailParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.ContentEntryDetailOut>(
    `/api/public/content/entries/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取运营专题房源 GET /api/public/content/entries/${param0}/houses/ */
export async function appsPlatformOperationsApiPublicEntryHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsPlatformOperationsApiPublicEntryHousesParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.PagedContentEntryHousePublicOut>(
    `/api/public/content/entries/${param0}/houses/`,
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

/** 获取首页公开内容 GET /api/public/content/home/ */
export async function appsPlatformOperationsApiPublicHome(options?: {
  [key: string]: any;
}) {
  return request<API.HomeContentOut>("/api/public/content/home/", {
    method: "GET",
    ...(options || {}),
  });
}
