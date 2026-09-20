<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CustomNavigationLayout } from '@/components/utils/navigation'
import { resolveCustomNavigationLayout } from '@/components/utils/navigation'

// #ifdef MP-WEIXIN
// 移除小程序自定义组件宿主节点，确保 fixed 导航按整个视口定位。
defineOptions({
  virtualHost: true,
})
// #endif

const props = defineProps<{
  fallbackUrl: string
  management?: boolean
  scrolled?: boolean
  scrollProgress?: number
}>()

const HOUSE_DETAIL_FADE_DISTANCE = 190
const browserScrollProgress = ref(0)

function normalizeProgress(progress: number) {
  return Math.min(1, Math.max(0, progress))
}

// #ifdef H5
// H5 的文档滚动（包括浏览器恢复位置）不会始终触发 uni-app 的页面滚动钩子。
function syncBrowserScroll() {
  browserScrollProgress.value = normalizeProgress(window.scrollY / HOUSE_DETAIL_FADE_DISTANCE)
}
onMounted(() => {
  syncBrowserScroll()
  window.addEventListener('scroll', syncBrowserScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', syncBrowserScroll))
// #endif

const effectiveScrollProgress = computed(() => {
  if (props.scrolled)
    return 1
  return Math.max(normalizeProgress(props.scrollProgress || 0), browserScrollProgress.value)
})

function interpolateRgba(start: readonly [number, number, number, number], end: readonly [number, number, number, number], progress: number) {
  const channels = start.map((value, index) => value + (end[index] - value) * progress)
  return `rgba(${Math.round(channels[0])}, ${Math.round(channels[1])}, ${Math.round(channels[2])}, ${channels[3].toFixed(3)})`
}

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
  const progress = effectiveScrollProgress.value
  const contentHeight = layout.height - layout.topInset
  return {
    '--house-detail-navigation-height': `${layout.height}px`,
    '--house-detail-navigation-top-inset': `${layout.topInset}px`,
    '--house-detail-navigation-control-top': `${layout.topInset + Math.max(0, (contentHeight - 34) / 2)}px`,
    '--house-detail-navigation-right-inset': `${layout.rightInset}px`,
    '--house-detail-navigation-title-color': interpolateRgba([255, 255, 255, 1], [24, 37, 56, 1], progress),
    '--house-detail-navigation-badge-color': interpolateRgba([255, 255, 255, 0.74], [120, 134, 154, 1], progress),
    '--house-detail-navigation-badge-border-color': interpolateRgba([255, 255, 255, 0.33], [231, 236, 242, 1], progress),
  }
})
const heroBackgroundStyle = computed(() => ({ opacity: String(1 - effectiveScrollProgress.value) }))
const scrolledBackgroundStyle = computed(() => ({ opacity: String(effectiveScrollProgress.value) }))

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: props.fallbackUrl })
}
</script>

<template>
  <view class="house-detail-navigation" :class="{ 'house-detail-navigation--scrolled': effectiveScrollProgress >= 1 }" :style="navigationStyle">
    <view class="house-detail-navigation__hero-background" :style="heroBackgroundStyle" />
    <view class="house-detail-navigation__scrolled-background" :style="scrolledBackgroundStyle" />
    <button class="house-detail-navigation__back app-touchable" aria-label="返回上一页" @click="goBack">
      <text class="i-carbon-chevron-left" />
    </button>
    <view class="house-detail-navigation__title">
      房源详情<text v-if="management" class="house-detail-navigation__badge">管理</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-detail-navigation {
  position: fixed;
  z-index: 8;
  top: 0;
  right: 0;
  left: 0;
  height: var(--house-detail-navigation-height);
  padding: calc(var(--house-detail-navigation-top-inset) + 8px) var(--house-detail-navigation-right-inset) 8px 24rpx;
  box-sizing: border-box;
  pointer-events: none;
  background: transparent;
}

.house-detail-navigation__hero-background,
.house-detail-navigation__scrolled-background {
  position: absolute;
  z-index: 0;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  transition: opacity var(--app-motion-duration-fast) linear;
}

.house-detail-navigation__hero-background {
  background: linear-gradient(180deg, rgba(4, 18, 32, 0.5), rgba(4, 18, 32, 0));
}

.house-detail-navigation__scrolled-background {
  border-bottom: 1px solid #e7ecf2;
  background: #fff;
}

.house-detail-navigation__back {
  position: absolute;
  z-index: 2;
  top: var(--house-detail-navigation-control-top);
  left: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  margin: 0;
  padding: 0;
  border: 1rpx solid rgba(255, 255, 255, 0.7);
  border-radius: 999rpx;
  color: #17212b;
  font-size: 20px;
  line-height: 1;
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12rpx);
}

.house-detail-navigation__back::after {
  border: 0;
}
.house-detail-navigation__title {
  position: absolute;
  z-index: 1;
  top: var(--house-detail-navigation-top-inset);
  right: var(--house-detail-navigation-right-inset);
  bottom: 0;
  left: var(--house-detail-navigation-right-inset);
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  overflow: hidden;
  color: var(--house-detail-navigation-title-color);
  font-size: 16px;
  font-weight: 650;
  line-height: 24px;
  text-align: center;
  white-space: nowrap;
}
.house-detail-navigation__badge {
  padding-left: 8px;
  border-left: 1px solid var(--house-detail-navigation-badge-border-color);
  color: var(--house-detail-navigation-badge-color);
  font-size: 10px;
  font-weight: 400;
  line-height: 16px;
}
</style>
