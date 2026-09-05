// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 按房东关系查询房源 GET /api/house/landlord/contacts/${param0}/houses/ */
export async function appsHouseApiListLandlordContactHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListLandlordContactHousesParams,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.PagedLandlordHouseOut>(
    `/api/house/landlord/contacts/${param0}/houses/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 按房东关系查询租约 GET /api/house/landlord/contacts/${param0}/leases/ */
export async function appsHouseApiListLandlordContactLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListLandlordContactLeasesParams,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.PagedLeaseOut>(
    `/api/house/landlord/contacts/${param0}/leases/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询房东邀请 GET /api/house/landlord/invites/${param0}/ */
export async function appsHouseApiGetLandlordInvite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetLandlordInviteParams,
  options?: { [key: string]: any }
) {
  const { token: param0, ...queryParams } = params;
  return request<API.LandlordInvitationOut>(
    `/api/house/landlord/invites/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 接受房东邀请 POST /api/house/landlord/invites/${param0}/accept/ */
export async function appsHouseApiAcceptLandlordInvite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiAcceptLandlordInviteParams,
  options?: { [key: string]: any }
) {
  const { token: param0, ...queryParams } = params;
  return request<API.LandlordInvitationAcceptOut>(
    `/api/house/landlord/invites/${param0}/accept/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 房东查询名下房源 GET /api/house/landlord/my-houses/ */
export async function appsHouseApiListMyHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListMyHousesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedHouseOut>("/api/house/landlord/my-houses/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 房东查询名下租约 GET /api/house/landlord/my-leases/ */
export async function appsHouseApiListMyLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListMyLeasesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedLeaseOut>("/api/house/landlord/my-leases/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取房东绑定关系 GET /api/house/landlord/relationships/ */
export async function appsHouseApiListLandlordRelationships(options?: {
  [key: string]: any;
}) {
  return request<API.LandlordRelationshipOut[]>(
    "/api/house/landlord/relationships/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}
