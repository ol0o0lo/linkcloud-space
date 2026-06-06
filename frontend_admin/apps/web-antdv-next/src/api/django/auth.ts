import { allauthRequest, djangoGet, getAllauthErrors } from './client';
import {
  getAccessCodesFromContext,
  getAppContextApi,
  mapContextToUserInfo,
} from './context';
import { getPasskeyAssertion } from './webauthn';

const ALLAUTH_BASE = '/_allauth/browser/v1';

export interface LoginParams {
  password?: string;
  username?: string;
}

export interface LoginCodeParams {
  phone: string;
}

export interface LoginCodeConfirmParams {
  code: string;
}

function hasPendingFlow(error: any, flowId: string) {
  const flows = error?.data?.data?.flows ?? error?.data?.flows ?? [];
  return flows.some((flow: any) => flow?.id === flowId && flow?.is_pending);
}

export async function loginWithPasskeyApi() {
  await djangoGet('/csrf/');
  const optionsResp = await allauthRequest<any>(`${ALLAUTH_BASE}/auth/webauthn/login`, {
    method: 'GET',
  });
  const options = optionsResp?.data?.request_options ?? optionsResp?.request_options ?? optionsResp?.data ?? optionsResp;
  const credential = await getPasskeyAssertion(options);

  await allauthRequest(`${ALLAUTH_BASE}/auth/webauthn/login`, {
    body: JSON.stringify({ credential }),
    method: 'POST',
  });

  return { accessToken: 'session' };
}

export async function redirectProviderLogin(provider: string, callbackUrl: string) {
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    process: 'login',
    provider,
  });
  window.location.href = `/api/auth/provider-login/?${params.toString()}`;
}

export async function requestLoginCodeApi(data: LoginCodeParams) {
  try {
    await djangoGet('/csrf/');
    await allauthRequest(`${ALLAUTH_BASE}/auth/code/request`, {
      body: JSON.stringify({ phone: data.phone }),
      method: 'POST',
    });
  } catch (error: any) {
    if (
      error?.response?.status === 401 &&
      hasPendingFlow(error, 'login_by_code')
    ) {
      return;
    }
    throw new Error(getAllauthErrors(error));
  }
}

export async function resendLoginCodeApi() {
  try {
    await djangoGet('/csrf/');
    await allauthRequest(`${ALLAUTH_BASE}/auth/code/resend`, {
      body: '',
      method: 'POST',
    });
  } catch (error: any) {
    throw new Error(getAllauthErrors(error));
  }
}

export async function confirmLoginCodeApi(data: LoginCodeConfirmParams) {
  try {
    await djangoGet('/csrf/');
    await allauthRequest(`${ALLAUTH_BASE}/auth/code/confirm`, {
      body: JSON.stringify({ code: data.code }),
      method: 'POST',
    });
  } catch (error: any) {
    throw new Error(getAllauthErrors(error));
  }

  return { accessToken: 'session' };
}

export async function loginApi(data: LoginParams) {
  try {
    await djangoGet('/csrf/');
    const session = await allauthRequest<any>(`${ALLAUTH_BASE}/auth/session`, {
      method: 'GET',
    }).catch(() => null);
    if (session?.meta?.is_authenticated) {
      return { accessToken: 'session' };
    }
    await allauthRequest(`${ALLAUTH_BASE}/auth/login`, {
      body: JSON.stringify({
        email: data.username,
        password: data.password,
      }),
      method: 'POST',
    });
  } catch (error: any) {
    if (error?.response?.status === 409) {
      const session = await allauthRequest<any>(`${ALLAUTH_BASE}/auth/session`, {
        method: 'GET',
      }).catch(() => null);
      if (session?.meta?.is_authenticated) {
        return { accessToken: 'session' };
      }
    }
    const flows = error?.data?.data?.flows ?? error?.data?.flows ?? [];
    const needsExtraAuth = flows.some((flow: any) =>
      ['mfa_authenticate', 'verify_email', 'verify_phone'].includes(flow.id),
    );
    if (needsExtraAuth) {
      throw new Error('当前账号需要额外验证，后台第一阶段暂未接入该流程。');
    }
    throw new Error(getAllauthErrors(error));
  }

  return { accessToken: 'session' };
}

export async function logoutApi() {
  try {
    await allauthRequest(`${ALLAUTH_BASE}/auth/session`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    if (error?.response?.status !== 401) {
      throw error;
    }
  }
}

export async function refreshTokenApi() {
  return {
    data: 'session',
    status: 200,
  };
}

export async function getUserInfoApi() {
  return mapContextToUserInfo(await getAppContextApi());
}

export async function getAccessCodesApi() {
  return getAccessCodesFromContext(await getAppContextApi());
}
