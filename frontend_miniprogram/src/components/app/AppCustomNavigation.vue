<script setup lang="ts">
import type { CustomNavigationLayout, NavigationContentOpacityMode, NavigationScrollMode } from '@/components/utils/navigation'
import { computed } from 'vue'
import { resolveCustomNavigationLayout, resolveNavigationContentOpacity } from '@/components/utils/navigation'

// #ifdef MP-WEIXIN
// 移除小程序自定义组件宿主节点，避免它把内部 sticky 限制在导航栏自身高度内。
defineOptions({
  virtualHost: true,
})
// #endif

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  clickable?: boolean
  icon?: string
  scrollMode?: NavigationScrollMode
  scrolled?: boolean
  transparent?: boolean
  contentOpacity?: number
  contentOpacityMode?: NavigationContentOpacityMode
  scrolledContentOpacity?: number
  scrolledContentOpacityMode?: NavigationContentOpacityMode
  scrollProgress?: number
  scrolledBackground?: string
  align?: 'start' | 'center'
  scrolledAlign?: 'start' | 'center'
  back?: boolean
  immersive?: boolean
  fallbackUrl?: string
  beforeBack?: () => boolean | Promise<boolean>
}>(), {
  subtitle: '',
  clickable: false,
  icon: '',
  scrollMode: 'flow',
  scrolled: false,
  transparent: false,
  contentOpacity: 1,
  contentOpacityMode: 'manual',
  scrolledContentOpacity: 1,
  scrolledContentOpacityMode: 'fade-in',
  scrollProgress: 0,
  scrolledBackground: 'var(--app-navigation-fade-background)',
  align: 'center',
  back: false,
  immersive: false,
  fallbackUrl: '/pages/index/index',
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
    '--app-navigation-scrolled-background': props.scrolledBackground,
  }
})
const navigationClass = computed(() => [
  `app-custom-navigation--${props.scrollMode}`,
  props.back ? 'app-custom-navigation--with-back' : '',
  props.scrolled ? 'app-custom-navigation--scrolled' : '',
  props.transparent ? 'app-custom-navigation--transparent' : '',
  props.immersive ? 'app-custom-navigation--immersive' : '',
])
const normalizedScrollProgress = computed(() => Math.min(1, Math.max(0, props.scrollProgress)))
const normalizedContentOpacity = computed(() => resolveNavigationContentOpacity(props.contentOpacityMode, normalizedScrollProgress.value, props.contentOpacity))
const normalizedScrolledContentOpacity = computed(() => resolveNavigationContentOpacity(props.scrolledContentOpacityMode, normalizedScrollProgress.value, props.scrolledContentOpacity))
const navigationBackgroundStyle = computed(() => ({ opacity: String(normalizedScrollProgress.value) }))
const navigationContentStyle = computed(() => ({ opacity: String(normalizedContentOpacity.value) }))
const scrolledNavigationContentStyle = computed(() => ({ opacity: String(normalizedScrolledContentOpacity.value) }))
const navigationContentClass = computed(() => [
  `app-custom-navigation__content--${props.align}`,
  props.clickable ? 'app-custom-navigation__content--clickable' : '',
  normalizedContentOpacity.value === 0 ? 'app-custom-navigation__content--hidden' : '',
])
const scrolledNavigationContentClass = computed(() => [
  `app-custom-navigation__content--${props.scrolledAlign || props.align}`,
  props.clickable ? 'app-custom-navigation__content--clickable' : '',
  normalizedScrolledContentOpacity.value === 0 ? 'app-custom-navigation__content--hidden' : '',
])

function handleClick() {
  if (props.clickable)
    emit('click')
}

async function handleBack() {
  if (props.beforeBack && !await props.beforeBack())
    return
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: props.fallbackUrl })
}
</script>

<template>
  <view class="app-custom-navigation" :class="navigationClass" :style="navigationStyle">
    <view v-if="scrollMode === 'fade' && !transparent" class="app-custom-navigation__fade-background" :style="navigationBackgroundStyle">
      <view class="app-custom-navigation__fade-tail" />
    </view>
    <button v-if="back" class="app-custom-navigation__back" aria-label="返回" @click="handleBack">
      <view class="i-carbon-chevron-left" />
    </button>
    <view class="app-custom-navigation__content" :class="navigationContentClass" :style="navigationContentStyle" @click="handleClick">
      <slot name="content">
        <slot name="icon">
          <view v-if="icon" class="app-custom-navigation__icon" :class="icon" />
        </slot>
        <view class="app-custom-navigation__copy">
          <text class="app-custom-navigation__title">{{ title }}</text>
          <text v-if="subtitle" class="app-custom-navigation__subtitle">{{ subtitle }}</text>
        </view>
        <view v-if="clickable" class="app-custom-navigation__arrow i-carbon-chevron-down" />
      </slot>
    </view>
    <view
      v-if="$slots['scrolled-content']"
      class="app-custom-navigation__content"
      :class="scrolledNavigationContentClass"
      :style="scrolledNavigationContentStyle"
      @click="handleClick"
    >
      <slot name="scrolled-content" />
    </view>
    <view v-if="$slots.action" class="app-custom-navigation__action">
      <slot name="action" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-custom-navigation {
  position: relative;
  z-index: 900;
  height: var(--app-navigation-height);
  padding: var(--app-navigation-top-inset) var(--app-navigation-right-inset) 8px var(--app-page-gutter);
  border-bottom: 1rpx solid transparent;
  background: transparent;
  box-sizing: border-box;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.app-custom-navigation__content.app-custom-navigation__content--center {
  right: var(--app-navigation-right-inset);
  left: var(--app-navigation-right-inset);
  justify-content: center;
  text-align: center;
}
.app-custom-navigation__content.app-custom-navigation__content--center .app-custom-navigation__copy {
  flex: 0 1 auto;
}
.app-custom-navigation__content.app-custom-navigation__content--center .app-custom-navigation__title,
.app-custom-navigation__content.app-custom-navigation__content--center .app-custom-navigation__subtitle {
  text-align: center;
}
.app-custom-navigation--with-back .app-custom-navigation__content--start {
  left: calc(var(--app-page-gutter) + 72rpx);
}
.app-custom-navigation__action {
  position: absolute;
  z-index: 2;
  right: var(--app-navigation-right-inset);
  bottom: 8px;
  display: flex;
  min-height: 56rpx;
  align-items: center;
  color: var(--app-color-brand-active);
  font-size: 24rpx;
  font-weight: 600;
}
.app-custom-navigation__back {
  position: absolute;
  z-index: 3;
  bottom: 8px;
  left: var(--app-page-gutter);
  display: flex;
  width: 56rpx;
  height: 56rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--app-text-primary);
  font-size: 36rpx;
  line-height: 1;
  background: transparent;
}
.app-custom-navigation__back::after {
  border: 0;
}
.app-custom-navigation--sticky,
.app-custom-navigation--adaptive,
.app-custom-navigation--fade {
  position: sticky;
  top: 0;
}
.app-custom-navigation--sticky,
.app-custom-navigation--adaptive.app-custom-navigation--scrolled {
  border-bottom-color: var(--app-navigation-border-color);
  background: var(--app-navigation-background);
  box-shadow: var(--app-navigation-shadow);
}
.app-custom-navigation--immersive {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
}
.app-custom-navigation--immersive .app-custom-navigation__back {
  color: #fff;
  background: rgb(8 18 34 / 42%);
  box-shadow: 0 6rpx 18rpx rgb(0 0 0 / 16%);
  backdrop-filter: blur(14rpx);
}
.app-custom-navigation--transparent,
.app-custom-navigation--transparent.app-custom-navigation--scrolled {
  border-bottom-color: transparent;
  background: transparent;
  box-shadow: none;
}
.app-custom-navigation__fade-background {
  position: absolute;
  z-index: 0;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--app-navigation-scrolled-background);
  -webkit-backdrop-filter: var(--app-navigation-backdrop-filter);
  backdrop-filter: var(--app-navigation-backdrop-filter);
  pointer-events: none;
  transition: opacity var(--app-motion-duration-fast) linear;
}
.app-custom-navigation__fade-tail {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  height: 24rpx;
  background: linear-gradient(180deg, var(--app-navigation-scrolled-background) 0, transparent 100%);
}
.app-custom-navigation__content {
  position: absolute;
  z-index: 1;
  top: var(--app-navigation-top-inset);
  right: var(--app-navigation-right-inset);
  bottom: 0;
  left: var(--app-page-gutter);
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
  min-height: 56rpx;
  transition: opacity var(--app-motion-duration-fast) linear;
}
.app-custom-navigation__content--clickable {
  cursor: pointer;
}
.app-custom-navigation__content--hidden {
  pointer-events: none;
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
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-custom-navigation__subtitle {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-custom-navigation__arrow {
  font-size: 28rpx;
}
</style>
