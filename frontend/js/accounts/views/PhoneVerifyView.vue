<script setup>
import { ref, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import FormField from '../components/FormField.vue';
import FormErrors from '../components/FormErrors.vue';
import { authApi, parseAllauthErrors } from '../api';
import { safeNextUrl } from '../../utils/redirect';

const route = useRoute();
const router = useRouter();
const appStore = inject('appStore');

const code = ref('');
const errors = ref({});
const loading = ref(false);
const resendLoading = ref(false);
const resendMessage = ref('');

async function onSubmit() {
  loading.value = true;
  errors.value = {};
  try {
    await authApi.verifyPhone(code.value);
    await appStore.fetchContext();
    if (appStore.isAuthenticated) {
      router.push(safeNextUrl(route.query.next));
    } else {
      router.push({ name: 'login' });
    }
  } catch (err) {
    if (err.response?.status === 410) {
      // 验证流程过期，重新登录
      router.push({ name: 'login' });
      return;
    }
    errors.value = err.data ? parseAllauthErrors(err.data) : {
      non_field_errors: ['Invalid code. Please try again.'],
    };
    loading.value = false;
  }
}

async function onResend() {
  resendLoading.value = true;
  resendMessage.value = '';
  try {
    await authApi.resendPhoneCode();
    resendMessage.value = 'Verification code resent.';
  } catch {
    resendMessage.value = 'Failed to resend. Please try again.';
  } finally {
    resendLoading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h1 class="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
      Verify your phone
    </h1>
    <p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
      Enter the verification code sent to your phone number.
    </p>
    <form
      class="mt-6 space-y-4"
      @submit.prevent="onSubmit"
    >
      <FormErrors :errors="errors.non_field_errors || []" />
      <FormField
        v-model="code"
        label="Verification Code"
        type="text"
        placeholder="Enter code"
        autocomplete="one-time-code"
        inputmode="numeric"
        :errors="errors.code || []"
      />
      <button
        type="submit"
        :disabled="loading || !code"
        class="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
      >
        {{ loading ? 'Verifying…' : 'Verify' }}
      </button>
    </form>
    <div class="mt-4 text-center">
      <p
        v-if="resendMessage"
        class="mb-2 text-sm text-green-600 dark:text-green-400"
      >
        {{ resendMessage }}
      </p>
      <button
        type="button"
        :disabled="resendLoading"
        class="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 dark:text-blue-400"
        @click="onResend"
      >
        {{ resendLoading ? 'Sending…' : 'Resend code' }}
      </button>
    </div>
  </AuthLayout>
</template>
