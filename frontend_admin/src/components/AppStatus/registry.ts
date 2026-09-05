import { useSyncExternalStore } from 'react';
import type { AppIconName } from '@/components/AppIcon';
import type { SemanticTone } from '@/components/SemanticTone';

export type AppStatusStateDefinition = {
  description?: string;
  icon: AppIconName;
  tone: SemanticTone;
};

export type AppStatusDefinition = {
  states: Record<string, AppStatusStateDefinition>;
};

export type AppStatusDefinitions = Record<string, AppStatusDefinition>;

/** 业务状态只引用已注册的语义图标名，不直接包含 Iconify 名称。 */
export const APP_STATUS_DEFINITIONS = {
  house: {
    states: {
      vacant: {
        description: '收益中断：当前没有租约且尚未进入招租流程，需优先处理',
        icon: 'house.vacant',
        tone: 'error',
      },
      listed: {
        description: '正常经营：房源正在对外招租',
        icon: 'house.listed',
        tone: 'info',
      },
      rented: {
        description: '经营健康：房源已出租并处于有效占用',
        icon: 'house.rented',
        tone: 'success',
      },
      renovating: {
        description: '待跟进：房源暂不可出租，需关注装修进度',
        icon: 'house.renovating',
        tone: 'warning',
      },
      inactive: {
        description: '已退出日常管理和经营操作范围',
        icon: 'house.inactive',
        tone: 'disabled',
      },
    },
  },
  lease: {
    states: {
      pending: { icon: 'lease.pending', tone: 'warning' },
      active: { icon: 'lease.active', tone: 'success' },
      expired: { icon: 'lease.expired', tone: 'secondary' },
      terminated: { icon: 'lease.terminated', tone: 'error' },
    },
  },
  'allocation-request': {
    states: {
      pending: {
        description: '申请已提交，等待有审核权限的人员处理',
        icon: 'allocation-request.pending',
        tone: 'warning',
      },
      approved: {
        description: '审核已通过，收益已经计入受益人流水',
        icon: 'allocation-request.approved',
        tone: 'success',
      },
      rejected: {
        description: '审核不通过，不会生成收益流水',
        icon: 'allocation-request.rejected',
        tone: 'error',
      },
      expired: {
        description: '超过审核有效期，需要重新登记签约',
        icon: 'allocation-request.expired',
        tone: 'secondary',
      },
      voided: {
        description: '已生效申请被作废，系统已追加冲销流水',
        icon: 'allocation-request.voided',
        tone: 'secondary',
      },
    },
  },
  viewing: {
    states: {
      scheduled: { icon: 'viewing.scheduled', tone: 'info' },
      viewed: { icon: 'viewing.viewed', tone: 'default' },
      converted: { icon: 'viewing.converted', tone: 'success' },
      canceled: { icon: 'viewing.canceled', tone: 'error' },
      no_show: { icon: 'viewing.no_show', tone: 'error' },
      signed: { icon: 'viewing.signed', tone: 'success' },
      unsigned: { icon: 'viewing.unsigned', tone: 'secondary' },
    },
  },
  'organization-invite': {
    states: {
      pending: {
        description: '邀请已发送，等待对方加入组织',
        icon: 'organization-invite.pending',
        tone: 'info',
      },
      stale: {
        description: '邀请已等待较长时间，可以联系对方或重新发送',
        icon: 'organization-invite.stale',
        tone: 'warning',
      },
      expired: {
        description: '邀请已超过有效期，需要重新发送后才能继续',
        icon: 'organization-invite.expired',
        tone: 'error',
      },
    },
  },
  'landlord-binding': {
    states: {
      unbound: {
        description: '尚未邀请房东绑定平台账号',
        icon: 'contact',
        tone: 'secondary',
      },
      invited: {
        description: '邀请已发送，等待房东接受',
        icon: 'organization-invite.pending',
        tone: 'info',
      },
      bound: {
        description: '房东已接受邀请并绑定平台账号',
        icon: 'member',
        tone: 'success',
      },
    },
  },
  'wallet.withdrawal': {
    states: {
      pending_review: {
        icon: 'wallet.withdrawal.pending_review',
        tone: 'warning',
      },
      approved: {
        icon: 'wallet.withdrawal.approved',
        tone: 'info',
      },
      paying: {
        icon: 'wallet.withdrawal.paying',
        tone: 'info',
      },
      failed: {
        icon: 'wallet.withdrawal.failed',
        tone: 'error',
      },
      rejected: {
        icon: 'wallet.withdrawal.rejected',
        tone: 'secondary',
      },
      cancelled: {
        icon: 'wallet.withdrawal.cancelled',
        tone: 'secondary',
      },
      paid: {
        icon: 'wallet.withdrawal.paid',
        tone: 'success',
      },
    },
  },
} as const satisfies AppStatusDefinitions;

export type CoreAppStatusName = keyof typeof APP_STATUS_DEFINITIONS;
export type AppStatusName = CoreAppStatusName | (string & {});

type RegistryEntry = {
  definition: AppStatusDefinition;
  registration: symbol;
  source: string;
};

const coreRegistration = Symbol('core-app-statuses');
const registry = new Map<string, RegistryEntry>(
  Object.entries(APP_STATUS_DEFINITIONS).map(([name, definition]) => [
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

export function defineAppStatusDefinitions<
  const T extends AppStatusDefinitions,
>(definitions: T) {
  return definitions;
}

/** 注册插件状态；状态图标必须先通过 AppIcon 注册。 */
export function registerAppStatusDefinitions<
  const T extends AppStatusDefinitions,
>(source: string, definitions: T) {
  const normalizedSource = source.trim();
  if (!normalizedSource || normalizedSource === 'core') {
    throw new Error('AppStatus 插件 source 必须是非空且非 core 的唯一名称');
  }

  for (const name of Object.keys(definitions)) {
    const existing = registry.get(name);
    if (existing && existing.source !== normalizedSource) {
      throw new Error(
        `AppStatus 名称 ${name} 已由 ${existing.source} 注册，${normalizedSource} 不能覆盖`,
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

export type ResolvedAppStatus = AppStatusStateDefinition & {
  matched: boolean;
  source: string;
};

export function resolveAppStatusDefinition(
  name: AppStatusName,
  state: string,
): ResolvedAppStatus {
  const entry = registry.get(name);
  const stateDefinition = entry?.definition.states[state];
  if (stateDefinition) {
    return {
      ...stateDefinition,
      matched: true,
      source: entry.source,
    };
  }

  return {
    icon: name,
    matched: false,
    source: entry?.source ?? 'fallback',
    tone: 'default',
  };
}

export function useResolvedAppStatus(name: AppStatusName, state: string) {
  useSyncExternalStore(
    subscribeRegistry,
    getRegistryVersion,
    getRegistryVersion,
  );
  return resolveAppStatusDefinition(name, state);
}
