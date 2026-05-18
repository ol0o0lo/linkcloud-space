<script setup>
import { inject, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeNextUrl } from '../../utils/redirect';

const route = useRoute();
const router = useRouter();
const appStore = inject('appStore');

onMounted(async () => {
  await appStore.fetchContext();

  if (appStore.isAuthenticated) {
    // 登录完成，跳首页
    router.replace(safeNextUrl(route.query.next));
    return;
  }

  // 检查是否有 pending 的 verify_phone stage
  try {
    const { authApi } = await import('../api');
    const resp = await authApi.getSession();
    const flows = resp?.data?.flows || [];
    const phoneStage = flows.find((f) => f.id === 'verify_phone' && f.is_pending);
    if (phoneStage) {
      router.replace({ name: 'verify-phone', query: { next: route.query.next } });
      return;
    }
  } catch {
    // ignore
  }

  // 未登录也没有 pending stage，回到登录页
  router.replace({ name: 'login' });
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Completing sign in…
    </p>
  </div>
</template>
