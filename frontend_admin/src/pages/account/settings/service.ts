import { request } from '@umijs/max';
import { currentUser } from '@/services/ant-design-pro/api';
import city from './geographic/city.json';
import province from './geographic/province.json';
import type { CurrentUser, GeographicItemType } from './data';

export type UpdateProfilePayload = {
  last_name: string;
};

export type UploadAvatarResponse = {
  avatar_url: string | null;
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
