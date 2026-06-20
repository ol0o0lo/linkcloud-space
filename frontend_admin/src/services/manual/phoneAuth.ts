import { request } from '@umijs/max';

export async function postBrowserPhoneChangeWithSplit(
  body: { phone_country_code: string; phone_national_number: string },
  options?: { [key: string]: any },
) {
  return request('/api/users/auth/browser/account/phone/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

export async function postBrowserPhoneVerifyWithCode(
  body: { code: string },
  options?: { [key: string]: any },
) {
  return request('/api/users/auth/browser/phone/verify/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}
