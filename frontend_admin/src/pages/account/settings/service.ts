import { getBrowserV1AccountEmail, patchBrowserV1AccountEmail, postBrowserV1AccountEmail } from '@/services/allauth/accountEmail';
import { postBrowserV1AccountPasswordChange } from '@/services/allauth/accountPassword';
import { postBrowserV1AccountPhone } from '@/services/allauth/accountPhone';
import { getBrowserV1AccountAuthenticators, postBrowserV1AccountAuthenticatorsTotp } from '@/services/allauth/accountTwoFactor';
import { postBrowserV1AuthPhoneVerify } from '@/services/allauth/authAccount';
import { getBrowserV1Config } from '@/services/allauth/configuration';
import { appsAccountsApiDeleteMyAuthenticator, appsAccountsApiGetMe, appsAccountsApiGetSocialBindings, appsAccountsApiGetTotpSetup, appsAccountsApiPatchUser, appsAccountsApiUploadAvatar } from '@/services/openapi/userAccount';
import { request } from '@umijs/max';
import type {
  CurrentUser,
  GeographicItemType,
  SocialBindingItem,
  SocialBindingProvider,
} from './data';
import city from './geographic/city.json';
import province from './geographic/province.json';

const ALLAUTH_BROWSER_BASE = '/api/allauth/browser/v1';

export type UpdateProfilePayload = {
  last_name: string;
};

export type UploadAvatarResponse = {
  avatar_url: string | null;
};

export type SocialBindingsResponse = {
  items: SocialBindingItem[];
};

function getCookie(name: string) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

async function ensureCsrfToken() {
  let token = getCookie('csrftoken');
  if (!token) {
    await getBrowserV1Config(
      { client: 'browser' },
      {
        credentials: 'include',
        skipErrorHandler: true,
      } as any,
    );
    token = getCookie('csrftoken');
  }
  return token;
}

export async function queryCurrent(): Promise<{ data: CurrentUser }> {
  const data = await appsAccountsApiGetMe();
  return { data: data as CurrentUser };
}

export async function updateCurrentUser(
  userId: number,
  payload: UpdateProfilePayload,
) {
  const csrfToken = await ensureCsrfToken();
  return appsAccountsApiPatchUser(
    { user_id: userId },
    payload,
    {
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    },
  );
}

export async function uploadAvatar(file: File): Promise<UploadAvatarResponse> {
  const csrfToken = await ensureCsrfToken();
  return appsAccountsApiUploadAvatar(
    { crop_data: '{}' },
    file,
    {
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    },
  );
}

export async function querySocialBindings(): Promise<SocialBindingsResponse> {
  const response = await appsAccountsApiGetSocialBindings({
    method: 'GET',
    credentials: 'include',
  });
  return {
    items: response.items.map((item) => ({
      ...item,
      provider: item.provider as SocialBindingProvider,
    })),
  };
}

export async function startSocialBinding(provider: SocialBindingProvider) {
  const csrfToken = await ensureCsrfToken();
  const callbackUrl = `${window.location.origin}/account/settings?tab=binding`;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${ALLAUTH_BROWSER_BASE}/auth/provider/redirect`;
  form.style.display = 'none';

  [
    ['csrfmiddlewaretoken', csrfToken],
    ['provider', provider],
    ['callback_url', callbackUrl],
    ['process', 'login'],
  ].forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserV1AccountPasswordChange(
    { client: 'browser' },
    {
      current_password: currentPassword,
      new_password: newPassword,
    },
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function requestPhoneChangeCode(phone: string) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserV1AccountPhone(
    { client: 'browser' },
    { phone },
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function confirmPhoneChange(code: string) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserV1AuthPhoneVerify(
    { client: 'browser' },
    { code },
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function listAccountEmails(): Promise<
  Array<{ email: string; primary?: boolean; verified?: boolean }>
> {
  const response = await getBrowserV1AccountEmail(
    { client: 'browser' },
    {
      method: 'GET',
      credentials: 'include',
    } as any,
  );
  return (response.data || []).map((item) => ({
    email: String(item.email),
    primary: item.primary,
    verified: item.verified,
  }));
}

export async function addAccountEmail(email: string) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserV1AccountEmail(
    { client: 'browser' },
    { email: email as any },
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function setPrimaryAccountEmail(email: string) {
  const csrfToken = await ensureCsrfToken();
  return patchBrowserV1AccountEmail(
    { client: 'browser' },
    { email: email as any, primary: true },
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function listAuthenticators(): Promise<Array<{ type: string }>> {
  const response = await getBrowserV1AccountAuthenticators(
    { client: 'browser' },
    {
      credentials: 'include',
      method: 'GET',
    } as any,
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function getTotpSetup() {
  try {
    const response = await appsAccountsApiGetTotpSetup({
      method: 'GET',
      credentials: 'include',
      skipErrorHandler: true,
    } as any);
    if (response.secret && response.totp_url) {
      return {
        secret: response.secret,
        totpUrl: response.totp_url,
      };
    }
    throw new Error('TOTP 初始化信息缺失');
  } catch (error: any) {
    const response = error?.response?.data || error?.data || {};
    if (response.secret && response.totp_url) {
      return {
        secret: response.secret,
        totpUrl: response.totp_url,
      };
    }
    throw error;
  }
}

export async function activateTotp(code: string) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserV1AccountAuthenticatorsTotp(
    { client: 'browser' },
    { code },
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function deleteAuthenticator(type: string) {
  const csrfToken = await ensureCsrfToken();
  return appsAccountsApiDeleteMyAuthenticator(
    { authenticator_type: type },
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function queryProvince(): Promise<{ data: GeographicItemType[] }> {
  return { data: province };
}

export async function queryCity(
  province: string,
): Promise<{ data: GeographicItemType[] }> {
  return { data: city[province as keyof typeof city] || [] };
}

export async function query() {
  return request('/api/users');
}
