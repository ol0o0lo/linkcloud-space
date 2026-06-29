import { request } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';

export type EnumOption = {
  value: string;
  mapping: string;
};

export type EnumMap = Record<string, EnumOption[]>;

export function listEnums(keys: string[]) {
  return request<EnumMap>('/api/enums/', {
    method: 'GET',
    params: keys.length ? { keys: keys.join(',') } : undefined,
  });
}

export function useEnums(keys: string[]) {
  return useQuery({
    queryKey: ['enums', keys],
    queryFn: () => listEnums(keys),
    staleTime: 10 * 60 * 1000,
  });
}

export function enumSelectOptions(enumMap: EnumMap | undefined, key: string) {
  return (enumMap?.[key] || []).map((item) => ({
    value: item.value,
    label: item.mapping,
  }));
}

export function enumMapping(value: string | undefined | null, mapping: string | undefined | null) {
  return mapping || value || '-';
}

export function enumOptionMapping(enumMap: EnumMap | undefined, key: string, value?: string | null) {
  if (!value) return '-';
  return enumMap?.[key]?.find((item) => item.value === value)?.mapping || value;
}
