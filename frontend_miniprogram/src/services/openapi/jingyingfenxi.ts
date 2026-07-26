/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取事件定义 GET /api/analytics/definitions/ */
export function analyticsDefinitionsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.AnalyticsEventDefinitionOut[]>(
    '/api/analytics/definitions/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 批量采集行为事件 POST /api/analytics/events/ */
export function analyticsEventsUsingPost({
  body,
  options,
}: {
  body: API.AnalyticsEventsIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.AnalyticsCollectOut>('/api/analytics/events/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取经营分析概览 GET /api/analytics/overview/ */
export function analyticsOverviewUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AnalyticsOverviewUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.AnalyticsOverviewOut>('/api/analytics/overview/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取分析目标排行 GET /api/analytics/targets/ */
export function analyticsTargetsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AnalyticsTargetsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAnalyticsTargetMetricOut>('/api/analytics/targets/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取经营指标趋势 GET /api/analytics/trends/ */
export function analyticsTrendsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AnalyticsTrendsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.AnalyticsTrendPointOut[]>('/api/analytics/trends/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
