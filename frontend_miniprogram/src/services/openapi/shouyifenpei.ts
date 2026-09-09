/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 搜索收益受益人 GET /api/allocation/beneficiaries/ */
export function allocationBeneficiariesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AllocationBeneficiariesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAllocationBeneficiaryOut>(
    '/api/allocation/beneficiaries/',
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

/** 获取收益分配能力 GET /api/allocation/capabilities/ */
export function allocationCapabilitiesUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.AllocationCapabilitiesOut>(
    '/api/allocation/capabilities/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 获取应计收益流水 GET /api/allocation/entries/ */
export function allocationEntriesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AllocationEntriesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAccrualEntryOut>('/api/allocation/entries/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建人工应计收益调整 POST /api/allocation/manual-entries/ */
export function allocationManualEntriesUsingPost({
  body,
  options,
}: {
  body: API.ManualAccrualEntryIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.AccrualEntryOut>('/api/allocation/manual-entries/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 按员工和月份汇总应计收益 GET /api/allocation/monthly-totals/ */
export function allocationMonthlyTotalsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AllocationMonthlyTotalsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedMonthlyAccrualTotalOut>(
    '/api/allocation/monthly-totals/',
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

/** 获取分配申请列表 GET /api/allocation/requests/ */
export function allocationRequestsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AllocationRequestsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAllocationRequestOut>('/api/allocation/requests/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取分配申请详情 GET /api/allocation/requests/${param0}/ */
export function allocationRequestsAllocationRequestIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AllocationRequestsAllocationRequestIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { allocation_request_id: param0, ...queryParams } = params;

  return request<API.AllocationRequestOut>(
    `/api/allocation/requests/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
