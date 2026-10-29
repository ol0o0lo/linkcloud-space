<script setup lang="ts">
import type { PublicHouseRegionSelection } from '@/domain/public-house-region'
import { APP_ROUTES } from '@/modules/routes'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

withDefaults(defineProps<{
  variant?: 'plain' | 'surface'
}>(), {
  variant: 'plain',
})

const emit = defineEmits<{
  change: [value: PublicHouseRegionSelection]
}>()

const regionStore = usePublicHouseRegionStore()

function openRegionSelector() {
  uni.navigateTo({
    url: APP_ROUTES.publicHouseCity,
    events: {
      change: (value: PublicHouseRegionSelection) => emit('change', value),
    },
  })
}
</script>

<template>
  <button
    class="public-house-region-trigger h-7.5 max-w-26 w-auto inline-flex shrink-0 app-touchable items-center gap-1 overflow-hidden border-0 rounded-full bg-transparent px-1.5 text-xs text-content-primary font-bold leading-none"
    :class="variant === 'surface' ? 'border border-solid border-app-card bg-surface-translucent px-2 shadow-app-card backdrop-blur-md' : ''"
    hover-class="app-touchable--pressed"
    aria-label="修改全局地区"
    @click="openRegionSelector"
  >
    <view class="i-carbon-location-filled shrink-0 text-sm text-app-brand" />
    <text class="min-w-0 truncate">{{ regionStore.label }}</text>
    <view class="i-carbon-chevron-down shrink-0 text-xs text-content-muted" />
  </button>
</template>

<style scoped lang="scss">
.public-house-region-trigger::after {
  @apply border-0;
}
</style>
