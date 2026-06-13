import { request } from '@umijs/max';
import { currentUser } from '@/services/ant-design-pro/api';
import city from './geographic/city.json';
import province from './geographic/province.json';
import type { CurrentUser, GeographicItemType, SocialBindingItem, SocialBindingProvider } from './data';

const ALLAUTH_BROWSER_BASE = '/api/allauth/browser/v1';

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

export type UpdateProfilePayload = {
  last_name: string;
};

export type UploadAvatarResponse = {
  avatar_url: string | null;
};

export type SocialBindingsResponse = {
  items: SocialBindingItem[];
};

export async function queryCurrent(): Promise<{ data: CurrentUser }> {
  return currentUser() as Promise<{ data: CurrentUser }>;
}

export async function updateCurrentUser(
  userId: number,
  payload: UpdateProfilePayload,
) {
  return request(`/api/users/${userId}/`, {
    method: 'PATCH',
    data: payload,
  });
}

export async function uploadAvatar(file: File): Promise<UploadAvatarResponse> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('crop_data', '{}');

  return request('/api/users/me/avatar/', {
    method: 'POST',
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
