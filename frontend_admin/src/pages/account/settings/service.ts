import { request } from '@umijs/max';
import { currentUser } from '@/services/manual/api';
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

type AllauthCollectionResponse<T> = {
  data?: T;
  meta?: Record<string, any>;
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
    await request(`${ALLAUTH_BROWSER_BASE}/config`, {
      method: 'GET',
      credentials: 'include',
      skipErrorHandler: true,
    } as any);
    token = getCookie('csrftoken');
  }
  return token;
}

export async function queryCurrent(): Promise<{ data: CurrentUser }> {
  return currentUser() as Promise<{ data: CurrentUser }>;
}

export async function updateCurrentUser(
  userId: number,
  payload: UpdateProfilePayload,
) {
  const csrfToken = await ensureCsrfToken();
  return request(`/api/users/${userId}/`, {
    credentials: 'include',
    method: 'PATCH',
    headers: {
      'X-CSRFToken': csrfToken,
    },
    data: payload,
  });
}

export async function uploadAvatar(file: File): Promise<UploadAvatarResponse> {
  const csrfToken = await ensureCsrfToken();
  const formData = new FormData();
  formData.append('image', file);
  formData.append('crop_data', '{}');

  return request('/api/users/me/avatar/', {
    credentials: 'include',
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
    },
    data: formData,
  });
}

export async function querySocialBindings(): Promise<SocialBindingsResponse> {
  return request('/api/users/me/social-bindings/', {
    method: 'GET',
    credentials: 'include',
  });
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
  return request(`${ALLAUTH_BROWSER_BASE}/account/password/change`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  } as any);
}

export async function requestPhoneChangeCode(phone: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/account/phone`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { phone },
  } as any);
}

export async function confirmPhoneChange(code: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/auth/phone/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { code },
  } as any);
}

export async function listAccountEmails() {
  return request<
    AllauthCollectionResponse<
      Array<{ email: string; primary?: boolean; verified?: boolean }>
    >
  >(`${ALLAUTH_BROWSER_BASE}/account/email`, {
    method: 'GET',
    credentials: 'include',
  } as any);
}

export async function addAccountEmail(email: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/account/email`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { email },
  } as any);
}

export async function setPrimaryAccountEmail(email: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/account/email`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { email, primary: true },
  } as any);
}

export async function listAuthenticators() {
  return request<AllauthCollectionResponse<Array<{ type: string }>>>(
    `${ALLAUTH_BROWSER_BASE}/account/authenticators`,
    {
      method: 'GET',
      credentials: 'include',
    } as any,
  );
}

export async function getTotpSetup() {
  try {
    const response = await request<AllauthCollectionResponse<never>>(
      `${ALLAUTH_BROWSER_BASE}/account/authenticators/totp`,
      {
        method: 'GET',
        credentials: 'include',
        skipErrorHandler: true,
      } as any,
    );
    if (response.meta?.secret && response.meta?.totp_url) {
      return {
        secret: response.meta.secret,
        totpUrl: response.meta.totp_url,
      };
    }
    throw new Error('TOTP 初始化信息缺失');
  } catch (error: any) {
    const status = error?.response?.status;
    const meta = error?.response?.data?.meta || error?.data?.meta || {};
    if (status === 404 && meta.secret && meta.totp_url) {
      return {
        secret: meta.secret,
        totpUrl: meta.totp_url,
      };
    }
    throw error;
  }
}

export async function activateTotp(code: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`${ALLAUTH_BROWSER_BASE}/account/authenticators/totp`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: { code },
  } as any);
}

export async function deleteAuthenticator(type: string) {
  const csrfToken = await ensureCsrfToken();
  return request(`/api/users/me/mfa/authenticators/${type}/`, {
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
