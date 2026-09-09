import { request } from '@umijs/max';

const WECHAT_OFFICIAL_LOGIN_BASE = '/api/users/auth/wechat-official/qr';
const POLL_TOKEN_HEADER = 'X-WeChat-Login-Token';

const REQUEST_OPTIONS = {
  credentials: 'include',
  skipErrorHandler: true,
} as const;

export type WechatOfficialLoginQr = {
  login_id: string;
  poll_token: string;
  qr_image_url: string;
  expires_in: number;
  poll_interval: number;
};

export type WechatOfficialLoginStatus = {
  status: 'pending' | 'scanned' | 'processing' | 'completed' | 'expired' | 'failed';
  expires_in: number;
};

export function createWechatOfficialLoginQr(redirect: string) {
  return request<WechatOfficialLoginQr>(`${WECHAT_OFFICIAL_LOGIN_BASE}/`, {
    ...REQUEST_OPTIONS,
    method: 'POST',
    data: { redirect },
  });
}

export function getWechatOfficialLoginStatus(loginId: string, pollToken: string) {
  return request<WechatOfficialLoginStatus>(`${WECHAT_OFFICIAL_LOGIN_BASE}/${encodeURIComponent(loginId)}/`, {
    ...REQUEST_OPTIONS,
    method: 'GET',
    headers: {
      [POLL_TOKEN_HEADER]: pollToken,
    },
  });
}

export function completeWechatOfficialLogin(loginId: string, pollToken: string) {
  return request(`${WECHAT_OFFICIAL_LOGIN_BASE}/${encodeURIComponent(loginId)}/complete/`, {
    ...REQUEST_OPTIONS,
    method: 'POST',
    data: {},
    headers: {
      [POLL_TOKEN_HEADER]: pollToken,
    },
  });
}
