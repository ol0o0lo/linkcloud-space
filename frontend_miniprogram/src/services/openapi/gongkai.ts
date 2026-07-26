/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 全局搜索公开房源 GET /api/public/houses/ */
export function publicHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedPublicHouseListOut>('/api/public/houses/', {
    method: 'GET',
    params: {
      // sort has a default value: latest
      sort: 'latest',
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取公开房源详情 GET /api/public/houses/${param0}/ */
export function publicHousesHouseIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesHouseIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { house_id: param0, ...queryParams } = params;

  return request<API.PublicHouseDetailOut>(`/api/public/houses/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取公开房源筛选项 GET /api/public/houses/filters/ */
export function publicHousesFiltersUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.PublicHouseFiltersOut>('/api/public/houses/filters/', {
    method: 'GET',
    ...(options || {}),
  });
}
