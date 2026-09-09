<script setup lang="ts">
import { computed } from 'vue'
import type { CustomNavigationLayout } from '@/shared/navigation/layout'
import { resolveCustomNavigationLayout } from '@/shared/navigation/layout'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  clickable?: boolean
}>(), {
  subtitle: '',
  clickable: false,
})

const emit = defineEmits<{
  click: []
}>()

const navigationStyle = computed(() => {
  let layout: CustomNavigationLayout
  // #ifdef MP-WEIXIN
  const windowInfo = uni.getWindowInfo()
  layout = resolveCustomNavigationLayout({
    windowWidth: windowInfo.windowWidth,
    statusBarHeight: windowInfo.statusBarHeight,
    menuButton: uni.getMenuButtonBoundingClientRect(),
  })
  // #endif
  // #ifndef MP-WEIXIN
  layout = resolveCustomNavigationLayout({
    windowWidth: uni.getWindowInfo?.().windowWidth || 0,
    statusBarHeight: 0,
  })
  // #endif
  return {
    '--app-navigation-height': `${layout.height}px`,
    '--app-navigation-top-inset': `${layout.topInset}px`,
    '--app-navigation-right-inset': `${layout.rightInset}px`,
  }
})

function handleClick() {
  if (props.clickable)
    emit('click')
}
</script>

<template>
  <view class="app-custom-navigation" :style="navigationStyle">
    <view class="app-custom-navigation__content" :class="{ 'app-custom-navigation__content--clickable': clickable }" @click="handleClick">
      <view class="app-custom-navigation__icon i-carbon-apps" />
      <view class="app-custom-navigation__copy">
        <text class="app-custom-navigation__title">{{ title }}</text>
        <text v-if="subtitle" class="app-custom-navigation__subtitle">{{ subtitle }}</text>
      </view>
      <view v-if="clickable" class="app-custom-navigation__arrow i-carbon-chevron-down" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-custom-navigation {
  height: var(--app-navigation-height);
  padding: var(--app-navigation-top-inset) var(--app-navigation-right-inset) 8px var(--app-page-gutter);
  box-sizing: border-box;
}
.app-custom-navigation__content {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
  min-height: 56rpx;
}
.app-custom-navigation__content--clickable {
  cursor: pointer;
}
.app-custom-navigation__icon,
.app-custom-navigation__arrow {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 36rpx;
}
.app-custom-navigation__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
.app-custom-navigation__title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-custom-navigation__subtitle {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-custom-navigation__arrow {
  font-size: 28rpx;
}
</style>
