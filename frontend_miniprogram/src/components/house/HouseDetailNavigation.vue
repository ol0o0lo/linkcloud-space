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
  <view class="house-detail-navigation pointer-events-none fixed left-0 right-0 top-0 z-8 box-border bg-transparent" :class="{ 'house-detail-navigation--scrolled': effectiveScrollProgress >= 1 }" :style="navigationStyle">
    <view class="house-detail-navigation__hero-background" :style="heroBackgroundStyle" />
    <view class="house-detail-navigation__scrolled-background border-b-1 border-b-hex-e7ecf2 border-b-solid bg-hex-fff" :style="scrolledBackgroundStyle" />
    <button class="house-detail-navigation__back pointer-events-auto absolute left-3 z-2 m-0 h-8.5 w-8.5 flex flex-none app-touchable items-center justify-center border-hairline border-hex-ffffff/70 rounded-full border-solid bg-hex-ffffff/94 p-0 text-size-xl text-hex-17212b leading-none backdrop-blur-6" aria-label="返回上一页" @click="goBack">
      <text class="i-carbon-chevron-left" />
    </button>
    <view class="house-detail-navigation__title absolute bottom-0 z-1 min-h-8.5 flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap text-center text-size-base text-$house-detail-navigation-title-color font-bold leading-6">
      房源详情<text v-if="management" class="house-detail-navigation__badge border-l-1 border-l-$house-detail-navigation-badge-border-color border-l-solid pl-2 text-size-2xs text-$house-detail-navigation-badge-color font-normal leading-4">管理</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-detail-navigation {
  height: var(--house-detail-navigation-height);
  padding: calc(var(--house-detail-navigation-top-inset) + 8px) var(--house-detail-navigation-right-inset) 8px 24rpx;
}

.house-detail-navigation__hero-background,
.house-detail-navigation__scrolled-background {
  @apply absolute;
  @apply z-0;
  @apply top-0;
  @apply right-0;
  @apply bottom-0;
  @apply left-0;
  @apply pointer-events-none;
  transition: opacity var(--app-motion-duration-fast) linear;
}

.house-detail-navigation__hero-background {
  background: linear-gradient(180deg, rgba(4, 18, 32, 0.5), rgba(4, 18, 32, 0));
}

.house-detail-navigation__back {
  top: var(--house-detail-navigation-control-top);
}

.house-detail-navigation__back::after {
  @apply border-0;
}
.house-detail-navigation__title {
  top: var(--house-detail-navigation-top-inset);
  right: var(--house-detail-navigation-right-inset);
  left: var(--house-detail-navigation-right-inset);
}
</style>
