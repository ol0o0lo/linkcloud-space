import { request } from '@umijs/max';

export type EnumOption = {
  value: string;
  mapping: string;
};

export type EnumRegistry = Record<string, EnumOption[]>;

export function getEnumRegistry() {
  return request<EnumRegistry>('/api/enums/', {
    method: 'GET',
  });
}

export function toSelectOptions(items?: EnumOption[]) {
  return (items || []).map((item) => ({
    value: item.value,
    label: item.mapping,
  }));
}

export function enumMapping(value?: string | null, mapping?: string | null) {
  return mapping || value || '-';
}
