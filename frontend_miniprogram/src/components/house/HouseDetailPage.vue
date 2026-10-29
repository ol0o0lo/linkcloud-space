<script setup lang="ts">
import AppAsyncContent from '@/components/app/AppAsyncContent.vue'
import AppPage from '@/components/app/AppPage.vue'
import HouseDetailNavigation from './HouseDetailNavigation.vue'

withDefaults(defineProps<{
  loading: boolean
  error?: string
  showActions?: boolean
  fallbackUrl: string
  management?: boolean
  scrolled?: boolean
  scrollProgress?: number
}>(), { error: '', showActions: true, management: false, scrolled: false, scrollProgress: 0 })

defineEmits<{ retry: [] }>()
</script>

<template>
  <AppPage class="house-detail-page" gutter="none">
    <slot name="feedback" />
    <HouseDetailNavigation
      :fallback-url="fallbackUrl"
      :management="management"
      :scrolled="scrolled || Boolean(error)"
      :scroll-progress="error ? 1 : scrollProgress"
    />
    <AppAsyncContent :loading="loading" :error="error" loading-text="正在加载房源…" error-title="房源加载失败" @retry="$emit('retry')">
      <slot name="hero" />
      <slot />
    </AppAsyncContent>
    <template #footer>
      <template v-if="showActions && !loading && !error">
        <view class="house-detail-page__action-space" />
        <view class="house-detail-page__actions fixed bottom-0 left-0 right-0 z-20 box-border border-t-1 border-t-hex-e1e7ee border-t-solid bg-hex-fff">
          <slot name="actions" />
        </view>
      </template>
    </template>
    <template #overlay>
      <slot name="overlay" />
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.house-detail-page {
  --app-bg-page: #f4f6f9;
  --app-text-primary: #182538;
  --app-text-secondary: #526177;
  --app-text-muted: #78869a;
  --house-line: #e7ecf2;
  @apply min-h-screen;
  @apply text-hex-182538;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  @apply leading-normal;
  @apply bg-hex-f4f6f9;
}
.house-detail-page__action-space {
  height: calc(68px + env(safe-area-inset-bottom));
}
.house-detail-page__actions {
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 14px #243c5504;
}
</style>
