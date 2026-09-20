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
  <view class="app-empty" :class="{ 'app-empty--compact': compact }">
    <wd-empty :icon="icon" :icon-size="resolvedIconSize" :tip="title" :custom-style="emptyStyle">
      <!-- @vue-ignore Wot UI 运行时支持 bottom 插槽，但当前组件类型未声明插槽。 -->
      <template #bottom>
        <view v-if="description || actionText || $slots.default" class="app-empty__bottom">
          <text v-if="description" class="app-empty__description">{{ description }}</text>
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
  display: flex;
  min-height: 360rpx;
  align-items: center;
  justify-content: center;
  padding: 36rpx 24rpx;
  box-sizing: border-box;
}

.app-empty--compact {
  min-height: 240rpx;
  padding: 24rpx;
}

.app-empty__bottom {
  display: flex;
  width: 100%;
  max-width: 560rpx;
  align-items: center;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 14rpx;
}

.app-empty__description {
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.65;
  text-align: center;
}

:deep(.app-empty__action) {
  min-width: 176rpx;
  padding-right: 28rpx;
  padding-left: 28rpx;
  box-shadow: 0 10rpx 24rpx rgb(0 129 255 / 14%);
}
</style>
