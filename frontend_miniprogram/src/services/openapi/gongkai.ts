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
      // radius_m has a default value: 1000
      radius_m: '1000',

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

/** 按地图视野获取公开房源聚合标点 GET /api/public/houses/map/ */
export function publicHousesMapUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesMapUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PublicHouseMapOut>('/api/public/houses/map/', {
    method: 'GET',
    params: {
      // zoom has a default value: 8
      zoom: '8',

      // radius_m has a default value: 3000
      radius_m: '3000',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取公开房源地区目录 GET /api/public/houses/regions/ */
export function publicHousesRegionsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.PublicHouseRegionsOut>('/api/public/houses/regions/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 根据坐标解析所在地区 GET /api/public/houses/regions/resolve/ */
export function publicHousesRegionsResolveUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesRegionsResolveUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PublicHouseLocatedRegionOut>(
    '/api/public/houses/regions/resolve/',
    {
      method: 'GET',
      params: {
        // coordinate_system has a default value: gcj02
        coordinate_system: 'gcj02',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取已开通地铁城市 GET /api/public/metro/cities/ */
export function publicMetroCitiesUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.PublicMetroCitySummaryOut[]>('/api/public/metro/cities/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取城市地铁线路和站点 GET /api/public/metro/cities/${param0}/ */
export function publicMetroCitiesCityNameUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicMetroCitiesCityNameUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { city_name: param0, ...queryParams } = params;

  return request<API.PublicMetroCityDetailOut>(
    `/api/public/metro/cities/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取小程序首页专题和指南列表 GET /api/public/miniprogram/home-entries/ */
export function publicMiniprogramHomeEntriesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicMiniprogramHomeEntriesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedMiniProgramHomeEntrySummaryOut>(
    '/api/public/miniprogram/home-entries/',
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

/** 获取小程序首页专题或指南详情 GET /api/public/miniprogram/home-entries/${param0}/ */
export function publicMiniprogramHomeEntriesSlugUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicMiniprogramHomeEntriesSlugUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.MiniProgramHomeEntryDetailOut>(
    `/api/public/miniprogram/home-entries/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取小程序首页专题房源 GET /api/public/miniprogram/home-entries/${param0}/houses/ */
export function publicMiniprogramHomeEntriesSlugHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicMiniprogramHomeEntriesSlugHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.PagedMiniProgramHomeEntryHousePublicOut>(
    `/api/public/miniprogram/home-entries/${param0}/houses/`,
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

/** 获取小程序首页公开内容 GET /api/public/miniprogram/home/ */
export function publicMiniprogramHomeUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.MiniProgramHomeOut>('/api/public/miniprogram/home/', {
    method: 'GET',
    ...(options || {}),
  });
}
