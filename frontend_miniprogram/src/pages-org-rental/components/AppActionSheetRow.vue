<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  description?: string
  danger?: boolean
  selected?: boolean
  disabled?: boolean
}>(), {
  description: '',
  danger: false,
  selected: false,
  disabled: false,
})

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  if (!props.disabled)
    emit('click')
}
</script>

<template>
  <button
    class="m-0 box-border min-h-12 w-full flex app-touchable items-center gap-2 border-0 border-b border-app-divider border-solid bg-surface-card px-2.5 py-2 text-left after:border-0 last:border-b-0 disabled:opacity-45"
    :class="selected ? 'bg-surface-brand-soft' : ''"
    :disabled="disabled"
    @click="handleClick"
  >
    <view v-if="$slots.icon" class="w-5 shrink-0 text-base" :class="danger ? 'text-app-danger' : 'text-content-secondary'">
      <slot name="icon" />
    </view>
    <view class="min-w-0 flex-1">
      <view class="text-xs font-semibold" :class="danger ? 'text-app-danger' : selected ? 'text-app-brand' : 'text-content-primary'">
        {{ title }}
      </view>
      <view v-if="description" class="mt-0.5 text-2xs text-content-muted">
        {{ description }}
      </view>
    </view>
    <slot name="trailing">
      <text class="text-sm" :class="selected ? 'i-carbon-checkmark-filled text-app-brand' : 'i-carbon-chevron-right text-content-disabled'" />
    </slot>
  </button>
</template>
