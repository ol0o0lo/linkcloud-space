<script setup lang="ts">
import { computed, inject, onBeforeUnmount, watch } from 'vue'
import { appAiBackgroundContextKey } from '@/app/ai-background'
import { useAppContextStore } from '@/store/app-context-v2'

const props = withDefaults(defineProps<{
  variant?: 'plain' | 'list' | 'detail' | 'form'
  gutter?: 'none' | 'compact' | 'normal' | 'loose'
  tabbar?: boolean
  safeAreaBottom?: boolean
  reserveFooterSpace?: boolean
  aiBackground?: boolean
}>(), {
  variant: 'plain',
  gutter: 'normal',
  tabbar: false,
  safeAreaBottom: false,
  reserveFooterSpace: false,
  aiBackground: false,
})

const appContextStore = useAppContextStore()
const aiBackgroundContext = inject(appAiBackgroundContextKey, null)
const aiBackgroundSource = {}

watch(() => props.aiBackground, (enabled, wasEnabled) => {
  if (enabled)
    aiBackgroundContext?.acquire(aiBackgroundSource)
  else if (wasEnabled)
    aiBackgroundContext?.release(aiBackgroundSource)
}, { immediate: true })

onBeforeUnmount(() => {
  if (props.aiBackground)
    aiBackgroundContext?.release(aiBackgroundSource)
})

const pageClass = computed(() => [
  `app-page--${appContextStore.navigationMode}`,
  { 'app-page--ai-background': props.aiBackground },
])

const contentClass = computed(() => [
  props.gutter === 'compact' ? 'p-2' : '',
  props.gutter === 'normal' && props.variant === 'list' ? 'px-app-gutter pb-7 pt-2' : '',
  props.gutter === 'normal' && props.variant !== 'list' ? 'p-app-gutter' : '',
  props.gutter === 'loose' ? 'p-5' : '',
  props.safeAreaBottom && !props.reserveFooterSpace ? 'pb-safe-gutter' : '',
  props.reserveFooterSpace ? 'pb-safe-footer' : '',
])
</script>

<template>
  <view class="app-page app-page-shell" :class="pageClass" :data-variant="variant" :data-mode="appContextStore.navigationMode">
    <slot name="navigation" />
    <slot name="header" />
    <view class="app-page__content box-border min-h-inherit" :class="contentClass">
      <slot name="before" />
      <slot />
      <slot name="after" />
    </view>
    <slot name="footer" />
    <view v-if="tabbar" class="app-page__tabbar-spacer pointer-events-none" />
    <slot name="overlay" />
  </view>
</template>

<style scoped lang="scss">
.app-page {
  --wot-color-theme: var(--app-color-brand);
}

.app-page--ai-background {
  @apply relative bg-transparent;
}

.app-page__tabbar-spacer {
  height: calc(var(--app-tabbar-height) + env(safe-area-inset-bottom));
}
</style>
