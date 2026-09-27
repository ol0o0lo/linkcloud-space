/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取运营专题和指南列表 GET /api/public/content/entries/ */
export function publicContentEntriesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicContentEntriesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedContentEntrySummaryOut>(
    '/api/public/content/entries/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取运营专题或指南详情 GET /api/public/content/entries/${param0}/ */
export function publicContentEntriesSlugUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicContentEntriesSlugUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.ContentEntryDetailOut>(
    `/api/public/content/entries/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取运营专题房源 GET /api/public/content/entries/${param0}/houses/ */
export function publicContentEntriesSlugHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicContentEntriesSlugHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.PagedContentEntryHousePublicOut>(
    `/api/public/content/entries/${param0}/houses/`,
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

/** 获取首页公开内容 GET /api/public/content/home/ */
export function publicContentHomeUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.HomeContentOut>('/api/public/content/home/', {
    method: 'GET',
    ...(options || {}),
  });
}
