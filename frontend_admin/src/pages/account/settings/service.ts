import { request } from '@umijs/max';
import {
  deleteBrowserV1AccountEmail,
  getBrowserV1AccountEmail,
  patchBrowserV1AccountEmail,
  postBrowserV1AccountEmail,
} from '@/services/allauth/accountEmail';
import { postBrowserV1AccountPasswordChange } from '@/services/allauth/accountPassword';
import {
  getBrowserV1AccountAuthenticators,
  getBrowserV1AccountAuthenticatorsRecoveryCodes,
  getBrowserV1AccountAuthenticatorsTotp,
  postBrowserV1AccountAuthenticatorsTotp,
} from '@/services/allauth/accountTwoFactor';
import {
  postBrowserV1AuthReauthenticate,
} from '@/services/allauth/authAccount';
import { getBrowserV1Config } from '@/services/allauth/configuration';
import {
  postBrowserPhoneChangeWithSplit,
  postBrowserPhoneVerifyWithCode,
} from '@/services/manual/phoneAuth';
import {
  appsAccountsApiDeleteMyAuthenticator,
  appsAccountsApiGetMe,
  appsAccountsApiGetSocialBindings,
  appsAccountsApiPatchUser,
} from '@/services/openapi/userAccount';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import { normalizeEmailLikeInput } from '@/utils/email';
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
  last_name?: string;
  avatar?: API.MediaRefIn[] | null;
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
    await getBrowserV1Config({ client: 'browser' }, {
      credentials: 'include',
      skipErrorHandler: true,
    } as any);
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
  return appsAccountsApiPatchUser({ user_id: userId }, payload, {
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  });
}

export async function uploadAvatar(
  userId: number,
  file: File,
): Promise<UploadAvatarResponse> {
  const csrfToken = await ensureCsrfToken();
  const [media] = await appsMediaApiUploadFiles({
    resource_type: 'avatar',
    scope: 'user',
  }, [file], {
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  });
  return appsAccountsApiPatchUser({ user_id: userId }, {
    avatar: [{ media_id: media.id, media_type: 'image' }],
  }, {
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  }) as Promise<UploadAvatarResponse>;
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
  const callbackUrl = `${window.location.origin}/account/settings?tab=security`;
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

export async function requestPhoneChangeCode(
  countryCode: string,
  nationalNumber: string,
) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserPhoneChangeWithSplit({
    phone_country_code: countryCode,
    phone_national_number: nationalNumber,
  }, {
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  } as any);
}

export async function confirmPhoneChange(code: string) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserPhoneVerifyWithCode({ code }, {
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  } as any);
}

export async function listAccountEmails(): Promise<
  Array<{ email: string; primary?: boolean; verified?: boolean }>
> {
  const response = await getBrowserV1AccountEmail({ client: 'browser' }, {
    method: 'GET',
    credentials: 'include',
  } as any);
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
    { email: normalizeEmailLikeInput(email) as any },
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
    { email: normalizeEmailLikeInput(email) as any, primary: true },
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    } as any,
  );
}

export async function removeAccountEmail(email: string) {
  const csrfToken = await ensureCsrfToken();
  return deleteBrowserV1AccountEmail(
    { client: 'browser' },
    { email: normalizeEmailLikeInput(email) as any },
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
  const readSetupPayload = (payload: any) => {
    const source = payload?.meta || payload || {};
    if (source.secret && source.totp_url) {
      return {
        secret: source.secret,
        totpUrl: source.totp_url,
      };
    }
    return null;
  };

  try {
    const response = await getBrowserV1AccountAuthenticatorsTotp(
      { client: 'browser' },
      {
        method: 'GET',
        credentials: 'include',
        skipErrorHandler: true,
      } as any,
    );
    const setup = readSetupPayload(response);
    if (setup) {
      return setup;
    }
    throw new Error('TOTP 初始化信息缺失');
  } catch (error: any) {
    const setup = readSetupPayload(error?.response?.data || error?.data);
    if (setup) {
      return setup;
    }
    throw error;
  }
}

export async function getRecoveryCodes(): Promise<string[]> {
  const response = await getBrowserV1AccountAuthenticatorsRecoveryCodes(
    { client: 'browser' },
    {
      method: 'GET',
      credentials: 'include',
      skipErrorHandler: true,
    } as any,
  );
  const codes = response?.data?.unused_codes;
  return Array.isArray(codes) ? codes.map((code) => String(code)) : [];
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

export async function reauthenticate(password: string) {
  const csrfToken = await ensureCsrfToken();
  return postBrowserV1AuthReauthenticate({ client: 'browser' }, { password }, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
  } as any);
}

export async function deleteAuthenticator(type: string) {
  const csrfToken = await ensureCsrfToken();
  return appsAccountsApiDeleteMyAuthenticator({ authenticator_type: type }, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken,
    },
  } as any);
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
