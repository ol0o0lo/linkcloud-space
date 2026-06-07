<script setup lang="ts">
import { onMounted } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import { useRoute, useRouter } from 'vue-router';

import { getAccessCodesApi, getUserInfoApi } from '#/api';

const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const userStore = useUserStore();

function resolveTarget() {
  const next = route.query.next;
  return typeof next === 'string' && next ? decodeURIComponent(next) : '/profile?tab=security';
}

onMounted(async () => {
  try {
    accessStore.setAccessToken('session');
    const [userInfo, accessCodes] = await Promise.all([
      getUserInfoApi(),
      getAccessCodesApi(),
    ]);
    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);
    accessStore.setIsAccessChecked(false);
    await router.replace(resolveTarget());
  } catch {
    accessStore.setAccessToken(null);
    await router.replace('/auth/login');
  }
});
</script>

<template>
  <div class="flex min-h-[50vh] items-center justify-center">
    <div class="text-sm text-zinc-500 dark:text-zinc-400">正在完成 GitHub 绑定，请稍候...</div>
  </div>
</template>
