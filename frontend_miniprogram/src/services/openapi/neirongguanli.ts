/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取首页 Banner GET /api/admin/platform-operations/content/banners/ */
export function adminPlatformOperationsContentBannersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentBannersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedHomeBannerAdminOut>(
    '/api/admin/platform-operations/content/banners/',
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

/** 创建首页 Banner POST /api/admin/platform-operations/content/banners/ */
export function adminPlatformOperationsContentBannersUsingPost({
  body,
  options,
}: {
  body: API.HomeBannerCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.HomeBannerAdminOut>(
    '/api/admin/platform-operations/content/banners/',
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

/** 获取首页 Banner 详情 GET /api/admin/platform-operations/content/banners/${param0}/ */
export function adminPlatformOperationsContentBannersBannerIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentBannersBannerIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { banner_id: param0, ...queryParams } = params;

  return request<API.HomeBannerAdminOut>(
    `/api/admin/platform-operations/content/banners/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新首页 Banner PATCH /api/admin/platform-operations/content/banners/${param0}/ */
export function adminPlatformOperationsContentBannersBannerIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentBannersBannerIdUsingPatchParams;
  body: API.HomeBannerPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { banner_id: param0, ...queryParams } = params;

  return request<API.HomeBannerAdminOut>(
    `/api/admin/platform-operations/content/banners/${param0}/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取运营专题和指南 GET /api/admin/platform-operations/content/entries/ */
export function adminPlatformOperationsContentEntriesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentEntriesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedContentEntryAdminOut>(
    '/api/admin/platform-operations/content/entries/',
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

/** 创建运营专题或指南 POST /api/admin/platform-operations/content/entries/ */
export function adminPlatformOperationsContentEntriesUsingPost({
  body,
  options,
}: {
  body: API.ContentEntryCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.ContentEntryAdminOut>(
    '/api/admin/platform-operations/content/entries/',
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

/** 获取运营专题或指南详情 GET /api/admin/platform-operations/content/entries/${param0}/ */
export function adminPlatformOperationsContentEntriesEntryIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentEntriesEntryIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { entry_id: param0, ...queryParams } = params;

  return request<API.ContentEntryAdminOut>(
    `/api/admin/platform-operations/content/entries/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新运营专题或指南 PATCH /api/admin/platform-operations/content/entries/${param0}/ */
export function adminPlatformOperationsContentEntriesEntryIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentEntriesEntryIdUsingPatchParams;
  body: API.ContentEntryPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { entry_id: param0, ...queryParams } = params;

  return request<API.ContentEntryAdminOut>(
    `/api/admin/platform-operations/content/entries/${param0}/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取专题已选房源 GET /api/admin/platform-operations/content/entries/${param0}/houses/ */
export function adminPlatformOperationsContentEntriesEntryIdHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentEntriesEntryIdHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { entry_id: param0, ...queryParams } = params;

  return request<API.PagedContentEntryHouseAdminOut>(
    `/api/admin/platform-operations/content/entries/${param0}/houses/`,
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

/** 保存专题房源 PUT /api/admin/platform-operations/content/entries/${param0}/houses/ */
export function adminPlatformOperationsContentEntriesEntryIdHousesUsingPut({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentEntriesEntryIdHousesUsingPutParams;
  body: API.ContentEntryHousesPutIn;
  options?: CustomRequestOptions_;
}) {
  const { entry_id: param0, ...queryParams } = params;

  return request<API.ContentEntryHouseAdminOut[]>(
    `/api/admin/platform-operations/content/entries/${param0}/houses/`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取运营专题候选房源 GET /api/admin/platform-operations/content/house-candidates/ */
export function adminPlatformOperationsContentHouseCandidatesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminPlatformOperationsContentHouseCandidatesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedContentHouseAdminOut>(
    '/api/admin/platform-operations/content/house-candidates/',
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
