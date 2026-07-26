/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取我的收藏 GET /api/users/me/favorite/ */
export function usersMeFavoriteUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersMeFavoriteUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedFavoriteOut>('/api/users/me/favorite/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 收藏目标 PUT /api/users/me/favorite/ */
export function usersMeFavoriteUsingPut({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersMeFavoriteUsingPutParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.FavoriteOut>('/api/users/me/favorite/', {
    method: 'PUT',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 取消收藏目标 DELETE /api/users/me/favorite/ */
export function usersMeFavoriteUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersMeFavoriteUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  return request<unknown>('/api/users/me/favorite/', {
    method: 'DELETE',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取收藏目标类型 GET /api/users/me/favorite/type/ */
export function usersMeFavoriteTypeUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.FavoriteTargetTypeOut[]>('/api/users/me/favorite/type/', {
    method: 'GET',
    ...(options || {}),
  });
}
