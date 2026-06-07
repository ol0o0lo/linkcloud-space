<script setup lang="ts">
import { ref, watch } from 'vue';

import { useRoute, useRouter } from 'vue-router';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import ProfileBase from './base-setting.vue';
import ProfileNotificationSetting from './notification-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSecuritySetting from './security-setting.vue';

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

const validTabs = new Set(['basic', 'security', 'password', 'notice']);

function normalizeTab(value: unknown) {
  return typeof value === 'string' && validTabs.has(value) ? value : 'basic';
}

const tabsValue = ref<string>(normalizeTab(route.query.tab));

const tabs = ref([
  {
    label: '基本设置',
    value: 'basic',
  },
  {
    label: '安全设置',
    value: 'security',
  },
  {
    label: '修改密码',
    value: 'password',
  },
  {
    label: '新消息提醒',
    value: 'notice',
  },
]);

watch(
  () => route.query.tab,
  (value) => {
    const nextTab = normalizeTab(value);
    if (nextTab !== tabsValue.value) {
      tabsValue.value = nextTab;
    }
  },
);

watch(tabsValue, async (value) => {
  const current = normalizeTab(route.query.tab);
  if (current === value) return;

  const nextQuery = { ...route.query };
  if (value === 'basic') {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = value;
  }

  await router.replace({ query: nextQuery });
});
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    title="个人中心"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfileSecuritySetting v-if="tabsValue === 'security'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
      <ProfileNotificationSetting v-if="tabsValue === 'notice'" />
    </template>
  </Profile>
</template>
