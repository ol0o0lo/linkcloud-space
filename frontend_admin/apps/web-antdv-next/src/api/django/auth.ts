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

export interface PasswordChangeParams {
  current_password: string;
  new_password: string;
}

export interface AuthenticatorRow {
  created_at?: number;
  id?: number;
  is_passwordless?: boolean;
  name?: string;
  total_code_count?: number;
  type: string;
  unused_code_count?: number;
}

export interface RecoveryCodesRow {
  codes?: string[];
  total_code_count?: number;
  unused_codes?: string[];
}

export interface SocialAccountRow {
  display: string;
  provider: {
    id: string;
    name?: string;
  };
  uid: string;
}

export function parseAllauthErrors(responseData: any) {
  const errors: Record<string, string[]> = {};

  if (responseData?.errors) {
    for (const err of responseData.errors) {
      const key = err.param || 'non_field_errors';
      if (!errors[key]) errors[key] = [];
      errors[key].push(err.message);
    }
  }

  if (Object.keys(errors).length === 0) {
    return { non_field_errors: ['发生了未预期的错误。'] };
  }

  return errors;
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

export async function redirectProviderConnect(provider: string, callbackUrl: string) {
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    process: 'connect',
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

export async function changePasswordApi(data: PasswordChangeParams) {
  return await allauthRequest(`${ALLAUTH_BASE}/account/password/change`, {
    body: JSON.stringify(data),
    method: 'POST',
  });
}

export async function getSocialAccountsApi() {
  return await allauthRequest<{ data?: SocialAccountRow[] }>(`${ALLAUTH_BASE}/account/providers`, {
    method: 'GET',
  });
}

export async function disconnectSocialApi(provider: string, accountUid: string) {
  return await allauthRequest(`${ALLAUTH_BASE}/account/providers`, {
    body: JSON.stringify({ account_uid: accountUid, provider }),
    method: 'DELETE',
  });
}

export async function listAuthenticatorsApi() {
  return await allauthRequest<{ data?: AuthenticatorRow[] }>(`${ALLAUTH_BASE}/account/authenticators`, {
    method: 'GET',
  });
}

export async function getTotpStatusApi() {
  return await allauthRequest<any>(`${ALLAUTH_BASE}/account/authenticators/totp`, {
    method: 'GET',
  });
}

export async function activateTotpApi(code: string) {
  return await allauthRequest(`${ALLAUTH_BASE}/account/authenticators/totp`, {
    body: JSON.stringify({ code }),
    method: 'POST',
  });
}

export async function deactivateTotpApi() {
  return await allauthRequest(`${ALLAUTH_BASE}/account/authenticators/totp`, {
    method: 'DELETE',
  });
}

export async function listRecoveryCodesApi() {
  return await allauthRequest<{ data?: RecoveryCodesRow }>(`${ALLAUTH_BASE}/account/authenticators/recovery-codes`, {
    method: 'GET',
  });
}

export async function regenerateRecoveryCodesApi() {
  return await allauthRequest(`${ALLAUTH_BASE}/account/authenticators/recovery-codes`, {
    body: JSON.stringify({}),
    method: 'POST',
  });
}

export async function beginAddPasskeyApi(passwordless: boolean) {
  const params = new URLSearchParams({
    passwordless: passwordless ? 'true' : 'false',
  });
  return await allauthRequest<any>(`${ALLAUTH_BASE}/account/authenticators/webauthn?${params.toString()}`, {
    method: 'GET',
  });
}

export async function addPasskeyApi(name: string, credential: unknown) {
  return await allauthRequest(`${ALLAUTH_BASE}/account/authenticators/webauthn`, {
    body: JSON.stringify({ credential, name }),
    method: 'POST',
  });
}

export async function renamePasskeyApi(id: number, name: string) {
  return await allauthRequest(`${ALLAUTH_BASE}/account/authenticators/webauthn`, {
    body: JSON.stringify({ id, name }),
    method: 'PUT',
  });
}

export async function removePasskeyApi(id: number) {
  return await allauthRequest(`${ALLAUTH_BASE}/account/authenticators/webauthn`, {
    body: JSON.stringify({ authenticators: [id] }),
    method: 'DELETE',
  });
}

export async function reauthenticateApi(password: string) {
  return await allauthRequest(`${ALLAUTH_BASE}/auth/reauthenticate`, {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
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
