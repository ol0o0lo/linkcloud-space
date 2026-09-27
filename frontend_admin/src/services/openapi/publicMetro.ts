// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取已开通地铁城市 GET /api/public/metro/cities/ */
export async function appsMetroApiListPublicMetroCities(options?: {
  [key: string]: any;
}) {
  return request<API.PublicMetroCitySummaryOut[]>("/api/public/metro/cities/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取城市地铁线路和站点 GET /api/public/metro/cities/${param0}/ */
export async function appsMetroApiGetPublicMetroCity(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMetroApiGetPublicMetroCityParams,
  options?: { [key: string]: any }
) {
  const { city_name: param0, ...queryParams } = params;
  return request<API.PublicMetroCityDetailOut>(
    `/api/public/metro/cities/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
