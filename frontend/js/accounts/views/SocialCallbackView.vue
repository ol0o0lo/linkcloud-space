<script setup>
import { inject, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeNextUrl } from '../../utils/redirect';
import { authFlowsFromResult, socialCallbackTarget } from '../sessionFlows';

const route = useRoute();
const router = useRouter();
const appStore = inject('appStore');

onMounted(async () => {
  await appStore.fetchContext();

  let sessionResult;

  try {
    const { authApi } = await import('../api');
    sessionResult = await authApi.getSession();
  } catch (err) {
    sessionResult = err;
  }

  const target = socialCallbackTarget({
    authenticated: appStore.isAuthenticated,
    query: route.query,
    flows: authFlowsFromResult(sessionResult),
  });

  if (typeof target === 'string') {
    router.replace(safeNextUrl(target));
  } else {
    router.replace(target);
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Completing sign in…
    </p>
  </div>
</template>
