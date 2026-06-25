/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取当前用户实名认证状态 GET /api/users/me/real-name/ */
export function usersMeRealNameUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.RealNameVerificationOut>('/api/users/me/real-name/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取当前用户实名认证时间线 GET /api/users/me/real-name/logs/ */
export function usersMeRealNameLogsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.RealNameLogOut[]>('/api/users/me/real-name/logs/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 重新提交实名认证申请 POST /api/users/me/real-name/retry/ */
export function usersMeRealNameRetryUsingPost({
  body,
  options,
}: {
  body: API.RealNameRetryIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.RealNameVerificationOut>(
    '/api/users/me/real-name/retry/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 提交实名认证申请 POST /api/users/me/real-name/submit/ */
export function usersMeRealNameSubmitUsingPost({
  body,
  options,
}: {
  body: API.RealNameSubmitIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.RealNameVerificationOut>(
    '/api/users/me/real-name/submit/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}
