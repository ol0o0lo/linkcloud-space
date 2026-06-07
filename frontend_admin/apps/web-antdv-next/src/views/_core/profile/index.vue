<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

import { Alert } from 'antdv-next';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { getSocialAccountsApi, listAuthenticatorsApi } from '#/api/django/auth';
import {
  getCurrentUserApi,
  listNotificationPreferencesApi,
  type NotificationPreferenceRow,
  type UserRow,
} from '#/api/django/resources';

import ProfileBase from './base-setting.vue';
import ProfileNotificationSetting from './notification-setting.vue';
import ProfileOverview from './overview.vue';
import { buildProfileHero, buildProfileStatusCards, type ProfileSectionKey } from './profile-dashboard';
import ProfileSecuritySetting from './security-setting.vue';

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

const activeEditSection = ref<null | ProfileSectionKey>(null);
const summaryLoading = ref(false);
const summaryError = ref('');
const profile = ref<null | UserRow>(null);
const authenticators = ref<any[]>([]);
const socialAccounts = ref<any[]>([]);
const notificationPreferences = ref<NotificationPreferenceRow[]>([]);

const sectionIds: Record<ProfileSectionKey, string> = {
  basic: 'profile-section-basic',
  notification: 'profile-section-notification',
  security: 'profile-section-security',
  password: 'profile-section-security',
};

function unwrapAllauthData<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

function normalizeSection(value: unknown): ProfileSectionKey {
  if (value === 'notice' || value === 'notification') return 'notification';
  if (value === 'security') return 'security';
  if (value === 'password') return 'security';
  return 'basic';
}

async function updateRouteTab(section: ProfileSectionKey) {
  const nextQuery = { ...route.query };
  if (section === 'basic') {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = section;
  }
  await router.replace({ query: nextQuery });

}

async function loadDashboardSummary() {
  summaryLoading.value = true;
  summaryError.value = '';
  try {
    const [profileData, authenticatorsResponse, socialResponse, notificationData] = await Promise.all([
      getCurrentUserApi(),
      listAuthenticatorsApi().catch(() => ({ data: [] })),
      getSocialAccountsApi().catch(() => ({ data: [] })),
      listNotificationPreferencesApi().catch(() => []),
    ]);

    profile.value = profileData;
    authenticators.value = unwrapAllauthData<any[]>(authenticatorsResponse) || [];
    socialAccounts.value = unwrapAllauthData<any[]>(socialResponse) || [];
    notificationPreferences.value = notificationData;
  } catch {
    summaryError.value = '个人中心摘要加载失败，请稍后重试。';
  } finally {
    summaryLoading.value = false;
  }
}

const hero = computed(() => buildProfileHero(profile.value, userStore.userInfo, String(userStore.userInfo?.desc || '')));
const cards = computed(() => buildProfileStatusCards({
  authenticators: authenticators.value,
  notificationPreferences: notificationPreferences.value,
  socialAccounts: socialAccounts.value,
  user: profile.value,
}));

function handleSectionEdit(section: ProfileSectionKey, editing: boolean) {
  activeEditSection.value = editing
    ? section
    : activeEditSection.value === section
      ? null
      : activeEditSection.value;
}

async function openSection(section: ProfileSectionKey) {
  await updateRouteTab(section);
  await nextTick();
  document.getElementById(sectionIds[section])?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

onMounted(async () => {
  await loadDashboardSummary();
  const initialSection = normalizeSection(route.query.tab);
  if (initialSection !== 'basic') {
    await openSection(initialSection);
  }
});
</script>
<template>
  <Page auto-content-height content-class="overflow-x-hidden p-0">
    <div class="flex flex-col gap-6">
      <section id="profile-section-overview">
        <ProfileOverview :cards="cards" :hero="hero" :loading="summaryLoading" @open-section="openSection" />
      </section>

      <Alert v-if="summaryError" :message="summaryError" show-icon type="warning" />

      <section id="profile-section-basic">
        <ProfileBase
          :active-edit-section="activeEditSection"
          @edit-change="(editing) => handleSectionEdit('basic', editing)"
          @profile-updated="loadDashboardSummary"
        />
      </section>

      <section id="profile-section-security">
        <ProfileSecuritySetting
          :active-edit-section="activeEditSection"
          @edit-change="(editing) => handleSectionEdit('security', editing)"
          @status-change="loadDashboardSummary"
        />
      </section>

      <section id="profile-section-notification">
        <ProfileNotificationSetting
          :active-edit-section="activeEditSection"
          @edit-change="(editing) => handleSectionEdit('notification', editing)"
          @status-change="loadDashboardSummary"
        />
      </section>
    </div>
  </Page>
</template>
