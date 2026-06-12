<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { Button, notification } from 'antdv-next';

import { resendLoginCodeApi, verifyPhoneApi } from '#/api/django/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'VerifyPhone' });

const authStore = useAuthStore();
const loading = ref(false);
const resendLoading = ref(false);
const route = useRoute();
const router = useRouter();

const phone = computed(() => {
  return typeof route.query.phone === 'string' ? route.query.phone : '';
});

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: 4,
        placeholder: '验证码',
      },
      fieldName: 'code',
      label: '验证码',
      rules: z.string().length(4, { message: '请输入 4 位验证码' }),
    },
  ];
});

function getRedirectPath() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return decodeURIComponent(redirect);
  }
  return '/dashboard/overview';
}

async function handleVerify(values: Recordable<any>) {
  try {
    loading.value = true;
    await verifyPhoneApi(values.code);
    await authStore.finalizeAuthenticatedSession(async () => {
      await router.push(getRedirectPath());
    });
  } catch (error: any) {
    notification.error({
      title: '验证失败',
      description: error?.message || '请稍后重试。',
    });
  } finally {
    loading.value = false;
  }
}

async function handleResend() {
  try {
    resendLoading.value = true;
    await resendLoginCodeApi();
    notification.success({
      title: '发送成功',
      description: '验证码已重新发送，请注意查收。',
    });
  } catch (error: any) {
    notification.error({
      title: '发送失败',
      description: error?.message || '请稍后重试。',
    });
  } finally {
    resendLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <AuthenticationCodeLogin :form-schema="formSchema" :loading="loading" submit-button-text="确认验证" @submit="handleVerify">
      <template #subTitle>
        <div class="space-y-2 text-center text-sm text-zinc-500">
          <p>请输入发送到当前注册手机号的验证码。</p>
          <p v-if="phone" class="font-medium text-zinc-700">当前手机号：{{ phone }}</p>
        </div>
      </template>
    </AuthenticationCodeLogin>

    <Button block class="h-11" :loading="resendLoading" @click="handleResend">重新发送验证码</Button>
  </div>
</template>
