import { theme } from 'antd';
import { useSyncExternalStore } from 'react';
import {
  type AppStatusName,
  useResolvedAppStatus,
} from '@/components/AppStatus/registry';
import { Icon, type IconProps } from '@/components/Icon';
import { SEMANTIC_TONE_TOKEN } from '@/components/SemanticTone';

export type AppIconifyName = `${'solar' | 'tabler'}:${string}`;

export type AppIconDefinition = {
  icon: AppIconifyName;
};

export type AppIconDefinitions = Record<string, AppIconDefinition>;

/**
 * 项目内置的语义图标名称。这里只维护图标，不维护业务状态、颜色或说明。
 * 插件通过 registerAppIconDefinitions() 扩展，不应直接修改此对象注入配置。
 */
export const APP_ICON_DEFINITIONS = {
  unknown: {
    icon: 'solar:question-circle-outline',
  },
  estate: {
    icon: 'solar:city-outline',
  },
  building: {
    icon: 'solar:buildings-outline',
  },
  house: {
    icon: 'solar:home-2-outline',
  },
  'house.placeholder': {
    icon: 'solar:bed-outline',
  },
  'house.vacant': { icon: 'tabler:home-exclamation' },
  'house.listed': { icon: 'tabler:home-dollar' },
  'house.rented': { icon: 'tabler:home-check' },
  'house.renovating': { icon: 'tabler:home-cog' },
  'house.inactive': { icon: 'tabler:home-off' },
  room: {
    icon: 'solar:bed-line-duotone',
  },
  location: {
    icon: 'solar:map-point-line-duotone',
  },
  lease: {
    icon: 'solar:document-text-line-duotone',
  },
  'lease.pending': { icon: 'solar:clock-circle-outline' },
  'lease.active': { icon: 'solar:verified-check-outline' },
  'lease.expired': { icon: 'solar:calendar-mark-outline' },
  'lease.terminated': { icon: 'solar:close-circle-outline' },
  viewing: {
    icon: 'solar:calendar-search-outline',
  },
  'viewing.scheduled': { icon: 'solar:calendar-search-outline' },
  'viewing.viewed': { icon: 'solar:eye-outline' },
  'viewing.converted': { icon: 'solar:clipboard-check-outline' },
  'viewing.canceled': { icon: 'solar:close-circle-outline' },
  'viewing.no_show': { icon: 'solar:user-cross-rounded-outline' },
  'viewing.signed': { icon: 'solar:document-text-outline' },
  'viewing.unsigned': { icon: 'solar:document-text-outline' },
  contact: {
    icon: 'solar:users-group-rounded-line-duotone',
  },
  organization: {
    icon: 'solar:buildings-3-outline',
  },
  team: {
    icon: 'solar:users-group-rounded-outline',
  },
  member: {
    icon: 'solar:user-rounded-outline',
  },
  'organization-invite': {
    icon: 'solar:letter-outline',
  },
  'organization-invite.pending': {
    icon: 'solar:clock-circle-outline',
  },
  'organization-invite.stale': {
    icon: 'solar:danger-triangle-outline',
  },
  'organization-invite.expired': {
    icon: 'solar:close-circle-outline',
  },
  key: {
    icon: 'solar:key-line-duotone',
  },
  elevator: {
    icon: 'tabler:elevator',
  },
  stairs: {
    icon: 'tabler:stairs',
  },
} as const satisfies AppIconDefinitions;

/** 兼容只需要读取对象默认图标名称的场景。 */
export const APP_ICON_NAMES = {
  unknown: APP_ICON_DEFINITIONS.unknown.icon,
  estate: APP_ICON_DEFINITIONS.estate.icon,
  building: APP_ICON_DEFINITIONS.building.icon,
  house: APP_ICON_DEFINITIONS.house.icon,
  housePlaceholder: APP_ICON_DEFINITIONS['house.placeholder'].icon,
  room: APP_ICON_DEFINITIONS.room.icon,
  location: APP_ICON_DEFINITIONS.location.icon,
  lease: APP_ICON_DEFINITIONS.lease.icon,
  viewing: APP_ICON_DEFINITIONS.viewing.icon,
  contact: APP_ICON_DEFINITIONS.contact.icon,
  organization: APP_ICON_DEFINITIONS.organization.icon,
  team: APP_ICON_DEFINITIONS.team.icon,
  member: APP_ICON_DEFINITIONS.member.icon,
  organizationInvite: APP_ICON_DEFINITIONS['organization-invite'].icon,
  key: APP_ICON_DEFINITIONS.key.icon,
  elevator: APP_ICON_DEFINITIONS.elevator.icon,
  stairs: APP_ICON_DEFINITIONS.stairs.icon,
} as const;

export type CoreAppIconName = keyof typeof APP_ICON_DEFINITIONS;
export type AppIconName = CoreAppIconName | (string & {});

type RegistryEntry = {
  definition: AppIconDefinition;
  registration: symbol;
  source: string;
};

const coreRegistration = Symbol('core-app-icons');
const registry = new Map<string, RegistryEntry>(
  Object.entries(APP_ICON_DEFINITIONS).map(([name, definition]) => [
    name,
    { definition, registration: coreRegistration, source: 'core' },
  ]),
);
const listeners = new Set<() => void>();
let registryVersion = 0;

function emitRegistryChange() {
  registryVersion += 1;
  for (const listener of listeners) listener();
}

function subscribeRegistry(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getRegistryVersion() {
  return registryVersion;
}

/** 保留插件定义中的字面量名称，便于插件侧获得类型提示。 */
export function defineAppIconDefinitions<const T extends AppIconDefinitions>(
  definitions: T,
) {
  return definitions;
}

/**
 * 注册一个业务插件的对象图标。source 必须稳定且唯一；不同插件不能覆盖同名对象。
 * 返回的函数用于插件卸载或测试清理。
 */
export function registerAppIconDefinitions<const T extends AppIconDefinitions>(
  source: string,
  definitions: T,
) {
  const normalizedSource = source.trim();
  if (!normalizedSource || normalizedSource === 'core') {
    throw new Error('AppIcon 插件 source 必须是非空且非 core 的唯一名称');
  }

  for (const name of Object.keys(definitions)) {
    const existing = registry.get(name);
    if (existing && existing.source !== normalizedSource) {
      throw new Error(
        `AppIcon 名称 ${name} 已由 ${existing.source} 注册，${normalizedSource} 不能覆盖`,
      );
    }
  }

  for (const [name, entry] of registry) {
    if (entry.source === normalizedSource) registry.delete(name);
  }

  const registration = Symbol(normalizedSource);
  for (const [name, definition] of Object.entries(definitions)) {
    registry.set(name, {
      definition,
      registration,
      source: normalizedSource,
    });
  }
  emitRegistryChange();

  return () => {
    let changed = false;
    for (const [name, entry] of registry) {
      if (entry.registration === registration) {
        registry.delete(name);
        changed = true;
      }
    }
    if (changed) emitRegistryChange();
  };
}

export type ResolvedAppIcon = AppIconDefinition & {
  matched: boolean;
  source: string;
};

export function resolveAppIconDefinition(name: AppIconName): ResolvedAppIcon {
  const matchedEntry = registry.get(name);
  const entry = matchedEntry ?? registry.get('unknown');
  if (!entry) {
    throw new Error('AppIcon 缺少 unknown 兜底定义');
  }
  return {
    icon: entry.definition.icon,
    matched: Boolean(matchedEntry),
    source: entry.source,
  };
}

type ObjectAppIconProps = Omit<IconProps, 'icon'> & {
  name: AppIconName;
  contrast?: never;
  state?: never;
};

type StatusAppIconProps = Omit<IconProps, 'color' | 'icon'> & {
  contrast?: 'light';
  name: AppStatusName;
  state: string;
};

export type AppIconProps = ObjectAppIconProps | StatusAppIconProps;

export function AppIcon({
  name,
  state,
  contrast,
  style,
  ...props
}: AppIconProps) {
  useSyncExternalStore(
    subscribeRegistry,
    getRegistryVersion,
    getRegistryVersion,
  );
  const statusDefinition = useResolvedAppStatus(
    name as AppStatusName,
    state ?? '',
  );
  const isStatusIcon = state !== undefined;
  const iconName = isStatusIcon ? statusDefinition.icon : name;
  const definition = resolveAppIconDefinition(iconName);
  const { token } = theme.useToken();
  const color = isStatusIcon
    ? contrast === 'light'
      ? token.colorTextLightSolid
      : token[SEMANTIC_TONE_TOKEN[statusDefinition.tone]]
    : undefined;

  return (
    <Icon
      {...props}
      data-app-icon-name={iconName}
      data-app-icon-source={definition.source}
      data-app-status-name={isStatusIcon ? name : undefined}
      data-app-status-source={
        isStatusIcon ? statusDefinition.source : undefined
      }
      data-app-status-state={isStatusIcon ? state : undefined}
      data-app-status-tone={isStatusIcon ? statusDefinition.tone : undefined}
      icon={definition.icon}
      style={color ? { ...style, color } : style}
    />
  );
}
