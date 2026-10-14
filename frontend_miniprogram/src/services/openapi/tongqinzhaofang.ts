/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 保存通勤目的地 POST /api/public/houses/commute/destinations/ */
export function publicHousesCommuteDestinationsUsingPost({
  body,
  options,
}: {
  body: API.CommuteDestinationIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.CommuteDestinationOut>(
    '/api/public/houses/commute/destinations/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 搜索或推荐通勤目的地 GET /api/public/houses/commute/places/ */
export function publicHousesCommutePlacesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesCommutePlacesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.CommutePlaceOut[]>('/api/public/houses/commute/places/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取房源通勤路线 GET /api/public/houses/commute/routes/${param0}/ */
export function publicHousesCommuteRoutesRouteIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesCommuteRoutesRouteIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { route_id: param0, ...queryParams } = params;

  return request<API.CommuteRouteOut>(
    `/api/public/houses/commute/routes/${param0}/`,
    {
      method: 'GET',
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 计算房源到上班地点的通勤路线 POST /api/public/houses/commute/routes/for-house/ */
export function publicHousesCommuteRoutesForHouseUsingPost({
  body,
  options,
}: {
  body: API.CommuteRouteForHouseIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.CommuteRouteOut>(
    '/api/public/houses/commute/routes/for-house/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 创建通勤找房搜索 POST /api/public/houses/commute/searches/ */
export function publicHousesCommuteSearchesUsingPost({
  body,
  options,
}: {
  body: API.CommuteSearchIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.CommuteSearchCreatedOut>(
    '/api/public/houses/commute/searches/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取通勤计算进度 GET /api/public/houses/commute/searches/${param0}/ */
export function publicHousesCommuteSearchesSearchIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesCommuteSearchesSearchIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { search_id: param0, ...queryParams } = params;

  return request<API.CommuteProgressOut>(
    `/api/public/houses/commute/searches/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取通勤房源 GET /api/public/houses/commute/searches/${param0}/houses/ */
export function publicHousesCommuteSearchesSearchIdHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesCommuteSearchesSearchIdHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { search_id: param0, ...queryParams } = params;

  return request<API.PagedCommuteHouseOut>(
    `/api/public/houses/commute/searches/${param0}/houses/`,
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}
