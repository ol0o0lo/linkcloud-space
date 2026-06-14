// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取我的邀请记录 GET /api/referrals/me/records/ */
export async function appsReferralsApiMyReferralRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsReferralsApiMyReferralRecordsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedReferralRecordOut>("/api/referrals/me/records/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取我的裂变推广总览 GET /api/referrals/me/summary/ */
export async function appsReferralsApiMyReferralSummary(options?: {
  [key: string]: any;
}) {
  return request<API.ReferralSummaryOut>("/api/referrals/me/summary/", {
    method: "GET",
    ...(options || {}),
  });
}
