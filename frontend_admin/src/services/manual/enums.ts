import { request } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';

export type EnumOption = {
  label: string;
  value: string;
};

export type EnumMap = Record<string, EnumOption[]>;

const ENUM_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  'accounts.real_name_status': {
    unverified: '未认证',
    pending: '审核中',
    verified: '已认证',
    rejected: '未通过',
    manual_review: '人工复核中',
    revoked: '已撤销',
  },
  'notifications.channel': {
    in_app: '站内信',
    email: '邮件',
  },
  'notifications.dispatch_scope': {
    platform: '全平台',
    organization: '指定空间',
    teams: '指定团队',
    users: '指定用户',
  },
  'notifications.dispatch_status': {
    pending: '等待发送',
    sending: '发送中',
    sent: '发送完成',
    failed: '发送失败',
  },
};

function enumLabelOverride(key: string | undefined, value: string | undefined | null) {
  return key && value ? ENUM_LABEL_OVERRIDES[key]?.[value] : undefined;
}

export function listEnums(keys: string[]) {
  return request<EnumMap>('/api/enums/', {
    method: 'GET',
    params: keys.length ? { keys: keys.join(',') } : undefined,
  }).then((enumMap) => {
    return Object.fromEntries(
      Object.entries(enumMap).map(([key, options]) => [
        key,
        options.map((option) => ({
          ...option,
          label: enumLabelOverride(key, option.value) || option.label,
        })),
      ]),
    );
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
  return (enumMap?.[key] || []).map((option) => ({
    ...option,
    label: enumLabelOverride(key, option.value) || option.label,
  }));
}

export function enumMapping(value: string | undefined | null, mapping: string | undefined | null, key?: string) {
  return enumLabelOverride(key, value) || mapping || value || '-';
}

export function enumOptionMapping(enumMap: EnumMap | undefined, key: string, value?: string | null) {
  if (!value) return '-';
  return enumSelectOptions(enumMap, key).find((item) => item.value === value)?.label || value;
}
