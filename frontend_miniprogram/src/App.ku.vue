<script setup lang="ts">
import { onHide, onShow } from '@dcloudio/uni-app'
import { isH5 } from '@uni-helper/uni-env'
import { provide, ref } from 'vue'
import { APP_AI_BACKGROUND_CYCLE_MS, appAiBackgroundContextKey } from '@/app/ai-background'
import AppProviders from '@/app/AppProviders.vue'
import AppStartupBoundary from '@/app/AppStartupBoundary.vue'
import FgTabbar from '@/tabbar/index.vue'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'

const isCurrentPageTabbar = ref(true)
const isAiBackgroundEnabled = ref(false)
const isPageVisible = ref(true)
const aiBackgroundDelay = ref('0ms')
const aiBackgroundSources = new Set<object>()

function syncAiBackgroundTimeline() {
  if (!isAiBackgroundEnabled.value)
    return
  aiBackgroundDelay.value = `-${Date.now() % APP_AI_BACKGROUND_CYCLE_MS}ms`
}

function syncAiBackgroundEnabled() {
  const enabled = aiBackgroundSources.size > 0
  if (enabled && !isAiBackgroundEnabled.value) {
    isAiBackgroundEnabled.value = true
    syncAiBackgroundTimeline()
    return
  }
  isAiBackgroundEnabled.value = enabled
}

provide(appAiBackgroundContextKey, {
  acquire(source) {
    aiBackgroundSources.add(source)
    syncAiBackgroundEnabled()
  },
  release(source) {
    aiBackgroundSources.delete(source)
    syncAiBackgroundEnabled()
  },
})

function hidePageAiBackground() {
  if (isH5 || !isPageVisible.value)
    return
  isPageVisible.value = false
}

function showPageAiBackground() {
  if (isH5 || isPageVisible.value)
    return
  syncAiBackgroundTimeline()
  isPageVisible.value = true
}

onShow(() => {
  const { path } = currRoute()
  isCurrentPageTabbar.value = isPageTabbar(path)
  showPageAiBackground()
})

onHide(hidePageAiBackground)
</script>

<template>
  <AppProviders>
    <AppStartupBoundary>
      <view class="app-root-shell">
        <view
          v-if="isAiBackgroundEnabled && isPageVisible"
          class="app-ai-background"
          :style="{ '--app-ai-background-delay': aiBackgroundDelay }"
        />
        <KuRootView />
        <FgTabbar v-if="isCurrentPageTabbar" />
      </view>
    </AppStartupBoundary>
  </AppProviders>
</template>

<style scoped lang="scss">
.app-root-shell {
  position: relative;
  min-height: 100vh;
  isolation: isolate;
}

.app-ai-background {
  position: fixed;
  z-index: -1;
  top: -160rpx;
  right: 0;
  bottom: -160rpx;
  left: 0;
  background:
    radial-gradient(circle at 20% 24%, rgb(39 143 255 / 16%) 0%, transparent 44%),
    radial-gradient(circle at 78% 34%, rgb(117 86 255 / 14%) 0%, transparent 42%),
    radial-gradient(circle at 48% 74%, rgb(44 211 192 / 10%) 0%, transparent 40%),
    linear-gradient(180deg, #edf6ff 0%, #f8f6ff 42%, var(--app-bg-page) 100%);
  pointer-events: none;
  animation: app-ai-background-drift 18s ease-in-out var(--app-ai-background-delay) infinite alternate both;
}

@keyframes app-ai-background-drift {
  from {
    transform: translate3d(0, 0, 0) scaleY(1);
  }

  to {
    transform: translate3d(0, 56rpx, 0) scaleY(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-ai-background {
    animation: none;
  }
}
</style>
