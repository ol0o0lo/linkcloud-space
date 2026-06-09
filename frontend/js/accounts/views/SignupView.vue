<script setup>
import { ref, inject } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import FormField from '../components/FormField.vue';
import FormErrors from '../components/FormErrors.vue';
import { authApi, parseAllauthErrors } from '../api';
import { safeNextUrl } from '../../utils/redirect';

const route = useRoute();
const router = useRouter();
const appStore = inject('appStore');

const email = ref('');
const phone = ref('');
const password1 = ref('');
const errors = ref({});
const loading = ref(false);
const githubLoading = ref(false);

async function githubSignup() {
  githubLoading.value = true;
  errors.value = {};
  try {
    await authApi.githubLogin(window.location.origin + '/accounts/social/callback/');
  } catch {
    errors.value = { non_field_errors: ['GitHub sign up failed. Please try again.'] };
    githubLoading.value = false;
  }
}

async function onSubmit() {
  loading.value = true;
  errors.value = {};
  try {
    const resp = await authApi.signup({
      email: email.value,
      phone: phone.value,
      password: password1.value,
    });
    // 注册直接完成（无需验证）
    await appStore.fetchContext();
    if (appStore.isAuthenticated) {
      router.push(safeNextUrl(route.query.next));
    } else {
      router.push({ name: 'verification-sent' });
    }
  } catch (err) {
    // allauth 注册成功但需要 phone verification 时返回 401
    const flows = err.data?.data?.flows || [];
    const phoneStage = flows.find((f) => f.id === 'verify_phone' && f.is_pending);
    if (phoneStage) {
      router.push({ name: 'verify-phone', query: { next: route.query.next } });
      return;
    }
    if (err.data) {
      errors.value = parseAllauthErrors(err.data);
    } else {
      errors.value = { non_field_errors: ['An unexpected error occurred.'] };
    }
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <template v-if="!appStore.signupOpen">
      <h1 class="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Sign Up
      </h1>
      <p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Sign up is currently closed.
      </p>
      <p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <RouterLink
          :to="{ name: 'login' }"
          class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Sign in
        </RouterLink>
      </p>
    </template>
    <template v-else>
      <h1 class="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Sign Up
      </h1>
      <p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
        Create your account
      </p>
      <p
        v-if="route.query.invite_code"
        class="mt-2 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400"
      >
        你正在通过邀请码 {{ route.query.invite_code }} 注册
      </p>
      <form
        class="mt-6 space-y-4"
        @submit.prevent="onSubmit"
      >
        <FormErrors :errors="errors.non_field_errors || []" />
        <FormField
          v-model="phone"
          label="Phone (optional)"
          type="tel"
          placeholder="+86 13800138000"
          autocomplete="tel"
          :errors="errors.phone || []"
        />
        <FormField
          v-model="email"
          label="Email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          :errors="errors.email || []"
        />
        <FormField
          v-model="password1"
          label="Password"
          type="password"
          placeholder="Password"
          autocomplete="new-password"
          :errors="errors.password || errors.password1 || []"
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
        >
          {{ loading ? 'Creating account...' : 'Sign Up' }}
        </button>
        <div class="relative my-1">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200 dark:border-gray-700" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">or</span>
          </div>
        </div>
        <button
          type="button"
          :disabled="githubLoading"
          class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          @click="githubSignup"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {{ githubLoading ? 'Redirecting…' : 'Sign up with GitHub' }}
        </button>
      </form>
    </template>
    <template #footer>
      <p class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?
        <RouterLink
          :to="{ name: 'login' }"
          class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Sign in
        </RouterLink>
      </p>
    </template>
  </AuthLayout>
</template>
