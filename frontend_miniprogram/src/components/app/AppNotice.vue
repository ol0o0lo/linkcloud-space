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
  <view class="app-notice" :class="[`app-notice--${tone}`, { 'app-notice--compact': compact }]">
    <view class="app-notice__icon">
      <view :class="resolvedIcon" />
    </view>
    <view class="app-notice__body">
      <view class="app-notice__title">
        {{ title }}
      </view>
      <view v-if="description" class="app-notice__description">
        {{ description }}
      </view>
      <slot />
      <view v-if="actionText || $slots.action" class="app-notice__action">
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

  display: flex;
  width: 100%;
  padding: 26rpx;
  align-items: flex-start;
  gap: 20rpx;
  border: 1rpx solid var(--app-notice-border);
  border-radius: 24rpx;
  box-sizing: border-box;
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
  padding: 20rpx 22rpx;
  gap: 16rpx;
  border-radius: 20rpx;
}

.app-notice__icon {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  color: var(--app-notice-color);
  font-size: 30rpx;
  background: var(--app-notice-icon-bg);
}

.app-notice--compact .app-notice__icon {
  width: 48rpx;
  height: 48rpx;
  flex-basis: 48rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
}

.app-notice__body {
  min-width: 0;
  flex: 1;
}

.app-notice__title {
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.45;
}

.app-notice--compact .app-notice__title {
  font-size: 25rpx;
}

.app-notice__description {
  margin-top: 8rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.65;
}

.app-notice--compact .app-notice__description {
  margin-top: 4rpx;
  font-size: 21rpx;
}

.app-notice__action {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
}
</style>
