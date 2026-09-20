<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import AppLoading from './AppLoading.vue'

const props = withDefaults(defineProps<{
  title?: string
  caption?: string
  variant?: 'plain' | 'card' | 'notice' | 'warning' | 'private'
  collapsible?: boolean
  defaultExpanded?: boolean
  loading?: boolean
}>(), {
  title: '',
  caption: '',
  variant: 'card',
  collapsible: false,
  defaultExpanded: true,
  loading: false,
})

const slots = useSlots()
const expanded = ref(props.defaultExpanded)
const sectionClass = computed(() => ({
  plain: '',
  card: 'app-card p-3.5',
  notice: 'rounded-app-lg bg-surface-subtle p-3.5',
  warning: 'rounded-app-lg bg-surface-warm-soft p-3.5',
  private: 'app-card border border-solid border-app-divider p-3.5',
}[props.variant]))

function toggle() {
  if (props.collapsible)
    expanded.value = !expanded.value
}
</script>

<template>
  <view :class="sectionClass">
    <view
      v-if="title || caption || slots.icon || slots.title || slots.caption || slots.badge || slots.action"
      class="app-row-between"
      :class="collapsible ? 'app-touchable' : ''"
      @click="toggle"
    >
      <view class="min-w-0 flex items-start gap-1.5">
        <view v-if="slots.icon" class="mt-0.5 shrink-0 text-base text-app-brand">
          <slot name="icon" />
        </view>
        <view class="min-w-0 flex-1">
          <view class="flex items-center gap-1.5">
            <view class="app-section-title">
              <slot name="title">
                {{ title }}
              </slot>
            </view>
            <slot name="badge">
              <view v-if="variant === 'private'" class="flex items-center gap-1 text-2xs text-content-muted">
                <text class="i-carbon-locked" />
                <text>内部可见</text>
              </view>
            </slot>
          </view>
          <view v-if="caption || slots.caption" class="mt-1 text-xs text-content-muted leading-normal">
            <slot name="caption">
              {{ caption }}
            </slot>
          </view>
        </view>
      </view>
      <view class="shrink-0" @click.stop>
        <slot name="action" />
        <text v-if="collapsible" class="ml-1.5 text-sm text-content-muted" :class="expanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
      </view>
    </view>

    <view v-if="expanded" :class="title || caption || slots.title || slots.caption ? 'mt-2.5' : ''">
      <AppLoading v-if="loading" />
      <slot v-else />
    </view>
    <view v-if="expanded && slots.footer" class="mt-2.5">
      <slot name="footer" />
    </view>
  </view>
</template>
