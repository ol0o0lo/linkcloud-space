<script setup lang="ts">
import { Page } from '@vben/common-ui';

import ProfileNotificationSetting from './notification-setting.vue';
</script>

<template>
  <Page auto-content-height title="新消息提醒">
    <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <ProfileNotificationSetting />
    </div>
  </Page>
</template>
