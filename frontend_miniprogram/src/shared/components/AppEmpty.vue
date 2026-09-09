<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  actionText?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <view class="app-empty">
    <wd-empty :tip="title" />
    <view v-if="description || actionText" class="app-empty__content">
      <text v-if="description" class="app-empty__description">{{ description }}</text>
      <wd-button v-if="actionText" size="small" variant="plain" @click="$emit('action')">
        {{ actionText }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-empty {
  display: flex;
  min-height: 320rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.app-empty__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  margin-top: -20rpx;
}

.app-empty__description {
  max-width: 560rpx;
  color: var(--app-text-muted);
  font-size: 25rpx;
  line-height: 1.7;
  text-align: center;
}
</style>
