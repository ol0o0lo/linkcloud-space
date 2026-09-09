/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取我的配房分享 GET /api/house-match-shares/ */
export function houseMatchSharesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseMatchSharesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedHouseMatchShareOut>('/api/house-match-shares/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 生成配房分享链接 POST /api/house-match-shares/ */
export function houseMatchSharesUsingPost({
  body,
  options,
}: {
  body: API.HouseMatchShareCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.HouseMatchShareCreateOut>('/api/house-match-shares/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 延期配房分享 POST /api/house-match-shares/${param0}/extend/ */
export function houseMatchSharesShareIdExtendUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseMatchSharesShareIdExtendUsingPostParams;
  body: API.HouseMatchShareExtendIn;
  options?: CustomRequestOptions_;
}) {
  const { share_id: param0, ...queryParams } = params;

  return request<API.HouseMatchShareOut>(
    `/api/house-match-shares/${param0}/extend/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 失效配房分享 POST /api/house-match-shares/${param0}/revoke/ */
export function houseMatchSharesShareIdRevokeUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseMatchSharesShareIdRevokeUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { share_id: param0, ...queryParams } = params;

  return request<API.HouseMatchShareOut>(
    `/api/house-match-shares/${param0}/revoke/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
