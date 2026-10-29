/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取房源咨询 GET /api/house/inquiries/ */
export function houseInquiriesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseInquiriesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedInquiryOut>('/api/house/inquiries/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取咨询及本次需求历史 GET /api/house/inquiries/${param0}/ */
export function houseInquiriesInquiryIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseInquiriesInquiryIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { inquiry_id: param0, ...queryParams } = params;

  return request<API.InquiryOut>(`/api/house/inquiries/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新咨询 PATCH /api/house/inquiries/${param0}/ */
export function houseInquiriesInquiryIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseInquiriesInquiryIdUsingPatchParams;
  body: API.InquiryPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { inquiry_id: param0, ...queryParams } = params;

  return request<API.InquiryOut>(`/api/house/inquiries/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 转派当前咨询 POST /api/house/inquiries/${param0}/assign/ */
export function houseInquiriesInquiryIdAssignUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseInquiriesInquiryIdAssignUsingPostParams;
  body: API.InquiryAssignIn;
  options?: CustomRequestOptions_;
}) {
  const { inquiry_id: param0, ...queryParams } = params;

  return request<API.InquiryOut>(`/api/house/inquiries/${param0}/assign/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 确认咨询客户 POST /api/house/inquiries/${param0}/convert/ */
export function houseInquiriesInquiryIdConvertUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseInquiriesInquiryIdConvertUsingPostParams;
  body: API.CustomerInquiryConvertIn;
  options?: CustomRequestOptions_;
}) {
  const { inquiry_id: param0, ...queryParams } = params;

  return request<API.InquiryContactOut>(
    `/api/house/inquiries/${param0}/convert/`,
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
