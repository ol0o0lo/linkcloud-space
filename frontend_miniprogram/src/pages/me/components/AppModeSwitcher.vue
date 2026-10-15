<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AppModeOption, AppModeSelection } from '@/domain/app-mode'
import { getDefaultRouteForMode } from '@/modules/registry'
import { useAppContextStore } from '@/store/app-context-v2'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'

const props = withDefaults(defineProps<{
  variant?: 'compact' | 'cell' | 'navigation'
  options?: readonly AppModeOption[]
  showTrigger?: boolean
}>(), {
  variant: 'compact',
  showTrigger: true,
})

const emit = defineEmits<{
  switched: [selection: AppModeSelection]
  cancel: []
  failed: [cause: unknown]
}>()
const appContextStore = useAppContextStore()
const visible = ref(false)
const switchingKey = ref('')
const currentModeOption = computed(() => appContextStore.modeOptions.find(option => option.active))
const availableOptions = computed(() => props.options || appContextStore.modeOptions)
const otherModeOptions = computed(() => availableOptions.value.filter(option => !option.active))
const canSwitch = computed(() => otherModeOptions.value.length > 0)
const currentModeIconClass = computed(() => {
  if (currentModeOption.value)
    return getModeIconClass(currentModeOption.value)
  if (appContextStore.mode === 'landlord')
    return 'i-carbon-home'
  if (appContextStore.mode === 'organization')
    return 'i-carbon-building'
  return 'i-carbon-search-locate'
})
const identityKinds = computed(() => {
  const options = appContextStore.modeOptions
  return [
    { key: 'personal', label: '租客', visible: options.some(option => option.selection.mode === 'personal'), active: appContextStore.mode === 'personal' },
    { key: 'landlord', label: '房东', visible: options.some(option => option.selection.mode === 'landlord'), active: appContextStore.mode === 'landlord' },
    { key: 'organization', label: '中介组织', visible: options.some(option => option.selection.mode === 'organization'), active: appContextStore.mode === 'organization' },
  ].filter(item => item.visible)
})

function openSwitcher() {
  if (canSwitch.value) {
    visible.value = true
  }
}

defineExpose({ open: openSwitcher })
watch(visible, (value, previous) => {
  if (!value && previous) {
    if (switchingKey.value)
      visible.value = true
    else
      emit('cancel')
  }
}, { flush: 'sync' })

function handleActionKeydown(event: KeyboardEvent, action: () => void) {
  // #ifdef H5
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  if (!event.repeat)
    action()
  // #endif
}

function getModeIconClass(option: AppModeOption) {
  if (option.selection.mode === 'landlord')
    return 'i-carbon-home'
  if (option.selection.mode === 'organization')
    return 'i-carbon-building'
  return 'i-carbon-search-locate'
}

async function handleSelect(option: AppModeOption) {
  if (switchingKey.value)
    return
  if (option.active) {
    visible.value = false
    return
  }

  switchingKey.value = option.key
  try {
    await appContextStore.switchMode(option.selection)
    emit('switched', option.selection)
    switchingKey.value = ''
    visible.value = false
    if (option.selection.mode === 'organization')
      uni.switchTab({ url: getDefaultRouteForMode('organization') })
  }
  catch (cause) {
    emit('failed', cause)
    uni.showToast({ title: '切换失败，请稍后重试', icon: 'none' })
  }
  finally {
    switchingKey.value = ''
  }
}
</script>

<template>
  <view v-if="variant !== 'compact' || canSwitch" class="app-mode-switcher">
    <button
      v-if="showTrigger && variant === 'navigation'"
      class="navigation-trigger"
      role="button"
      :tabindex="canSwitch ? 0 : -1"
      :class="{ 'navigation-trigger--switchable': canSwitch }"
      :disabled="!canSwitch"
      :aria-disabled="!canSwitch"
      :aria-label="canSwitch ? `当前身份：${appContextStore.modePresentation.title}，点击切换` : `当前身份：${appContextStore.modePresentation.title}`"
      @click="openSwitcher"
      @keydown="handleActionKeydown($event, openSwitcher)"
    >
      <view class="navigation-trigger__pill">
        <view class="navigation-trigger__identity">
          <view class="navigation-trigger__glyph" :class="currentModeIconClass" />
        </view>
        <text class="navigation-trigger__title">{{ appContextStore.modePresentation.title }}</text>
        <view v-if="canSwitch" class="navigation-trigger__arrow i-carbon-chevron-down" />
      </view>
    </button>
    <view v-else-if="showTrigger && variant === 'cell'" class="mode-cell" @click="openSwitcher">
      <view class="mode-cell__chips">
        <view v-for="item in identityKinds" :key="item.key" class="mode-cell__chip" :class="{ 'mode-cell__chip--active': item.active }">
          {{ item.label }}
        </view>
      </view>
      <text class="mode-cell__status">{{ canSwitch ? '当前' : '当前身份' }}</text>
    </view>
    <view v-else-if="showTrigger && canSwitch" class="compact-trigger" @click="openSwitcher">
      <view class="compact-trigger__icon i-carbon-arrows-horizontal" />
      <text class="compact-trigger__text">切换</text>
    </view>

    <AppBottomSheet
      v-model:visible="visible"
      :z-index="1200"
      height="default"
      show-handle
      :close-on-click-modal="!switchingKey"
      modal-style="background: rgba(15, 34, 51, 0.38); backdrop-filter: blur(18rpx) saturate(1.08); -webkit-backdrop-filter: blur(18rpx) saturate(1.08);"
      custom-style="--wot-popup-bg: linear-gradient(180deg, #fbfdff 0%, #f2f8ff 100%); --wot-popup-radius: 48rpx; --wot-popup-close-margin: 34rpx; --wot-popup-close-size: 38rpx;"
    >
      <template #header>
        <view class="workspace-switcher__header">
          <text class="workspace-switcher__title">选择身份</text>
        </view>
      </template>

      <view class="workspace-switcher">
        <view class="workspace-switcher__section-heading">
          <text class="workspace-switcher__section-title">切换到</text>
          <text class="workspace-switcher__count">{{ otherModeOptions.length }} 个可切换</text>
        </view>

        <view class="workspace-list">
          <button
            v-for="option in otherModeOptions"
            :key="option.key"
            class="workspace-option"
            role="button"
            :tabindex="switchingKey ? -1 : 0"
            :class="{ 'workspace-option--switching': switchingKey === option.key }"
            :disabled="Boolean(switchingKey)"
            :aria-disabled="Boolean(switchingKey)"
            :aria-label="`切换到${option.title}`"
            @click="handleSelect(option)"
            @keydown="handleActionKeydown($event, () => handleSelect(option))"
          >
            <view class="workspace-option__icon">
              <view :class="getModeIconClass(option)" />
            </view>
            <view class="workspace-option__main">
              <text class="workspace-option__title">{{ option.title }}</text>
              <text class="workspace-option__description">{{ option.description }}</text>
            </view>
            <view class="workspace-option__trail">
              <wd-loading v-if="switchingKey === option.key" type="spinner" size="34rpx" color="#0081ff" />
              <view v-else class="i-carbon-chevron-right" />
            </view>
          </button>
        </view>
      </view>
    </AppBottomSheet>
  </view>
</template>

<style scoped lang="scss">
/* #ifdef H5 */
button[role='button']:focus-visible {
  outline: 2px solid var(--app-color-brand-active);
  outline-offset: -4px;
}
/* #endif */
.navigation-trigger {
  display: flex;
  overflow: hidden;
  width: auto;
  max-width: 100%;
  height: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  align-items: center;
  border: 0;
  border-radius: 12rpx;
  color: var(--app-text-secondary);
  line-height: 1;
  text-align: left;
  background: transparent;
}
.navigation-trigger__pill {
  display: flex;
  overflow: hidden;
  max-width: 100%;
  min-height: 56rpx;
  padding: 8rpx 18rpx;
  align-items: center;
  gap: 12rpx;
  border: 1rpx solid rgb(217 227 240 / 40%);
  border-radius: 999rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 50%);
  backdrop-filter: var(--app-navigation-backdrop-filter);
  transition:
    transform var(--app-motion-duration-fast) var(--app-motion-ease-out),
    box-shadow var(--app-motion-duration-base) ease,
    background-color var(--app-motion-duration-base) ease;
  -webkit-backdrop-filter: var(--app-navigation-backdrop-filter);
}
.navigation-trigger::after {
  border: 0;
}
.navigation-trigger--switchable:active {
  opacity: 0.76;
}
.navigation-trigger:disabled {
  color: var(--app-text-secondary);
  opacity: 1;
}
.navigation-trigger__identity {
  display: flex;
  width: 26rpx;
  height: 26rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  color: var(--app-text-muted);
}
.navigation-trigger__glyph {
  font-size: 23rpx;
}
.navigation-trigger__title {
  overflow: hidden;
  min-width: 0;
  color: inherit;
  max-width: 440rpx;
  font-size: 22rpx;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.navigation-trigger__arrow {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.mode-cell {
  display: flex;
  min-height: 120rpx;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  border: 1rpx solid rgb(217 227 240 / 35%);
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.mode-cell__chips {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 24rpx;
}
.mode-cell__chip {
  display: flex;
  min-width: 136rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  padding: 0 16rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 24rpx;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  font-weight: 700;
  background: var(--app-bg-subtle);
}
.mode-cell__chip--active {
  border-color: var(--app-border-brand-soft);
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.mode-cell__status {
  flex: 0 0 auto;
  color: var(--app-color-brand-active);
  font-size: 22rpx;
  font-weight: 700;
}
.compact-trigger {
  display: flex;
  height: 48rpx;
  flex: 0 0 auto;
  align-items: center;
  gap: 6rpx;
  padding: 0 14rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 999rpx;
  color: var(--app-text-secondary);
  background: var(--app-bg-elevated-translucent);
}
.compact-trigger:active {
  border-color: var(--app-border-brand-soft);
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.compact-trigger__icon {
  font-size: 22rpx;
}
.compact-trigger__text {
  font-size: 20rpx;
  font-weight: 600;
}

.workspace-switcher__header {
  display: flex;
  min-height: 76rpx;
  flex-direction: column;
  justify-content: center;
  padding-right: 72rpx;
}
.workspace-switcher__title {
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 750;
  letter-spacing: -1rpx;
  line-height: 1.25;
}
.workspace-switcher {
  padding: 4rpx 0 12rpx;
  box-sizing: border-box;
}
.workspace-switcher__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12rpx 4rpx 16rpx;
}
.workspace-switcher__section-title {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  font-weight: 700;
}
.workspace-switcher__count {
  color: var(--app-text-muted);
  font-size: 19rpx;
  font-weight: 600;
}
.workspace-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.workspace-option {
  display: flex;
  width: 100%;
  min-height: 116rpx;
  margin: 0;
  padding: 18rpx 20rpx;
  align-items: center;
  gap: 20rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 30rpx;
  box-sizing: border-box;
  color: var(--app-text-primary);
  line-height: normal;
  text-align: left;
  background: rgb(255 255 255 / 92%);
  box-shadow: var(--app-shadow-card);
  transition:
    transform var(--app-motion-duration-fast) var(--app-motion-ease-out),
    border-color var(--app-motion-duration-base) ease,
    background-color var(--app-motion-duration-base) ease;
}
.workspace-option::after {
  border: 0;
}
.workspace-option:active {
  transform: scale(0.985);
}
.workspace-option:disabled:not(.workspace-option--switching) {
  opacity: 0.46;
}
.workspace-option--switching {
  border-color: var(--app-border-brand-soft);
  opacity: 1;
  background: var(--app-bg-brand-soft);
}
.workspace-option__icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  color: var(--app-color-brand-active);
  font-size: 32rpx;
  background: var(--app-bg-brand-soft);
}
.workspace-option__main {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.workspace-option__title {
  color: var(--app-text-primary);
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
  word-break: break-all;
}
.workspace-option__description {
  overflow: hidden;
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-option__trail {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  font-size: 30rpx;
}
</style>
