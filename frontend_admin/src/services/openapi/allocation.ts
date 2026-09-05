// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 搜索收益受益人 GET /api/allocation/beneficiaries/ */
export async function appsAllocationApiListAllocationBeneficiaries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAllocationApiListAllocationBeneficiariesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAllocationBeneficiaryOut>(
    "/api/allocation/beneficiaries/",
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

/** 获取收益分配能力 GET /api/allocation/capabilities/ */
export async function appsAllocationApiGetAllocationCapabilities(options?: {
  [key: string]: any;
}) {
  return request<API.AllocationCapabilitiesOut>(
    "/api/allocation/capabilities/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 获取应计收益流水 GET /api/allocation/entries/ */
export async function appsAllocationApiListAccrualEntries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAllocationApiListAccrualEntriesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAccrualEntryOut>("/api/allocation/entries/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建人工应计收益调整 POST /api/allocation/manual-entries/ */
export async function appsAllocationApiCreateManualAccrualEntry(
  body: API.ManualAccrualEntryIn,
  options?: { [key: string]: any }
) {
  return request<API.AccrualEntryOut>("/api/allocation/manual-entries/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 按员工和月份汇总应计收益 GET /api/allocation/monthly-totals/ */
export async function appsAllocationApiListMonthlyAccrualTotals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAllocationApiListMonthlyAccrualTotalsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMonthlyAccrualTotalOut>(
    "/api/allocation/monthly-totals/",
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

/** 获取分配申请列表 GET /api/allocation/requests/ */
export async function appsAllocationApiListAllocationRequests(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAllocationApiListAllocationRequestsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAllocationRequestOut>("/api/allocation/requests/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取分配申请详情 GET /api/allocation/requests/${param0}/ */
export async function appsAllocationApiGetAllocationRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAllocationApiGetAllocationRequestParams,
  options?: { [key: string]: any }
) {
  const { allocation_request_id: param0, ...queryParams } = params;
  return request<API.AllocationRequestOut>(
    `/api/allocation/requests/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
