import { request } from '@umijs/max';
import { currentUser } from '@/services/ant-design-pro/api';
import city from './geographic/city.json';
import province from './geographic/province.json';
import type { CurrentUser, GeographicItemType } from './data';

export async function queryCurrent(): Promise<{ data: CurrentUser }> {
  return currentUser() as Promise<{ data: CurrentUser }>;
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
