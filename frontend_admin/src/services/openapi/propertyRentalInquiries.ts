// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取房源咨询 GET /api/house/inquiries/ */
export async function appsHouseApiInquiriesListInquiries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiInquiriesListInquiriesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedInquiryOut>("/api/house/inquiries/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取咨询及本次需求历史 GET /api/house/inquiries/${param0}/ */
export async function appsHouseApiInquiriesInquiryDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiInquiriesInquiryDetailParams,
  options?: { [key: string]: any }
) {
  const { inquiry_id: param0, ...queryParams } = params;
  return request<API.InquiryOut>(`/api/house/inquiries/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新咨询 PATCH /api/house/inquiries/${param0}/ */
export async function appsHouseApiInquiriesPatchInquiry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiInquiriesPatchInquiryParams,
  body: API.InquiryPatchIn,
  options?: { [key: string]: any }
) {
  const { inquiry_id: param0, ...queryParams } = params;
  return request<API.InquiryOut>(`/api/house/inquiries/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 转派当前咨询 POST /api/house/inquiries/${param0}/assign/ */
export async function appsHouseApiInquiriesPostAssignInquiry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiInquiriesPostAssignInquiryParams,
  body: API.InquiryAssignIn,
  options?: { [key: string]: any }
) {
  const { inquiry_id: param0, ...queryParams } = params;
  return request<API.InquiryOut>(`/api/house/inquiries/${param0}/assign/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 确认咨询客户 POST /api/house/inquiries/${param0}/convert/ */
export async function appsHouseApiInquiriesPostConvertInquiry(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiInquiriesPostConvertInquiryParams,
  body: API.CustomerInquiryConvertIn,
  options?: { [key: string]: any }
) {
  const { inquiry_id: param0, ...queryParams } = params;
  return request<API.InquiryContactOut>(
    `/api/house/inquiries/${param0}/convert/`,
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
