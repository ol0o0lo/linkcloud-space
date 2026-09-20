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
    safe-area-inset-bottom
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
    <view class="box-border" :class="showHandle ? 'detail-sheet' : 'px-3.5 pb-3 pt-4'">
      <view v-if="showHandle" class="detail-sheet__handle" />
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

      <scroll-view v-if="scrollable" scroll-y :style="contentStyle">
        <slot />
      </scroll-view>
      <view v-else :style="contentStyle">
        <slot />
      </view>

      <view v-if="slots.footer" :class="footerDivider ? 'mt-2.5 border-0 border-t border-app-divider border-solid pt-2' : 'mt-2'">
        <slot name="footer" />
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.detail-sheet {
  padding: 8px 16px 28px;
}
.detail-sheet__handle {
  width: 32px;
  height: 4px;
  margin: 0 auto 7px;
  border-radius: 3px;
  background: #dbe1e9;
}
.detail-sheet__header {
  margin-bottom: 14px;
  padding-right: 32px;
}
.detail-sheet__title {
  min-height: 48px;
  display: flex;
  align-items: center;
  color: #182538;
  font-size: 18px;
  font-weight: 650;
}
.detail-sheet__description {
  color: #78869a;
  font-size: 12px;
  line-height: 18px;
}
</style>
