<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { SvgGithubIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import { Button, Divider, Tooltip, notification } from 'antdv-next';

import { redirectProviderLogin } from '#/api/django/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const githubLoading = ref(false);
const weixinLoading = ref(false);

function getRedirectPath() {
  const redirect = route.query.redirect;
  const path =
    typeof redirect === 'string' && redirect.startsWith('/')
      ? decodeURIComponent(redirect)
      : '/dashboard/overview';
  return `${window.location.origin}${path}`;
}

function handleCodeLogin() {
  void router.push({
    path: '/auth/code-login',
    query: route.query,
  });
}

async function handleProviderLogin(provider: 'github' | 'weixin') {
  const target = provider === 'github' ? githubLoading : weixinLoading;
  try {
    target.value = true;
    await redirectProviderLogin(provider, getRedirectPath());
  } catch (error: any) {
    notification.error({
      description: error?.message || `${provider} 登录失败`,
      title: '登录失败',
    });
    target.value = false;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入邮箱',
      },
      fieldName: 'username',
      label: '邮箱',
      rules: z.string().min(1, { message: '请输入邮箱' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
  :loading="authStore.loginLoading"
  :show-code-login="false"
  :show-forget-password="false"
  :show-qrcode-login="false"
  :show-register="true"
  :show-third-party-login="false"
  @submit="authStore.authLogin"
>
    <template #to-register>
      <div class="mt-3 text-center text-sm">
        还没有账号？
        <span class="vben-link text-sm font-normal" @click="router.push({ path: '/auth/register', query: route.query })">注册</span>
      </div>
    </template>
    <template #third-party-login>
      <div class="mt-4 flex gap-4">
        <Button
          block
          class="h-12"
          @click="handleCodeLogin"
        >
          手机号登录
        </Button>
        <Button
          block
          class="h-12"
          :loading="weixinLoading"
          @click="handleProviderLogin('weixin')"
        >
          扫码登录
        </Button>
      </div>

      <div class="mt-6">
        <Divider plain>其他登录方式</Divider>
        <div class="mt-4 flex justify-center">
          <Tooltip title="GitHub 登录">
            <button
              class="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-900"
              :disabled="githubLoading"
              type="button"
              @click="handleProviderLogin('github')"
            >
              <SvgGithubIcon class="text-lg" />
            </button>
          </Tooltip>
        </div>
      </div>
    </template>
  </AuthenticationLogin>
</template>
