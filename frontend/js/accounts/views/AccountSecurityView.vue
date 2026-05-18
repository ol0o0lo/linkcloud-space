<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import AccountLayout from '@/layouts/AccountLayout.vue';
import { authApi } from '../api';

const authenticators = ref([]);
const socialAccounts = ref([]);
const loading = ref(true);
const githubLoading = ref(false);
const disconnectLoading = ref(false);

const totp = computed(() => authenticators.value.find((a) => a.type === 'totp'));
const recoveryCodes = computed(() => authenticators.value.find((a) => a.type === 'recovery_codes'));
const passkeys = computed(() => authenticators.value.filter((a) => a.type === 'webauthn'));
const githubAccount = computed(() => socialAccounts.value.find((a) => a.provider.id === 'github'));

async function load() {
  loading.value = true;
  try {
    const [authData, socialData] = await Promise.all([
      authApi.listAuthenticators(),
      authApi.getSocialAccounts(),
    ]);
    authenticators.value = authData.data || [];
    socialAccounts.value = socialData.data || [];
  } finally {
    loading.value = false;
  }
}

async function connectGithub() {
  githubLoading.value = true;
  try {
    const resp = await authApi.githubConnect(window.location.origin + '/accounts/social/callback/');
    const redirectUrl = resp?.data?.url || resp?.location;
    if (redirectUrl) window.location.href = redirectUrl;
  } catch {
    githubLoading.value = false;
  }
}

async function disconnectGithub() {
  if (!githubAccount.value) return;
  disconnectLoading.value = true;
  try {
    await authApi.disconnectSocial('github', githubAccount.value.uid);
    await load();
  } finally {
    disconnectLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AccountLayout>
    <div
      v-if="loading"
      class="text-sm text-gray-500 dark:text-gray-400"
    >
      Loading…
    </div>
    <div
      v-else
      class="space-y-6"
    >
      <section class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              Authenticator app (TOTP)
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span v-if="totp">Enabled. Use your authenticator app to generate codes when signing in.</span>
              <span v-else>Use Google Authenticator, 1Password, Authy, or similar to add a second factor.</span>
            </p>
          </div>
          <RouterLink
            :to="{ name: 'account-totp' }"
            class="cursor-pointer rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {{ totp ? 'Manage' : 'Set up' }}
          </RouterLink>
        </div>
      </section>

      <section class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              Recovery codes
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span v-if="recoveryCodes">
                {{ recoveryCodes.unused_code_count }} of {{ recoveryCodes.total_code_count }} unused.
              </span>
              <span v-else>Generated when you enable an authenticator app. Save them somewhere safe.</span>
            </p>
          </div>
          <RouterLink
            v-if="recoveryCodes"
            :to="{ name: 'account-recovery-codes' }"
            class="cursor-pointer rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            View
          </RouterLink>
        </div>
      </section>

      <section class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              Passkeys
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sign in with Touch ID, Windows Hello, your phone, or a hardware security key — no password needed.
            </p>
          </div>
          <RouterLink
            :to="{ name: 'account-passkeys' }"
            class="cursor-pointer rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {{ passkeys.length ? 'Manage' : 'Add' }}
          </RouterLink>
        </div>
        <p
          v-if="passkeys.length"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ passkeys.length }} passkey{{ passkeys.length === 1 ? '' : 's' }} registered.
        </p>
      </section>

      <section class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg
              class="h-5 w-5 text-gray-700 dark:text-gray-300"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <div>
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
                GitHub
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                <span v-if="githubAccount">Connected as <strong>{{ githubAccount.display }}</strong></span>
                <span v-else>Connect your GitHub account for one-click sign in.</span>
              </p>
            </div>
          </div>
          <button
            v-if="githubAccount"
            type="button"
            :disabled="disconnectLoading"
            class="cursor-pointer rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            @click="disconnectGithub"
          >
            {{ disconnectLoading ? 'Disconnecting…' : 'Disconnect' }}
          </button>
          <button
            v-else
            type="button"
            :disabled="githubLoading"
            class="cursor-pointer rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            @click="connectGithub"
          >
            {{ githubLoading ? 'Redirecting…' : 'Connect' }}
          </button>
        </div>
      </section>
    </div>
  </AccountLayout>
</template>
