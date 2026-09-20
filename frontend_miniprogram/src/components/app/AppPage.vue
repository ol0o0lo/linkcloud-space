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
  props.safeAreaBottom && !props.reserveFooterSpace ? 'pb-[calc(var(--app-page-gutter)+env(safe-area-inset-bottom))]' : '',
  props.reserveFooterSpace ? 'pb-[calc(124rpx+env(safe-area-inset-bottom))]' : '',
])
</script>

<template>
  <view class="app-page app-page-shell" :class="pageClass" :data-variant="variant" :data-mode="appContextStore.navigationMode">
    <slot name="navigation" />
    <slot name="header" />
    <view class="app-page__content box-border min-h-[inherit]" :class="contentClass">
      <slot name="before" />
      <slot />
      <slot name="after" />
    </view>
    <slot name="footer" />
    <view v-if="tabbar" class="app-page__tabbar-spacer" />
    <slot name="overlay" />
  </view>
</template>

<style scoped lang="scss">
.app-page {
  --wot-color-theme: var(--app-color-brand);
}

.app-page--ai-background {
  position: relative;
  background: transparent;
}

.app-page--landlord {
  --app-color-brand: #159d77;
  --app-color-brand-active: #0f7c5d;
  --app-color-brand-soft: #e9f8f2;
  --app-bg-brand-soft: #e9f8f2;
  --app-border-brand-soft: rgb(21 157 119 / 22%);
}

.app-page--organization {
  --app-color-brand: #6b57e8;
  --app-color-brand-active: #5141bd;
  --app-color-brand-soft: #f0edff;
  --app-bg-brand-soft: #f0edff;
  --app-border-brand-soft: rgb(107 87 232 / 22%);
}

.app-page__tabbar-spacer {
  height: calc(var(--app-tabbar-height) + env(safe-area-inset-bottom));
  pointer-events: none;
}
</style>
