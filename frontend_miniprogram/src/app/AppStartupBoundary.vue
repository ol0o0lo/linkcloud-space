<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, ref } from 'vue'
import type { Router } from 'vue-router'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import { shouldBypassStartupBoundary } from '@/modules/routes'
import { buildNavigationTarget } from '@/domain/route-access'
import { resolveRouteAccess } from '@/router/permission'
import { useRuntimeStore } from '@/store/runtime'
import { currRoute } from '@/utils'

const runtimeStore = useRuntimeStore()
const bypassStartupBoundary = shouldBypassStartupBoundary(currRoute().path)
const pageRoute = ref(currRoute())
const router = (getCurrentInstance()?.proxy as { $router?: Router } | null)?.$router
onShow(() => pageRoute.value = currRoute())
const routeAccessible = computed(() => {
  if (runtimeStore.startupState !== 'ready')
    return false
  const route = router?.currentRoute.value.fullPath || buildNavigationTarget(pageRoute.value.path, pageRoute.value.query)
  return resolveRouteAccess(route).allowed
})
</script>

<template>
  <slot v-if="bypassStartupBoundary || (runtimeStore.startupState === 'ready' && routeAccessible)" />
  <AppErrorView
    v-else-if="runtimeStore.startupState === 'recoverable-error' || runtimeStore.startupState === 'fatal-error'"
    :error="runtimeStore.startupError"
    title="应用暂时无法启动"
    @retry="runtimeStore.bootstrap"
  />
  <AppLoading v-else text="正在准备链云空间…" />
</template>
