<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  clickable?: boolean
  selected?: boolean
  disabled?: boolean
  variant?: 'default' | 'compact' | 'prominent'
}>(), {
  clickable: false,
  selected: false,
  disabled: false,
  variant: 'default',
})

const emit = defineEmits<{
  click: []
}>()

const slots = useSlots()
const cardClass = computed(() => [
  props.variant === 'compact' ? 'p-3' : props.variant === 'prominent' ? 'p-4' : 'p-4',
  props.clickable && !props.disabled ? 'app-touchable' : '',
  props.selected ? 'ring-2 ring-app-brand' : '',
  props.disabled ? 'opacity-55' : '',
])

function handleClick() {
  if (props.clickable && !props.disabled)
    emit('click')
}
</script>

<template>
  <view class="box-border app-card" :class="cardClass" @click="handleClick">
    <view v-if="slots.leading || slots.header || slots.title || slots.status" class="flex items-start gap-2">
      <slot name="leading" />
      <view class="min-w-0 flex-1">
        <slot name="header">
          <view class="app-row-between">
            <view class="min-w-0 flex-1 text-sm text-content-primary font-semibold">
              <slot name="title" />
            </view>
            <slot name="status" />
          </view>
        </slot>
      </view>
    </view>

    <view v-if="slots.default" :class="slots.leading || slots.header || slots.title || slots.status ? 'mt-1.5' : ''">
      <slot />
    </view>
    <view v-if="slots.description" class="mt-1.5 text-xs text-content-secondary leading-relaxed">
      <slot name="description" />
    </view>
    <view v-if="slots.meta" class="mt-2 text-xs text-content-muted">
      <slot name="meta" />
    </view>
    <view v-if="slots.footer || slots.actions" class="mt-2.5 app-row-between">
      <view class="min-w-0 flex-1">
        <slot name="footer" />
      </view>
      <view v-if="slots.actions" class="flex shrink-0 items-center gap-1.5" @click.stop>
        <slot name="actions" />
      </view>
    </view>
  </view>
</template>
