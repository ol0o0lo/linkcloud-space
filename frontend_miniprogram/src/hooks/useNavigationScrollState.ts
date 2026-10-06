import { onShow } from '@dcloudio/uni-app'
import { nextTick, ref } from 'vue'
import { DEFAULT_NAVIGATION_FADE_DISTANCE, DEFAULT_NAVIGATION_SCROLL_THRESHOLD, getNavigationFadeOpacity, isNavigationScrolled } from '@/components/utils/navigation'

interface NavigationScrollStateOptions {
  threshold?: number
  fadeDistance?: number
}

export function useNavigationScrollState(options: NavigationScrollStateOptions = {}) {
  const threshold = options.threshold ?? DEFAULT_NAVIGATION_SCROLL_THRESHOLD
  const fadeDistance = options.fadeDistance ?? DEFAULT_NAVIGATION_FADE_DISTANCE
  const navigationScrolled = ref(false)
  const navigationOpacity = ref(1)
  const navigationProgress = ref(0)
  const navigationScrollTop = ref(0)

  // 微信小程序编译器需要页面 SFC 显式注册 onPageScroll；这里仅统一状态计算和事件处理。
  function handleNavigationScroll({ scrollTop }: { scrollTop: number }) {
    navigationScrollTop.value = scrollTop
    navigationScrolled.value = isNavigationScrolled(scrollTop, threshold)
    navigationOpacity.value = getNavigationFadeOpacity(scrollTop, fadeDistance)
    navigationProgress.value = 1 - navigationOpacity.value
  }

  onShow(() => {
    void nextTick(() => {
      uni.createSelectorQuery().selectViewport().scrollOffset((result) => {
        if (result && !Array.isArray(result) && typeof result.scrollTop === 'number')
          handleNavigationScroll({ scrollTop: result.scrollTop })
      }).exec()
    })
  })

  return {
    navigationScrolled,
    navigationOpacity,
    navigationProgress,
    navigationScrollTop,
    handleNavigationScroll,
  }
}
