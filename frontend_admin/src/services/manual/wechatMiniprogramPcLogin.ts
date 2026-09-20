import { request } from '@umijs/max';

const WECHAT_MINIPROGRAM_PC_LOGIN_BASE =
  '/api/users/auth/wechat-miniprogram/qr';
const POLL_TOKEN_HEADER = 'X-WeChat-Login-Token';

const REQUEST_OPTIONS = {
  credentials: 'include',
  skipErrorHandler: true,
} as const;

export type WechatMiniprogramPcLoginQr = {
  login_id: string;
  poll_token: string;
  qr_image_url: string;
  expires_in: number;
  poll_interval: number;
};

export type WechatMiniprogramPcLoginStatus = {
  status:
    | 'pending'
    | 'scanned'
    | 'processing'
    | 'completed'
    | 'expired'
    | 'failed';
  expires_in: number;
};

export function createWechatMiniprogramPcLoginQr(redirect: string) {
  return request<WechatMiniprogramPcLoginQr>(
    `${WECHAT_MINIPROGRAM_PC_LOGIN_BASE}/`,
    {
      ...REQUEST_OPTIONS,
      method: 'POST',
      data: { redirect },
    },
  );
}

export function getWechatMiniprogramPcLoginStatus(
  loginId: string,
  pollToken: string,
) {
  return request<WechatMiniprogramPcLoginStatus>(
    `${WECHAT_MINIPROGRAM_PC_LOGIN_BASE}/${encodeURIComponent(loginId)}/`,
    {
      ...REQUEST_OPTIONS,
      method: 'GET',
      headers: {
        [POLL_TOKEN_HEADER]: pollToken,
      },
    },
  );
}

export function completeWechatMiniprogramPcLogin(
  loginId: string,
  pollToken: string,
) {
  return request(
    `${WECHAT_MINIPROGRAM_PC_LOGIN_BASE}/${encodeURIComponent(loginId)}/complete/`,
    {
      ...REQUEST_OPTIONS,
      method: 'POST',
      data: {},
      headers: {
        [POLL_TOKEN_HEADER]: pollToken,
      },
    },
  );
}

