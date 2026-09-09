<script setup lang="ts">
import { ref } from 'vue'
import AppProviders from '@/app/AppProviders.vue'
import AppStartupBoundary from '@/app/AppStartupBoundary.vue'
import FgTabbar from '@/tabbar/index.vue'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'

const isCurrentPageTabbar = ref(true)
onShow(() => {
  const { path } = currRoute()
  isCurrentPageTabbar.value = isPageTabbar(path)
})
</script>

<template>
  <AppProviders>
    <AppStartupBoundary>
      <KuRootView />
      <FgTabbar v-if="isCurrentPageTabbar" />
    </AppStartupBoundary>
  </AppProviders>
</template>
