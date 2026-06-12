<script setup lang="ts">
import { Page } from '@vben/common-ui';

import ProfileSecuritySetting from './security-setting.vue';
</script>

<template>
  <Page auto-content-height title="安全设置">
    <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <ProfileSecuritySetting />
    </div>
  </Page>
</template>
