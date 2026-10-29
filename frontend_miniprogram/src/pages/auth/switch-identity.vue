<script setup lang="ts">
import type { AppModeOption, AppModeSelection } from '@/domain/app-mode'
import { onLoad, onReady, onUnload } from '@dcloudio/uni-app'
import { nextTick, ref } from 'vue'
import { AppError } from '@/core/errors/app-error'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppStateCard from '@/components/app/AppStateCard.vue'
import AppModeSwitcher from '@/pages/me/components/AppModeSwitcher.vue'
import { parseNavigationTarget, shellRoutes, withRouteWorkspace } from '@/domain/route-access'
import { getDefaultRouteForMode } from '@/modules/registry'
import { APP_ROUTES } from '@/modules/routes'
import { getNavigationRedirect, resolveRouteAccess } from '@/router/permission'
import { useWorkspaceStore } from '@/store/workspace'
import { isPageTabbar } from '@/tabbar/store'

definePage({ style: { navigationBarTitleText: '切换身份', navigationStyle: 'custom' } })

const workspace = useWorkspaceStore()
const switcher = ref<InstanceType<typeof AppModeSwitcher>>()
const identityOptions = ref<readonly AppModeOption[]>([])
const loading = ref(false)
const error = ref('')
let target = ''
let leaving = false
let active = true
let returnDelta = 0

function cancel() {
  if (leaving || loading.value)
    return
  leaving = true
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.reLaunch({ url: getDefaultRouteForMode(workspace.mode) })
}

function continueToTarget(selection?: AppModeSelection) {
  if (!active)
    return
  leaving = true
  const url = selection ? withRouteWorkspace(target, selection) : target
  const decision = resolveRouteAccess(url)
  const destination = decision.allowed ? url : decision.redirect
  const options = {
    url: destination,
    success: () => {
      if (selection && decision.allowed)
        uni.showToast({ title: `已切换至${workspace.modePresentation.title}`, icon: 'none' })
    },
    fail: () => {
      leaving = false
      error.value = '页面打开失败，请重试'
    },
  }
  if (returnDelta && decision.allowed)
    uni.navigateBack({ ...options, delta: returnDelta })
  else if (isPageTabbar(destination))
    uni.switchTab(options)
  else
    uni.redirectTo(options)
}

function handleSwitchError(cause: unknown) {
  if (!active)
    return
  if (cause instanceof AppError && cause.kind === 'forbidden') {
    leaving = true
    uni.redirectTo({ url: APP_ROUTES.forbidden })
    return
  }
  error.value = cause instanceof Error ? cause.message : '身份切换失败，请重试'
}

async function resume() {
  if (loading.value || leaving)
    return
  error.value = ''
  const decision = resolveRouteAccess(target)
  if (!decision.identityOptions) {
    continueToTarget()
    return
  }
  identityOptions.value = decision.identityOptions
  if (identityOptions.value.length > 1) {
    await nextTick()
    switcher.value?.open()
    return
  }
  loading.value = true
  try {
    const selection = identityOptions.value[0].selection
    await workspace.switchMode(selection)
    continueToTarget(selection)
  }
  catch (cause) {
    handleSwitchError(cause)
  }
  finally {
    loading.value = false
  }
}

onLoad((options) => {
  target = getNavigationRedirect(options)
  const delta = Number(options?.return_delta || 0)
  returnDelta = Number.isInteger(delta) && delta > 0 && delta < getCurrentPages().length ? delta : 0
  if (!target.startsWith('/') || target.startsWith('//') || shellRoutes.includes(parseNavigationTarget(target).path))
    target = APP_ROUTES.notFound
})
onReady(() => void resume())
onUnload(() => active = false)
</script>

<template>
  <AppPage variant="plain">
    <template #navigation>
      <AppCustomNavigation title="切换身份" back scroll-mode="sticky" />
    </template>
    <AppLoading v-if="loading" text="正在切换身份…" />
    <AppStateCard
      v-else
      :tone="error ? 'warning' : 'info'"
      icon="i-carbon-arrows-horizontal"
      :title="error ? '暂时无法继续访问' : '选择访问身份'"
      :description="error || '选择对应的经纪人或房东身份后，将继续打开刚才的页面。'"
    >
      <template #action>
        <wd-button size="small" variant="plain" @click="cancel">
          取消
        </wd-button>
        <wd-button size="small" @click="resume">
          {{ error ? '重试' : '选择身份' }}
        </wd-button>
      </template>
    </AppStateCard>
    <AppModeSwitcher ref="switcher" :options="identityOptions" :show-trigger="false" @switched="continueToTarget" @cancel="cancel" @failed="handleSwitchError" />
  </AppPage>
</template>
