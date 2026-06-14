// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取当前裂变规则配置 GET /api/admin/referrals/config/ */
export async function appsReferralsApiGetReferralConfig(options?: {
  [key: string]: any;
}) {
  return request<API.ReferralRuleConfigOut>("/api/admin/referrals/config/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 更新当前裂变规则配置 PATCH /api/admin/referrals/config/ */
export async function appsReferralsApiPatchReferralConfig(
  body: API.ReferralRuleConfigPatchIn,
  options?: { [key: string]: any }
) {
  return request<API.ReferralRuleConfigOut>("/api/admin/referrals/config/", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取裂变邀请记录列表 GET /api/admin/referrals/records/ */
export async function appsReferralsApiAdminReferralRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsReferralsApiAdminReferralRecordsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedReferralRecordOut>("/api/admin/referrals/records/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 审核裂变奖励 POST /api/admin/referrals/records/${param0}/review/ */
export async function appsReferralsApiReviewReferralRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsReferralsApiReviewReferralRecordParams,
  body: API.ReferralReviewIn,
  options?: { [key: string]: any }
) {
  const { record_id: param0, ...queryParams } = params;
  return request<API.ReferralRecordOut>(
    `/api/admin/referrals/records/${param0}/review/`,
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
