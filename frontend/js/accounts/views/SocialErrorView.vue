<script setup>
import { useRoute, RouterLink } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';

const route = useRoute();
const errorMessage = route.query.error || 'An error occurred during social login.';
</script>

<template>
  <AuthLayout>
    <h1 class="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
      Sign In Error
    </h1>
    <p class="mt-4 text-center text-sm text-red-600 dark:text-red-400">
      {{ errorMessage }}
    </p>
    <div class="mt-6 text-center">
      <RouterLink
        :to="{ name: 'login' }"
        class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
      >
        Back to Sign In
      </RouterLink>
    </div>
  </AuthLayout>
</template>
