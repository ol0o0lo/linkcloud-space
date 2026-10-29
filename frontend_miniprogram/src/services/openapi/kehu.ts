/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取客户管理能力 GET /api/house/customer-capabilities/ */
export function houseCustomerCapabilitiesUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<Record<string, boolean>>('/api/house/customer-capabilities/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 将咨询转入客户 POST /api/house/customer-inquiries/${param0}/convert/ */
export function houseCustomerInquiriesNotificationIdConvertUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseCustomerInquiriesNotificationIdConvertUsingPostParams;
  body: API.CustomerInquiryConvertIn;
  options?: CustomRequestOptions_;
}) {
  const { notification_id: param0, ...queryParams } = params;

  return request<API.InquiryContactOut>(
    `/api/house/customer-inquiries/${param0}/convert/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取客户工作台待办 GET /api/house/customer-workbench/ */
export function houseCustomerWorkbenchUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.CustomerWorkbenchOut>('/api/house/customer-workbench/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取客户列表 GET /api/house/customers/ */
export function houseCustomersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseCustomersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedCustomerOut>('/api/house/customers/', {
    method: 'GET',
    params: {
      // scope has a default value: all
      scope: 'all',
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建客户 POST /api/house/customers/ */
export function houseCustomersUsingPost({
  body,
  options,
}: {
  body: API.CustomerIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.CustomerOut>('/api/house/customers/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取客户详情 GET /api/house/customers/${param0}/ */
export function houseCustomersContactIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseCustomersContactIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { contact_id: param0, ...queryParams } = params;

  return request<API.CustomerOut>(`/api/house/customers/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户档案 PATCH /api/house/customers/${param0}/ */
export function houseCustomersContactIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseCustomersContactIdUsingPatchParams;
  body: API.CustomerPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { contact_id: param0, ...queryParams } = params;

  return request<API.CustomerOut>(`/api/house/customers/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
