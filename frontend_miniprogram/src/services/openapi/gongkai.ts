/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取坐标周边设施 GET /api/geography/nearby-pois/ */
export function geographyNearbyPoisUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.GeographyNearbyPoisUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.NearbyPoisOut>('/api/geography/nearby-pois/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 根据坐标解析所在地区 GET /api/geography/regions/resolve/ */
export function geographyRegionsResolveUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.GeographyRegionsResolveUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.LocatedRegionOut>('/api/geography/regions/resolve/', {
    method: 'GET',
    params: {
      // coordinate_system has a default value: gcj02
      coordinate_system: 'gcj02',
      ...params,
    },
    ...(options || {}),
  });
}

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

/** 联想公开房源搜索词 GET /api/public/houses/suggestions/ */
export function publicHousesSuggestionsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.PublicHousesSuggestionsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PublicHouseSuggestionOut[]>(
    '/api/public/houses/suggestions/',
    {
      method: 'GET',
      params: {
        // radius_m has a default value: 1000
        radius_m: '1000',

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

/** 公开获取 SaaS 套餐目录 GET /api/public/saas/plans/ */
export function publicSaasPlansUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.PlanOut[]>('/api/public/saas/plans/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 公开提交企业版需求 POST /api/public/saas/sales-leads/ */
export function publicSaasSalesLeadsUsingPost({
  body,
  options,
}: {
  body: API.SalesLeadCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.SalesLeadOut>('/api/public/saas/sales-leads/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}
