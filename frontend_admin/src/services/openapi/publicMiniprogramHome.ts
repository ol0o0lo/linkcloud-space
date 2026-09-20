// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取小程序首页专题和指南列表 GET /api/public/miniprogram/home-entries/ */
export async function appsMiniprogramHomeApiPublicEntries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiPublicEntriesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMiniProgramHomeEntrySummaryOut>(
    "/api/public/miniprogram/home-entries/",
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

/** 获取小程序首页专题或指南详情 GET /api/public/miniprogram/home-entries/${param0}/ */
export async function appsMiniprogramHomeApiPublicEntryDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiPublicEntryDetailParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.MiniProgramHomeEntryDetailOut>(
    `/api/public/miniprogram/home-entries/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取小程序首页专题房源 GET /api/public/miniprogram/home-entries/${param0}/houses/ */
export async function appsMiniprogramHomeApiPublicEntryHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMiniprogramHomeApiPublicEntryHousesParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.PagedMiniProgramHomeEntryHousePublicOut>(
    `/api/public/miniprogram/home-entries/${param0}/houses/`,
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

/** 获取小程序首页公开内容 GET /api/public/miniprogram/home/ */
export async function appsMiniprogramHomeApiPublicHome(options?: {
  [key: string]: any;
}) {
  return request<API.MiniProgramHomeOut>("/api/public/miniprogram/home/", {
    method: "GET",
    ...(options || {}),
  });
}
