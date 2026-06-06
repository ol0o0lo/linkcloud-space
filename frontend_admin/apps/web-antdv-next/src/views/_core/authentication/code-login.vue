<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useAccessStore } from '@vben/stores';
import { notification } from 'antdv-next';

import {
  confirmLoginCodeApi,
  requestLoginCodeApi,
  resendLoginCodeApi,
} from '#/api/django/auth';
import { getAccessCodesApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'CodeLogin' });

const loading = ref(false);
const sendCodeLoading = ref(false);
const codeRequested = ref(false);
const authFormRef = ref<any>();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const CODE_LENGTH = 4;

function getRedirectPath() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return decodeURIComponent(redirect);
  }
  return '/dashboard/overview';
}

async function handleSendCode() {
  const formApi = authFormRef.value?.getFormApi?.();
  const values = await formApi?.getValues?.();
  const phone = values?.phoneNumber;

  if (!phone) {
    notification.warning({
      description: '请先输入手机号',
      title: '无法发送验证码',
    });
    throw new Error('phone required');
  }

  const result = await formApi?.validateField?.('phoneNumber');
  if (Object.keys(result?.errors ?? {}).length > 0) {
    throw new Error('invalid form');
  }

  try {
    sendCodeLoading.value = true;
    let resent = false;
    if (codeRequested.value) {
      await resendLoginCodeApi();
      resent = true;
    } else {
      await requestLoginCodeApi({ phone });
      codeRequested.value = true;
    }
    notification.success({
      description: resent
        ? '验证码已重新发送，请注意查收'
        : '验证码已发送，请注意查收',
      title: '发送成功',
    });
  } catch (error: any) {
    notification.error({
      description: error?.message || '验证码发送失败',
      title: '发送失败',
    });
    throw error;
  } finally {
    sendCodeLoading.value = false;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phoneNumber',
      label: '手机号',
      rules: z
        .string()
        .min(1, { message: '请输入手机号' })
        .refine((v) => /^(\+?\d{11,20})$/.test(v.replaceAll(/\s+/g, '')), {
          message: '请输入正确的手机号',
        }),
    },
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: CODE_LENGTH,
        createText: (countdown: number) => {
          const text =
            countdown > 0
              ? $t('authentication.sendText', [countdown])
              : $t('authentication.sendCode');
          return text;
        },
        handleSendCode,
        loading: sendCodeLoading.value,
        placeholder: '验证码',
      },
      fieldName: 'code',
      label: '验证码',
      rules: z.string().length(CODE_LENGTH, {
        message: $t('authentication.codeTip', [CODE_LENGTH]),
      }),
    },
  ];
});
/**
 * 异步处理登录操作
 * Asynchronously handle the login process
 * @param values 登录表单数据
 */
async function handleLogin(values: Recordable<any>) {
  try {
    loading.value = true;
    const { accessToken } = await confirmLoginCodeApi({ code: values.code });
    accessStore.setAccessToken(accessToken);
    const [userInfo, accessCodes] = await Promise.all([
      authStore.fetchUserInfo(),
      getAccessCodesApi(),
    ]);
    accessStore.setAccessCodes(accessCodes);
    notification.success({
      description: '正在进入控制台',
      title: '登录成功',
    });
    await router.push(userInfo.homePath || getRedirectPath());
  } catch (error: any) {
    if (error?.message?.includes('HTTP 409')) {
      await router.replace({
        path: '/auth/login',
        query: route.query,
      });
      return;
    }
    notification.error({
      description: error?.message || '验证码校验失败',
      title: '登录失败',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationCodeLogin
    ref="authFormRef"
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleLogin"
  />
</template>
