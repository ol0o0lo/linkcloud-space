// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租客个人租约 GET /api/house/tenant/leases/ */
export async function appsHouseApiListTenantLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListTenantLeasesParams,
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
export async function appsHouseApiGetTenantLease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetTenantLeaseParams,
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
export async function appsHouseApiListTenantViewingRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListTenantViewingRecordsParams,
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
export async function appsHouseApiCreateTenantViewingRecord(
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
export async function appsHouseApiGetTenantViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetTenantViewingRecordParams,
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
export async function appsHouseApiCancelTenantViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCancelTenantViewingRecordParams,
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
