import type {
  CreateDispatchFormValues,
  DispatchScope,
  DispatchSource,
  RecipientSummary,
  ScopeOption,
} from './types';

const TENANT_SCOPE_OPTIONS: ScopeOption[] = [
  { label: '空间全员', value: 'organization' },
  { label: '指定团队', value: 'teams' },
  { label: '指定成员', value: 'users' },
];
const PLATFORM_SCOPE_OPTIONS: ScopeOption[] = [
  { label: '全平台', value: 'platform' },
  { label: '指定空间', value: 'organization' },
  { label: '指定用户', value: 'users' },
];

export function getScopeOptions(isTenantMode: boolean) {
  return isTenantMode ? TENANT_SCOPE_OPTIONS : PLATFORM_SCOPE_OPTIONS;
}

export function getDefaultScope(isTenantMode: boolean): DispatchScope {
  return isTenantMode ? 'organization' : 'platform';
}

export function needsTargetSelection(
  scope: DispatchScope,
  isTenantMode: boolean,
) {
  return (
    scope === 'teams' ||
    scope === 'users' ||
    (scope === 'organization' && !isTenantMode)
  );
}

export function resolveEditorInitialValues({
  isTenantMode,
  source,
}: {
  isTenantMode: boolean;
  source?: DispatchSource;
}): CreateDispatchFormValues {
  const defaultScope = getDefaultScope(isTenantMode);
  const requestedScope = source?.scope || defaultScope;
  const scope = getScopeOptions(isTenantMode).some(
    (option) => option.value === requestedScope,
  )
    ? requestedScope
    : defaultScope;
  const targets =
    scope === 'platform' || (scope === 'organization' && isTenantMode)
      ? []
      : Array.from(new Set(source?.scope_ids || [])).map((id) => ({
          value: id,
          label: `ID ${id}`,
        }));

  return {
    scope,
    targets,
    category: source?.category || '',
    title: source?.title || '',
    body: source?.body || '',
    url: source?.url || '',
  };
}

export function getRecipientSummary({
  scope,
  isTenantMode,
  organizationName,
}: {
  scope: DispatchScope;
  isTenantMode: boolean;
  organizationName?: string;
}): RecipientSummary {
  if (scope === 'organization' && isTenantMode) {
    return {
      hint: `将发送给「${organizationName || '当前空间'}」的全部成员`,
      status: '准备发送给当前空间全部成员',
      needsTargetSelection: false,
    };
  }
  if (scope === 'platform') {
    return {
      hint: '将发送给所有空间的用户',
      needsTargetSelection: false,
    };
  }
  return {
    hint: '选择要接收通知的目标',
    needsTargetSelection: needsTargetSelection(scope, isTenantMode),
  };
}

export function uniquePositiveIds(values: CreateDispatchFormValues['targets']) {
  return Array.from(
    new Set(
      (values || [])
        .map((item) => Number(item.value))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    ),
  );
}

export function isSupportedDispatchUrl(value?: string) {
  if (!value?.trim()) return true;
  const normalized = value.trim();
  const normalizedLower = normalized.toLowerCase();
  const isInternalPath =
    normalized.startsWith('/') &&
    !normalized.startsWith('//') &&
    !normalized.startsWith('/\\');
  return (
    isInternalPath ||
    normalizedLower.startsWith('https://') ||
    normalizedLower.startsWith('http://')
  );
}
