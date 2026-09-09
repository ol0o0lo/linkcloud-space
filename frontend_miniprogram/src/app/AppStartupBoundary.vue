<script setup lang="ts">
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { shouldBypassStartupBoundary } from '@/modules/routes'
import { useRuntimeStore } from '@/store/runtime'
import { currRoute } from '@/utils'

const runtimeStore = useRuntimeStore()
const bypassStartupBoundary = shouldBypassStartupBoundary(currRoute().path)
</script>

<template>
  <slot v-if="bypassStartupBoundary || runtimeStore.startupState === 'ready'" />
  <AppErrorView
    v-else-if="runtimeStore.startupState === 'recoverable-error' || runtimeStore.startupState === 'fatal-error'"
    :error="runtimeStore.startupError"
    title="应用暂时无法启动"
    @retry="runtimeStore.bootstrap"
  />
  <AppLoading v-else text="正在准备链云空间…" />
</template>
