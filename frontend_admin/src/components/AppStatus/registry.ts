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
        description: '当前为空置状态，尚未进入招租流程',
        icon: 'house.vacant',
        tone: 'error',
      },
      listed: {
        description: '当前正在对外招租',
        icon: 'house.listed',
        tone: 'info',
      },
      rented: {
        description: '当前已有生效租约',
        icon: 'house.rented',
        tone: 'success',
      },
      renovating: {
        description: '当前处于装修状态，暂不可出租',
        icon: 'house.renovating',
        tone: 'warning',
      },
      inactive: {
        description: '当前已停用，不参与日常经营',
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
  'invoice-request': {
    states: {
      pending: {
        description: '开票申请已提交，等待平台处理',
        icon: 'invoice-request.pending',
        tone: 'warning',
      },
      processing: {
        description: '平台正在处理开票申请',
        icon: 'invoice-request.processing',
        tone: 'info',
      },
      issued: {
        description: '发票已开具，可查看或下载发票文件',
        icon: 'invoice-request.issued',
        tone: 'success',
      },
      rejected: {
        description: '开票申请未通过，请查看平台备注',
        icon: 'invoice-request.rejected',
        tone: 'error',
      },
      cancelled: {
        description: '开票申请已取消',
        icon: 'invoice-request.cancelled',
        tone: 'secondary',
      },
    },
  },
  'subscription.order': {
    states: {
      pending_payment: {
        description: '订单已创建，等待用户完成支付',
        icon: 'subscription.order.pending_payment',
        tone: 'warning',
      },
      paid: {
        description: '订单已支付，套餐权益已经生效',
        icon: 'subscription.order.paid',
        tone: 'success',
      },
      closed: {
        description: '订单已关闭，无法继续支付',
        icon: 'subscription.order.closed',
        tone: 'error',
      },
      payment_failed: {
        description: '订单支付失败，需要重新发起购买',
        icon: 'subscription.order.payment_failed',
        tone: 'error',
      },
    },
  },
  'subscription.sales-lead': {
    states: {
      new: {
        description: '客户刚提交企业版需求，等待首次联系',
        icon: 'subscription.order.pending_payment',
        tone: 'warning',
      },
      contacting: {
        description: '销售顾问正在与客户沟通需求',
        icon: 'subscription.payment.pending',
        tone: 'info',
      },
      qualified: {
        description: '需求和预算已确认，可推进方案与报价',
        icon: 'subscription.payment.succeeded',
        tone: 'success',
      },
      won: {
        description: '企业版线索已经成交',
        icon: 'subscription.order.paid',
        tone: 'success',
      },
      lost: {
        description: '当前线索已结束跟进',
        icon: 'subscription.order.closed',
        tone: 'secondary',
      },
    },
  },
  'subscription.payment': {
    states: {
      pending: {
        description: '支付渠道等待用户付款',
        icon: 'subscription.payment.pending',
        tone: 'warning',
      },
      succeeded: {
        description: '支付渠道已确认收款',
        icon: 'subscription.payment.succeeded',
        tone: 'success',
      },
      failed: {
        description: '支付渠道处理失败',
        icon: 'subscription.payment.failed',
        tone: 'error',
      },
      exception: {
        description: '支付结果与订单状态不一致，需要人工核查',
        icon: 'subscription.payment.exception',
        tone: 'error',
      },
    },
  },
  'subscription.refund': {
    states: {
      none: {
        description: '订单尚未登记退款',
        icon: 'subscription.refund.none',
        tone: 'secondary',
      },
      partial: {
        description: '订单已登记部分退款',
        icon: 'subscription.refund.partial',
        tone: 'warning',
      },
      full: {
        description: '订单已登记全额退款',
        icon: 'subscription.refund.full',
        tone: 'error',
      },
    },
  },
  'referral.record': {
    states: {
      registered: {
        description: '被邀请人已完成注册',
        icon: 'referral.record.registered',
        tone: 'info',
      },
      pending_review: {
        description: '奖励条件已满足，等待人工审核',
        icon: 'referral.record.pending_review',
        tone: 'warning',
      },
      review_rejected: {
        description: '奖励审核未通过',
        icon: 'referral.record.review_rejected',
        tone: 'error',
      },
      reward_issued: {
        description: '奖励已经发放至钱包',
        icon: 'referral.record.reward_issued',
        tone: 'success',
      },
    },
  },
  'miniprogram-home.item': {
    states: {
      disabled: {
        description: '当前内容未启用，不会在小程序首页展示',
        icon: 'miniprogram-home.item.disabled',
        tone: 'disabled',
      },
      scheduled: {
        description: '内容已启用，将在设定的开始时间自动展示',
        icon: 'miniprogram-home.item.scheduled',
        tone: 'warning',
      },
      active: {
        description: '内容当前正在小程序首页展示',
        icon: 'miniprogram-home.item.active',
        tone: 'success',
      },
      expired: {
        description: '内容已超过结束时间，不再展示',
        icon: 'miniprogram-home.item.expired',
        tone: 'secondary',
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
