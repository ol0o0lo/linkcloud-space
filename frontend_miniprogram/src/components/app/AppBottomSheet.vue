<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  description?: string
  height?: 'compact' | 'default' | 'tall'
  scrollable?: boolean
  closeOnClickModal?: boolean
  lockScroll?: boolean
  lazyRender?: boolean
  showHandle?: boolean
  footerDivider?: boolean
  panelHeight?: string
}>(), {
  title: '',
  description: '',
  height: 'default',
  scrollable: true,
  closeOnClickModal: true,
  lockScroll: true,
  lazyRender: true,
  showHandle: false,
  footerDivider: true,
  panelHeight: '',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'open': []
  'opened': []
  'close': []
  'closed': []
}>()

const attrs = useAttrs()
const slots = useSlots()
const contentStyle = computed(() => ({
  maxHeight: props.showHandle
    ? `min(${props.height === 'compact' ? '42vh' : props.height === 'tall' ? '84vh' : '68vh'}, calc(100vh - 180px))`
    : props.height === 'compact' ? '42vh' : props.height === 'tall' ? '84vh' : '68vh',
}))
</script>

<template>
  <wd-popup
    v-bind="attrs"
    :model-value="visible"
    position="bottom"
    round
    closable
    :safe-area-inset-bottom="!panelHeight"
    root-portal
    :close-on-click-modal="closeOnClickModal"
    :lock-scroll="lockScroll"
    :lazy-render="lazyRender"
    @update:model-value="emit('update:visible', $event)"
    @open="emit('open')"
    @opened="emit('opened')"
    @close="emit('close')"
    @closed="emit('closed')"
  >
    <view
      class="box-border"
      :class="[showHandle ? 'detail-sheet' : 'px-3.5 pb-3 pt-4', { 'bounded-sheet': panelHeight }]"
      :style="panelHeight ? { height: panelHeight, maxHeight: panelHeight } : undefined"
    >
      <view v-if="showHandle" class="detail-sheet__handle w-8 rounded-1" />
      <view class="sheet-fixed-region">
        <slot name="header">
          <view v-if="title || description" :class="showHandle ? 'detail-sheet__header' : 'mb-2.5 pr-6'">
            <view v-if="title" :class="showHandle ? 'detail-sheet__title' : 'text-base text-content-primary font-bold'">
              {{ title }}
            </view>
            <view v-if="description" :class="showHandle ? 'detail-sheet__description' : 'mt-1 text-xs text-content-muted leading-relaxed'">
              {{ description }}
            </view>
          </view>
        </slot>
      </view>

      <view v-if="slots.toolbar" class="sheet-fixed-region">
        <slot name="toolbar" />
      </view>

      <scroll-view v-if="scrollable" scroll-y :class="{ 'bounded-sheet__scroll': panelHeight }" :style="panelHeight ? undefined : contentStyle">
        <slot />
      </scroll-view>
      <view v-else :class="{ 'bounded-sheet__scroll': panelHeight }" :style="panelHeight ? undefined : contentStyle">
        <slot />
      </view>

      <view v-if="slots.footer" class="sheet-fixed-region" :class="footerDivider ? 'mt-2.5 border-0 border-t border-app-divider border-solid pt-2' : 'mt-2'">
        <slot name="footer" />
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.bounded-sheet {
  @apply flex flex-col overflow-hidden;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
.bounded-sheet__scroll {
  @apply flex-1 h-0 min-h-0 overflow-hidden;
}
.sheet-fixed-region,
.detail-sheet__handle {
  @apply shrink-0;
}
.detail-sheet {
  @apply pt-2 px-4 pb-7;
}
.detail-sheet__handle {
  @apply h-1 mt-0 mx-auto mb-2;
  background: #dbe1e9;
}
.detail-sheet__header {
  @apply mb-3.5 pr-8;
}
.detail-sheet__title {
  @apply min-h-12 flex items-center;
  color: #182538;
  @apply text-size-lg font-bold;
}
.detail-sheet__description {
  color: #78869a;
  @apply text-size-xs leading-4.5;
}
.detail-sheet.bounded-sheet {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
</style>
