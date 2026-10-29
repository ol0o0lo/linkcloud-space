<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
  iconSize?: string | number
  actionText?: string
  compact?: boolean
}>(), {
  description: '',
  icon: 'no-content',
  iconSize: '',
  actionText: '',
  compact: false,
})

defineEmits<{
  action: []
}>()

const resolvedIconSize = computed(() => props.iconSize || (props.compact ? 54 : 72))
const emptyStyle = computed(() => [
  '--wot-empty-text-color: var(--app-text-primary)',
  '--wot-empty-text-font-size: 30rpx',
  '--wot-empty-text-line-height: 1.45',
  '--wot-empty-text-font-weight: 700',
  '--wot-empty-text-margin-top: 20rpx',
  '--wot-empty-padding-bottom: 0',
].join(';'))
</script>

<template>
  <view class="app-empty box-border flex items-center justify-center" :class="{ 'app-empty--compact': compact }">
    <wd-empty :icon="icon" :icon-size="resolvedIconSize" :tip="title" :custom-style="emptyStyle">
      <!-- @vue-ignore Wot UI 运行时支持 bottom 插槽，但当前组件类型未声明插槽。 -->
      <template #bottom>
        <view v-if="description || actionText || $slots.default" class="app-empty__bottom mt-2 max-w-70 w-full flex flex-col items-center gap-2.5">
          <text v-if="description" class="app-empty__description text-center text-size-xs text-content-muted leading-relaxed">{{ description }}</text>
          <slot />
          <wd-button v-if="actionText" custom-class="app-empty__action" size="small" round @click="$emit('action')">
            {{ actionText }}
          </wd-button>
        </view>
      </template>
    </wd-empty>
  </view>
</template>

<style scoped lang="scss">
.app-empty {
  @apply min-h-45 py-4.5 px-3;
}

.app-empty--compact {
  @apply min-h-30 p-3;
}

:deep(.app-empty__action) {
  @apply min-w-22 pr-3.5;
  @apply pl-3.5;
  box-shadow: 0 10rpx 24rpx rgb(0 129 255 / 14%);
}
</style>
