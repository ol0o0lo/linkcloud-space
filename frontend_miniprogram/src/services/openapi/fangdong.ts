/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 房东查询名下房源 GET /api/house/landlord/my-houses/ */
export function houseLandlordMyHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLandlordMyHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedHouseOut>('/api/house/landlord/my-houses/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 房东查询名下租约 GET /api/house/landlord/my-leases/ */
export function houseLandlordMyLeasesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLandlordMyLeasesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedLeaseOut>('/api/house/landlord/my-leases/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}
