/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 按房东关系查询房源 GET /api/house/landlord/contacts/${param0}/houses/ */
export function houseLandlordContactsContactIdHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLandlordContactsContactIdHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { contact_id: param0, ...queryParams } = params;

  return request<API.PagedLandlordHouseOut>(
    `/api/house/landlord/contacts/${param0}/houses/`,
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

/** 按房东关系查询租约 GET /api/house/landlord/contacts/${param0}/leases/ */
export function houseLandlordContactsContactIdLeasesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLandlordContactsContactIdLeasesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { contact_id: param0, ...queryParams } = params;

  return request<API.PagedLeaseOut>(
    `/api/house/landlord/contacts/${param0}/leases/`,
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

/** 查询房东邀请 GET /api/house/landlord/invites/${param0}/ */
export function houseLandlordInvitesTokenUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLandlordInvitesTokenUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { token: param0, ...queryParams } = params;

  return request<API.LandlordInvitationOut>(
    `/api/house/landlord/invites/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 接受房东邀请 POST /api/house/landlord/invites/${param0}/accept/ */
export function houseLandlordInvitesTokenAcceptUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLandlordInvitesTokenAcceptUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { token: param0, ...queryParams } = params;

  return request<API.LandlordInvitationAcceptOut>(
    `/api/house/landlord/invites/${param0}/accept/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

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

/** 获取房东绑定关系 GET /api/house/landlord/relationships/ */
export function houseLandlordRelationshipsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.LandlordRelationshipOut[]>(
    '/api/house/landlord/relationships/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}
