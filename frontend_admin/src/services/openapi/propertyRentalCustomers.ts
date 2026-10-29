// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取客户管理能力 GET /api/house/customer-capabilities/ */
export async function appsHouseApiCustomersCustomerCapabilities(options?: {
  [key: string]: any;
}) {
  return request<Record<string, any>>("/api/house/customer-capabilities/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 将咨询转入客户 POST /api/house/customer-inquiries/${param0}/convert/ */
export async function appsHouseApiCustomersConvertInquiry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCustomersConvertInquiryParams,
  body: API.CustomerInquiryConvertIn,
  options?: { [key: string]: any }
) {
  const { notification_id: param0, ...queryParams } = params;
  return request<API.InquiryContactOut>(
    `/api/house/customer-inquiries/${param0}/convert/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取客户工作台待办 GET /api/house/customer-workbench/ */
export async function appsHouseApiCustomersGetCustomerWorkbench(options?: {
  [key: string]: any;
}) {
  return request<API.CustomerWorkbenchOut>("/api/house/customer-workbench/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取客户列表 GET /api/house/customers/ */
export async function appsHouseApiCustomersListCustomers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCustomersListCustomersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedCustomerOut>("/api/house/customers/", {
    method: "GET",
    params: {
      // scope has a default value: all
      scope: "all",
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建客户 POST /api/house/customers/ */
export async function appsHouseApiCustomersPostCustomer(
  body: API.CustomerIn,
  options?: { [key: string]: any }
) {
  return request<API.CustomerOut>("/api/house/customers/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取客户详情 GET /api/house/customers/${param0}/ */
export async function appsHouseApiCustomersCustomerDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCustomersCustomerDetailParams,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.CustomerOut>(`/api/house/customers/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户档案 PATCH /api/house/customers/${param0}/ */
export async function appsHouseApiCustomersPatchCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCustomersPatchCustomerParams,
  body: API.CustomerPatchIn,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.CustomerOut>(`/api/house/customers/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
