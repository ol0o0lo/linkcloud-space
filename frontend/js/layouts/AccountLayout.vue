<script setup>
import { RouterLink, useRoute } from 'vue-router';

defineProps({
  wide: { type: Boolean, default: false },
});

const route = useRoute();

const tabs = [
  { to: { name: 'account-general' }, label: 'General', activeNames: ['account-general'] },
  { to: { name: 'account-email' }, label: 'Email Addresses', activeNames: ['account-email'] },
  { to: { name: 'account-password-change' }, label: 'Change Password', activeNames: ['account-password-change'] },
  {
    to: { name: 'account-security' },
    label: 'Security',
    activeNames: ['account-security', 'account-totp', 'account-recovery-codes', 'account-passkeys'],
  },
  { to: { name: 'account-notifications' }, label: 'Notifications', activeNames: ['account-notifications'] },
  { to: { name: 'account-referrals' }, label: 'Referrals', activeNames: ['account-referrals'] },
];
</script>

<template>
  <div
    class="mx-auto w-full"
    :class="wide ? 'max-w-6xl' : 'max-w-2xl'"
  >
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
      Account Settings
    </h1>
    <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav class="-mb-px flex flex-wrap gap-x-4 gap-y-2">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.label"
          :to="tab.to"
          :class="[
            'inline-block cursor-pointer pb-3 text-sm font-medium border-b-2',
            tab.activeNames.includes(route.name)
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : [
                'border-transparent text-gray-500',
                'hover:text-gray-700 hover:border-gray-300',
                'dark:text-gray-400 dark:hover:text-gray-300',
              ].join(' '),
          ]"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>
    </div>
    <slot />
  </div>
</template>
