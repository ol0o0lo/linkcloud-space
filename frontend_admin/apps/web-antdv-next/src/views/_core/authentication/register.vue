<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { notification } from 'antdv-next';

import { signupApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Register' });

const authStore = useAuthStore();
const loading = ref(false);
const route = useRoute();
const router = useRouter();

const inviteCode = computed(() => {
  return typeof route.query.invite_code === 'string' ? route.query.invite_code : '';
});

function getRedirectPath() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return decodeURIComponent(redirect);
  }
  return '/dashboard/overview';
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入邮箱',
      },
      fieldName: 'email',
      label: '邮箱',
      rules: z.string().min(1, { message: '请输入邮箱' }),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phone',
      label: '手机号',
      rules: z.string().min(1, { message: '请输入手机号' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      renderComponentContent() {
        return {
          strengthText: () => $t('authentication.passwordStrength'),
        };
      },
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: $t('authentication.passwordTip') })
            .min(1, { message: $t('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
    {
      component: 'VbenCheckbox',
      fieldName: 'agreePolicy',
      renderComponentContent: () => ({
        default: () =>
          h('span', [
            $t('authentication.agree'),
            h(
              'a',
              {
                class: 'vben-link ml-1 ',
                href: '',
              },
              `${$t('authentication.privacyPolicy')} & ${$t('authentication.terms')}`,
            ),
          ]),
      }),
      rules: z.boolean().refine((value) => !!value, {
        message: $t('authentication.agreeTip'),
      }),
    },
  ];
});

async function handleSubmit(value: Recordable<any>) {
  try {
    loading.value = true;
    const result = await signupApi({
      email: value.email,
      password: value.password,
      phone: value.phone,
    });

    if (result.pendingFlow === 'verify_phone') {
      await router.push({
        path: '/auth/verify-phone',
        query: {
          ...route.query,
          phone: value.phone,
        },
      });
      return;
    }

    await authStore.finalizeAuthenticatedSession(async () => {
      await router.push(getRedirectPath());
    });
  } catch (error: any) {
    notification.error({
      title: '注册失败',
      description: error?.message || '请稍后重试。',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationRegister
    :form-schema="formSchema"
    :loading="loading"
    submit-button-text="创建账号"
    @submit="handleSubmit"
  >
    <template #subTitle>
      <div class="space-y-2 text-center text-sm text-zinc-500">
        <p>完成注册后即可进入后台，如需验证手机号会自动进入下一步。</p>
        <p v-if="inviteCode" class="font-medium text-emerald-600">你正在通过邀请码 {{ inviteCode }} 注册</p>
      </div>
    </template>
  </AuthenticationRegister>
</template>
