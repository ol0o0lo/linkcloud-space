<script setup lang="ts">
import { computed } from 'vue'

export type AppNoticeTone = 'info' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  tone?: AppNoticeTone
  icon?: string
  actionText?: string
  compact?: boolean
}>(), {
  description: '',
  tone: 'info',
  icon: '',
  actionText: '',
  compact: false,
})

defineEmits<{
  action: []
}>()

const defaultIcons: Record<AppNoticeTone, string> = {
  info: 'i-carbon-information-filled',
  success: 'i-carbon-checkmark-filled',
  warning: 'i-carbon-warning-filled',
  danger: 'i-carbon-error-filled',
}

const resolvedIcon = computed(() => props.icon || defaultIcons[props.tone])
</script>

<template>
  <view class="app-notice box-border w-full flex items-start" :class="[`app-notice--${tone}`, { 'app-notice--compact': compact }]">
    <view class="app-notice__icon h-7 w-7 flex flex-none basis-7 items-center justify-center text-size-sm">
      <view :class="resolvedIcon" />
    </view>
    <view class="app-notice__body min-w-0 flex-1">
      <view class="app-notice__title text-size-sm text-content-primary font-bold leading-normal">
        {{ title }}
      </view>
      <view v-if="description" class="app-notice__description mt-1 text-size-xs text-content-secondary leading-relaxed">
        {{ description }}
      </view>
      <slot />
      <view v-if="actionText || $slots.action" class="app-notice__action mt-2 flex justify-end">
        <slot name="action">
          <wd-button size="mini" variant="text" :type="tone === 'info' ? 'primary' : tone" @click="$emit('action')">
            {{ actionText }}
          </wd-button>
        </slot>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-notice {
  --app-notice-color: var(--app-color-info);
  --app-notice-icon-bg: rgb(37 99 235 / 12%);
  --app-notice-bg: #f4f8ff;
  --app-notice-border: #cfe0fb;
  @apply p-3.5 gap-2.5;
  border: 1rpx solid var(--app-notice-border);
  @apply rounded-3;
  background: var(--app-notice-bg);
}

.app-notice--success {
  --app-notice-color: var(--app-color-success);
  --app-notice-icon-bg: rgb(31 157 104 / 12%);
  --app-notice-bg: #effaf5;
  --app-notice-border: #c7eadb;
}

.app-notice--warning {
  --app-notice-color: var(--app-color-warning);
  --app-notice-icon-bg: rgb(217 119 6 / 12%);
  --app-notice-bg: #fff8eb;
  --app-notice-border: #f2ddb8;
}

.app-notice--danger {
  --app-notice-color: var(--app-color-danger);
  --app-notice-icon-bg: rgb(209 67 67 / 12%);
  --app-notice-bg: #fff2f2;
  --app-notice-border: #f2cccc;
}

.app-notice--compact {
  @apply py-2.5 px-3 gap-2 rounded-2.5;
}

.app-notice__icon {
  @apply rounded-2;
  color: var(--app-notice-color);
  background: var(--app-notice-icon-bg);
}

.app-notice--compact .app-notice__icon {
  @apply w-6 h-6 basis-6 rounded-2 text-size-xs;
}

.app-notice--compact .app-notice__title {
  @apply text-size-xs;
}

.app-notice--compact .app-notice__description {
  @apply mt-0.5 text-size-2xs;
}
</style>
