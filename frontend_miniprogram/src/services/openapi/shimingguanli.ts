/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取实名认证记录列表 GET /api/admin/real-name-verifications/ */
export function adminRealNameVerificationsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminRealNameVerificationsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAdminRealNameVerificationRowOut>(
    '/api/admin/real-name-verifications/',
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

/** 获取实名认证详情 GET /api/admin/real-name-verifications/${param0}/ */
export function adminRealNameVerificationsVerificationIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminRealNameVerificationsVerificationIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { verification_id: param0, ...queryParams } = params;

  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 人工通过实名认证 POST /api/admin/real-name-verifications/${param0}/approve/ */
export function adminRealNameVerificationsVerificationIdApproveUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminRealNameVerificationsVerificationIdApproveUsingPostParams;
  body: API.AdminRealNameDecisionIn;
  options?: CustomRequestOptions_;
}) {
  const { verification_id: param0, ...queryParams } = params;

  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/approve/`,
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

/** 转人工复核 POST /api/admin/real-name-verifications/${param0}/manual-review/ */
export function adminRealNameVerificationsVerificationIdManualReviewUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminRealNameVerificationsVerificationIdManualReviewUsingPostParams;
  body: API.AdminRealNameDecisionIn;
  options?: CustomRequestOptions_;
}) {
  const { verification_id: param0, ...queryParams } = params;

  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/manual-review/`,
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

/** 人工驳回实名认证 POST /api/admin/real-name-verifications/${param0}/reject/ */
export function adminRealNameVerificationsVerificationIdRejectUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminRealNameVerificationsVerificationIdRejectUsingPostParams;
  body: API.AdminRealNameDecisionIn;
  options?: CustomRequestOptions_;
}) {
  const { verification_id: param0, ...queryParams } = params;

  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/reject/`,
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

/** 撤销实名认证 POST /api/admin/real-name-verifications/${param0}/revoke/ */
export function adminRealNameVerificationsVerificationIdRevokeUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminRealNameVerificationsVerificationIdRevokeUsingPostParams;
  body: API.AdminRealNameDecisionIn;
  options?: CustomRequestOptions_;
}) {
  const { verification_id: param0, ...queryParams } = params;

  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/revoke/`,
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
