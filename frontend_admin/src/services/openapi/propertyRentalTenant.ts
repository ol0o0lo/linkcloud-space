// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 租客发送预约联系方式 POST /api/house/tenant/contact/ */
export async function appsHouseApiTenantCreateTenantContactRequest(
  body: API.TenantContactRequestIn,
  options?: { [key: string]: any }
) {
  return request<API.TenantContactRequestOut>("/api/house/tenant/contact/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租客个人租约 GET /api/house/tenant/leases/ */
export async function appsHouseApiTenantListTenantLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiTenantListTenantLeasesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedTenantLeaseOut>("/api/house/tenant/leases/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取租客个人租约详情 GET /api/house/tenant/leases/${param0}/ */
export async function appsHouseApiTenantGetTenantLease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiTenantGetTenantLeaseParams,
  options?: { [key: string]: any }
) {
  const { lease_id: param0, ...queryParams } = params;
  return request<API.TenantLeaseOut>(`/api/house/tenant/leases/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取租客个人带看记录 GET /api/house/tenant/viewing-records/ */
export async function appsHouseApiTenantListTenantViewingRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiTenantListTenantViewingRecordsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedTenantViewingRecordOut>(
    "/api/house/tenant/viewing-records/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 租客预约看房 POST /api/house/tenant/viewing-records/ */
export async function appsHouseApiTenantCreateTenantViewingRecord(
  body: API.TenantViewingRecordIn,
  options?: { [key: string]: any }
) {
  return request<API.TenantViewingRecordOut>(
    "/api/house/tenant/viewing-records/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取租客个人带看详情 GET /api/house/tenant/viewing-records/${param0}/ */
export async function appsHouseApiTenantGetTenantViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiTenantGetTenantViewingRecordParams,
  options?: { [key: string]: any }
) {
  const { viewing_record_id: param0, ...queryParams } = params;
  return request<API.TenantViewingRecordOut>(
    `/api/house/tenant/viewing-records/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 取消租客个人带看预约 POST /api/house/tenant/viewing-records/${param0}/cancel/ */
export async function appsHouseApiTenantCancelTenantViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiTenantCancelTenantViewingRecordParams,
  options?: { [key: string]: any }
) {
  const { viewing_record_id: param0, ...queryParams } = params;
  return request<API.TenantViewingRecordOut>(
    `/api/house/tenant/viewing-records/${param0}/cancel/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
