<script setup lang="ts">
import type { HouseOut } from '@/pages-org-rental/api/organization-rental'
import { computed } from 'vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { buildHouseCardModel } from '@/domain/house-card'

const props = withDefaults(defineProps<{
  house: HouseOut
  selectable?: boolean
  selected?: boolean
  disabled?: boolean
}>(), { selectable: false, selected: false, disabled: false })

defineEmits<{
  click: []
}>()

const model = computed(() => buildHouseCardModel(props.house))
</script>

<template>
  <view class="inventory-card rounded-3 p-3" :class="{ 'inventory-card--selected': selected, 'inventory-card--disabled': disabled }" role="button" :aria-label="`${model.title}，${model.statusLabel}`" :aria-disabled="disabled" :aria-pressed="selectable ? selected : undefined" hover-class="app-touchable--pressed" @click="!disabled && $emit('click')">
    <view class="inventory-main flex items-start gap-3">
      <view class="inventory-cover relative h-22 w-22 flex-none basis-22 overflow-hidden rounded-2">
        <image v-if="model.coverUrl" :src="model.coverUrl" mode="aspectFill" lazy-load />
        <view v-else class="inventory-placeholder h-full flex flex-col items-center justify-center gap-1.5 text-size-2xs text-content-muted">
          <view class="i-carbon-building" /><text>暂无图片</text>
        </view>
        <view v-if="selectable" class="inventory-selection absolute left-1.5 top-1.5 h-5 w-5 flex items-center justify-center rounded-full text-content-on-brand" :class="{ 'inventory-selection--checked': selected }">
          <view v-if="selected" class="i-carbon-checkmark" />
        </view>
      </view>
      <view class="inventory-copy min-w-0 flex-1">
        <view class="inventory-title text-size-sm text-content-primary font-semibold leading-normal">
          {{ model.title }}
        </view>
        <view class="inventory-facts mt-1.5 text-size-xs text-content-secondary leading-relaxed">
          {{ model.facts }}
        </view>
        <view class="inventory-status mt-1.5 flex flex-wrap items-center gap-1.5">
          <AppStatusTag :text="model.statusLabel" :tone="house.is_active ? model.statusTone === 'muted' ? 'default' : model.statusTone : 'default'" />
          <AppStatusTag v-for="label in model.auxiliaryLabels" :key="label" :text="label" />
          <text v-if="house.inspection_reasons?.length" class="inventory-warning text-size-2xs text-app-warning">资料待完善</text>
        </view>
      </view>
    </view>
    <view class="inventory-footer mt-3 flex flex-wrap items-center pt-2.5">
      <view class="inventory-rent flex gap-0.5 text-size-2xs text-app-price">
        <text v-if="model.hasRent">¥</text><strong>{{ model.rentAmountText }}</strong><text v-if="model.hasRent">/月</text>
      </view>
      <text class="inventory-deposit text-size-2xs text-content-muted">{{ model.depositText }}</text>
      <view class="inventory-open ml-auto flex items-center gap-0.5 text-size-xs text-app-brand-active">
        <text>{{ selectable ? selected ? '已选' : disabled ? '不可选' : '选择' : '管理' }}</text><view v-if="!selectable" class="i-carbon-chevron-right" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.inventory-card {
  @apply border-hairline border-solid border-app-card bg-surface-card;
}
.inventory-card--selected {
  @apply border-app-brand bg-surface-brand-soft;
}
.inventory-card--disabled {
  opacity: 0.55;
}
.inventory-cover {
  @apply bg-surface-subtle;
}
.inventory-cover image {
  @apply w-full h-full;
}
.inventory-placeholder > view {
  @apply text-size-xl;
}
.inventory-selection {
  @apply border-1 border-solid border-app-brand bg-surface-card;
}
.inventory-selection--checked {
  @apply bg-app-brand;
}
.inventory-title {
  overflow-wrap: anywhere;
}
.inventory-footer {
  gap: 8rpx 16rpx;
  @apply border-t-hairline border-t-solid border-t-app-divider;
}
.inventory-rent {
  align-items: baseline;
}
.inventory-rent strong {
  @apply text-size-lg;
  font-variant-numeric: tabular-nums;
}
</style>
