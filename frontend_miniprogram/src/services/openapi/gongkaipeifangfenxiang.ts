/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取公开配房分享 GET /api/public/house-match-shares/${param0}/ */
export function publicHouseMatchSharesShareKeyUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHouseMatchSharesShareKeyUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { share_key: param0, ...queryParams } = params;

  return request<API.PublicHouseMatchShareOut>(
    `/api/public/house-match-shares/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取公开配房房源 GET /api/public/house-match-shares/${param0}/houses/ */
export function publicHouseMatchSharesShareKeyHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHouseMatchSharesShareKeyHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { share_key: param0, ...queryParams } = params;

  return request<API.PagedPublicHouseListOut>(
    `/api/public/house-match-shares/${param0}/houses/`,
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

/** 获取公开配房房源详情 GET /api/public/house-match-shares/${param0}/houses/${param1}/ */
export function publicHouseMatchSharesShareKeyHousesHouseIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHouseMatchSharesShareKeyHousesHouseIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { share_key: param0, house_id: param1, ...queryParams } = params;

  return request<API.PublicHouseDetailOut>(
    `/api/public/house-match-shares/${param0}/houses/${param1}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
