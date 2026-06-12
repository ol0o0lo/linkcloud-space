<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Spin } from 'antdv-next';
import { useRoute, useRouter } from 'vue-router';

import { listAuthenticatorsApi, type AuthenticatorRow } from '#/api/django/auth';
import { getCurrentUserApi, getUnreadCountApi, type UserRow } from '#/api/django/resources';

import ProfileBase from './base-setting.vue';
import ProfileOverview from './overview.vue';

type ProfileSecondaryPage = 'notifications' | 'password' | 'security';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const unreadCount = ref(0);
const hasTotp = ref(false);
const user = ref<null | UserRow>(null);

const displayName = computed(() => {
  const current = user.value;
  if (!current) return '当前用户';
  const mergedName = [current.first_name, current.last_name].filter(Boolean).join('');
  return mergedName || current.username || current.email || '当前用户';
});

const avatarText = computed(() => displayName.value.trim().slice(0, 1).toUpperCase() || 'U');

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
}

function resolveLegacyTarget() {
  const value = (getQueryValue(route.query.section) || getQueryValue(route.query.tab)).toLowerCase();
  if (value === 'security') return '/profile/security';
  if (value === 'password') return '/profile/password';
  if (['notification', 'notifications', 'notice'].includes(value)) return '/profile/notifications';
  return '';
}

function redirectLegacyEntry() {
  const target = resolveLegacyTarget();
  if (!target) return false;
  const navigation = router.replace({ path: target, replace: true });
  navigation?.catch?.(() => undefined);
  return true;
}

async function loadData() {
  loading.value = true;
  try {
    const [profileResult, unreadResult, authenticatorsResult] = await Promise.allSettled([
      getCurrentUserApi(),
      getUnreadCountApi(),
      listAuthenticatorsApi(),
    ]);

    if (profileResult.status === 'fulfilled') {
      user.value = profileResult.value;
    }

    if (unreadResult.status === 'fulfilled') {
      unreadCount.value = unreadResult.value.count ?? 0;
    }

    if (authenticatorsResult.status === 'fulfilled') {
      const authenticators = ((authenticatorsResult.value as { data?: AuthenticatorRow[] })?.data ?? authenticatorsResult.value ?? []) as AuthenticatorRow[];
      hasTotp.value = authenticators.some((item) => item.type === 'totp');
    }
  } finally {
    loading.value = false;
  }
}

function openSection(section: ProfileSecondaryPage) {
  const navigation = router.push(`/profile/${section}`);
  navigation?.catch?.(() => undefined);
}

onMounted(async () => {
  if (redirectLegacyEntry()) return;
  await loadData();
});
</script>

<template>
  <Page auto-content-height content-class="overflow-x-hidden p-0" title="个人资料">
    <div class="min-h-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.82),_transparent_30%),linear-gradient(180deg,_#eef2f6_0%,_#e6ebf1_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto w-full max-w-5xl">
        <Spin :spinning="loading">
          <div class="space-y-6">
            <ProfileOverview
              :avatar-text="avatarText"
              :has-totp="hasTotp"
              :unread-count="unreadCount"
              :user="user"
              @open-section="openSection"
            />

            <section class="rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:p-8">
              <div class="mb-5">
                <div class="text-lg font-semibold text-slate-900">基础资料</div>
                <div class="mt-1 text-sm text-slate-500">从上往下集中维护头像、姓名、手机号和时区，编辑动作只在明确点击后展开。</div>
              </div>
              <ProfileBase @profile-updated="loadData" />
            </section>
          </div>
        </Spin>
      </div>
    </div>
  </Page>
</template>
