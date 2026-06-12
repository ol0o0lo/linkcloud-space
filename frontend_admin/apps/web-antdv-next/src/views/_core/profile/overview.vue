<script setup lang="ts">
import { computed } from 'vue';

import { Avatar, Button } from 'antdv-next';

import type { UserRow } from '#/api/django/resources';

const props = defineProps<{
  avatarText: string;
  hasTotp: boolean;
  unreadCount: number;
  user: null | UserRow;
}>();

const emit = defineEmits<{
  openSection: [section: 'notifications' | 'password' | 'security'];
}>();

const displayName = computed(() => {
  const current = props.user;
  if (!current) return '当前用户';
  const mergedName = [current.first_name, current.last_name].filter(Boolean).join('');
  return mergedName || current.username || current.email || '当前用户';
});

const primaryBadge = computed(() => {
  const status = props.user?.real_name_status;
  if (status === 'verified') return '已认证';
  if (status === 'pending') return '审核中';
  return '未认证';
});

const profileCompletion = computed(() => {
  const checks = [props.user?.avatar_url, displayName.value, props.user?.email, props.user?.phone, props.user?.timezone].filter(Boolean);
  return `${checks.length}/5`;
});

const summaryCards = computed(() => [
  { label: '资料完整度', value: profileCompletion.value },
  { label: '手机号状态', value: props.user?.phone_verified ? '已验证' : '待验证' },
  { label: '双重验证', value: props.hasTotp ? '已启用' : '未启用' },
  { label: '未读通知', value: `${props.unreadCount} 条` },
]);

const entryCards: Array<{ action: 'notifications' | 'password' | 'security'; cta: string; description: string; title: string }> = [
  {
    action: 'security',
    cta: '进入安全设置',
    description: '集中管理双重验证、Passkey 和第三方账号绑定。',
    title: '账户安全入口',
  },
  {
    action: 'password',
    cta: '进入密码页',
    description: '修改登录密码时再进入表单，平时保持概览态。',
    title: '修改密码入口',
  },
  {
    action: 'notifications',
    cta: '进入通知设置',
    description: '单独维护站内信和邮件提醒，不再和资料编辑混排。',
    title: '通知设置入口',
  },
];
</script>

<template>
  <section class="overflow-hidden rounded-[32px] border border-white/75 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
    <div class="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(191,219,254,0.55),_transparent_26%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-6 py-6 lg:px-8 lg:py-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex items-start gap-4 sm:gap-5">
          <Avatar :size="84" :src="user?.avatar_url || undefined" class="shrink-0 border-4 border-white bg-slate-900 text-2xl font-semibold text-white shadow-sm">
            {{ avatarText }}
          </Avatar>

          <div class="min-w-0">
            <div class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">账户总览</div>
            <div class="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{{ displayName }}</div>
            <div class="mt-2 text-sm text-slate-500">{{ user?.email || '未设置邮箱' }}</div>
            <div class="mt-4 flex flex-wrap gap-2">
              <span
                class="rounded-full px-3 py-1 text-sm font-semibold"
                :class="primaryBadge === '已认证' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
              >
                {{ primaryBadge }}
              </span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{{ user?.phone_verified ? '已绑定手机' : '手机号待验证' }}</span>
            </div>
            <div class="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              这里现在只保留资料总览和清晰的二级入口，先看，再决定是否进入安全、密码或提醒设置。
            </div>
          </div>
        </div>

        <div class="w-full rounded-[24px] border border-slate-200/80 bg-white/90 p-5 lg:max-w-64">
          <div class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">当前状态</div>
          <div class="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{{ profileCompletion }}</div>
          <div class="mt-2 text-sm leading-6 text-slate-500">
            {{ hasTotp ? '账号安全保护已开启。' : '建议下一步先补齐双重验证。' }}
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="item in summaryCards"
          :key="item.label"
          class="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4"
        >
          <div class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</div>
          <div class="mt-2 text-base font-semibold text-slate-900">{{ item.value }}</div>
        </div>
      </div>
    </div>

    <div class="px-6 py-6 lg:px-8 lg:py-8">
      <div class="mb-4">
        <div class="text-lg font-semibold text-slate-900">相关设置</div>
        <div class="mt-1 text-sm text-slate-500">需要时再进入专项页面，避免一进来就落在编辑态。</div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <section
          v-for="item in entryCards"
          :key="item.action"
          class="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-5"
        >
          <div class="text-base font-semibold text-slate-900">{{ item.title }}</div>
          <div class="mt-2 text-sm leading-6 text-slate-500">{{ item.description }}</div>
          <Button class="mt-5 w-full" type="primary" @click="emit('openSection', item.action)">
            {{ item.cta }}
          </Button>
        </section>
      </div>
    </div>
  </section>
</template>
