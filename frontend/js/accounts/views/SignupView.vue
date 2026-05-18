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
      <form
        class="mt-6 space-y-4"
        @submit.prevent="onSubmit"
      >
        <FormErrors :errors="errors.non_field_errors || []" />
        <FormField
          v-model="phone"
          label="Phone"
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
