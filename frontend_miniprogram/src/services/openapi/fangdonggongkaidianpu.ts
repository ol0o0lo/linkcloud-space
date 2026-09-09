/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取房东公开店铺 GET /api/public/landlords/${param0}/ */
export function publicLandlordsPublicKeyUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicLandlordsPublicKeyUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { public_key: param0, ...queryParams } = params;

  return request<API.PublicLandlordProfileOut>(
    `/api/public/landlords/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取房东店铺公开房源 GET /api/public/landlords/${param0}/houses/ */
export function publicLandlordsPublicKeyHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicLandlordsPublicKeyHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { public_key: param0, ...queryParams } = params;

  return request<API.PagedPublicHouseListOut>(
    `/api/public/landlords/${param0}/houses/`,
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

/** 获取房东店铺公开房源详情 GET /api/public/landlords/${param0}/houses/${param1}/ */
export function publicLandlordsPublicKeyHousesHouseIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicLandlordsPublicKeyHousesHouseIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { public_key: param0, house_id: param1, ...queryParams } = params;

  return request<API.PublicHouseDetailOut>(
    `/api/public/landlords/${param0}/houses/${param1}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
