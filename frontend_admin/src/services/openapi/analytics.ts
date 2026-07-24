// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取事件定义 GET /api/analytics/definitions/ */
export async function appsAnalyticsApiListDefinitions(options?: {
  [key: string]: any;
}) {
  return request<API.AnalyticsEventDefinitionOut[]>(
    "/api/analytics/definitions/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 批量采集行为事件 POST /api/analytics/events/ */
export async function appsAnalyticsApiCollectEvents(
  body: API.AnalyticsEventsIn,
  options?: { [key: string]: any }
) {
  return request<API.AnalyticsCollectOut>("/api/analytics/events/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取经营分析概览 GET /api/analytics/overview/ */
export async function appsAnalyticsApiGetOverview(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAnalyticsApiGetOverviewParams,
  options?: { [key: string]: any }
) {
  return request<API.AnalyticsOverviewOut>("/api/analytics/overview/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取分析目标排行 GET /api/analytics/targets/ */
export async function appsAnalyticsApiGetTargets(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAnalyticsApiGetTargetsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAnalyticsTargetMetricOut>("/api/analytics/targets/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取经营指标趋势 GET /api/analytics/trends/ */
export async function appsAnalyticsApiGetTrends(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAnalyticsApiGetTrendsParams,
  options?: { [key: string]: any }
) {
  return request<API.AnalyticsTrendPointOut[]>("/api/analytics/trends/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
