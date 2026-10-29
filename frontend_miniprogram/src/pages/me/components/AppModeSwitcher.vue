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
    { key: 'organization', label: '经纪人', visible: options.some(option => option.selection.mode === 'organization'), active: appContextStore.mode === 'organization' },
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
      class="navigation-trigger m-0 max-w-full w-auto flex items-center overflow-hidden rounded-1.5 p-0 text-left leading-none"
      role="button"
      :tabindex="canSwitch ? 0 : -1"
      :class="{ 'navigation-trigger--switchable': canSwitch }"
      :disabled="!canSwitch"
      :aria-disabled="!canSwitch"
      :aria-label="canSwitch ? `当前身份：${appContextStore.modePresentation.title}，点击切换` : `当前身份：${appContextStore.modePresentation.title}`"
      @click="openSwitcher"
      @keydown="handleActionKeydown($event, openSwitcher)"
    >
      <view class="navigation-trigger__pill box-border max-w-full min-h-7 flex items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1">
        <view class="navigation-trigger__identity h-3.5 w-3.5 flex flex-none items-center justify-center rounded-full">
          <view class="navigation-trigger__glyph text-size-xs" :class="currentModeIconClass" />
        </view>
        <text class="navigation-trigger__title max-w-55 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs font-medium leading-tight">{{ appContextStore.modePresentation.title }}</text>
        <view v-if="canSwitch" class="navigation-trigger__arrow i-carbon-chevron-down flex-none text-size-2xs" />
      </view>
    </button>
    <view v-else-if="showTrigger && variant === 'cell'" class="mode-cell box-border min-h-15 flex items-center gap-2.5 rounded-4 p-3" @click="openSwitcher">
      <view class="mode-cell__chips min-w-0 flex flex-1 gap-3">
        <view v-for="item in identityKinds" :key="item.key" class="mode-cell__chip box-border h-7 min-w-17 flex items-center justify-center rounded-3 px-2 py-0 text-size-2xs font-bold" :class="{ 'mode-cell__chip--active': item.active }">
          {{ item.label }}
        </view>
      </view>
      <text class="mode-cell__status flex-none text-size-2xs font-bold">{{ canSwitch ? '当前' : '当前身份' }}</text>
    </view>
    <view v-else-if="showTrigger && canSwitch" class="compact-trigger h-6 flex flex-none items-center gap-1 rounded-full px-2 py-0" @click="openSwitcher">
      <view class="compact-trigger__icon i-carbon-arrows-horizontal text-size-2xs" />
      <text class="compact-trigger__text text-size-2xs font-semibold">切换</text>
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
        <view class="workspace-switcher__header min-h-9.5 flex flex-col justify-center pr-9">
          <text class="workspace-switcher__title text-size-lg font-extrabold leading-tight">选择身份</text>
        </view>
      </template>

      <view class="workspace-switcher box-border px-0 pb-1.5 pt-0.5">
        <view class="workspace-switcher__section-heading mx-0.5 mb-2 mt-1.5 flex items-center justify-between">
          <text class="workspace-switcher__section-title text-size-2xs font-bold">切换到</text>
          <text class="workspace-switcher__count text-size-2xs font-semibold">{{ otherModeOptions.length }} 个可切换</text>
        </view>

        <view class="workspace-list flex flex-col gap-2">
          <button
            v-for="option in otherModeOptions"
            :key="option.key"
            class="workspace-option m-0 box-border min-h-14.5 w-full flex items-center gap-2.5 rounded-4 px-2.5 py-2.5 text-left leading-normal shadow-app-card"
            role="button"
            :tabindex="switchingKey ? -1 : 0"
            :class="{ 'workspace-option--switching': switchingKey === option.key }"
            :disabled="Boolean(switchingKey)"
            :aria-disabled="Boolean(switchingKey)"
            :aria-label="`切换到${option.title}`"
            @click="handleSelect(option)"
            @keydown="handleActionKeydown($event, () => handleSelect(option))"
          >
            <view class="workspace-option__icon h-9 w-9 flex flex-none items-center justify-center rounded-3 text-size-base">
              <view :class="getModeIconClass(option)" />
            </view>
            <view class="workspace-option__main min-w-0 flex flex-1 flex-col overflow-hidden">
              <text class="workspace-option__title break-all text-size-xs font-bold leading-tight">{{ option.title }}</text>
              <text class="workspace-option__description mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs leading-snug">{{ option.description }}</text>
            </view>
            <view class="workspace-option__trail h-5.5 w-5.5 flex flex-none items-center justify-center text-size-sm">
              <wd-loading v-if="switchingKey === option.key" type="spinner" size="34rpx" color="#0081ff" />
              <view v-else class="i-carbon-chevron-right" />
            </view>
          </button>
        </view>
      </view>
    </AppBottomSheet>
  </view>
</template>

<style scoped>
/* #ifdef H5 */
button[role='button']:focus-visible {
  outline: 2px solid var(--app-color-brand-active);
  outline-offset: -4px;
}
/* #endif */
.navigation-trigger {
  height: 44px;
  min-height: 44px;
  @apply border-0 text-content-secondary bg-transparent;
}
.navigation-trigger__pill {
  border: 1rpx solid rgb(217 227 240 / 40%);
  background: rgb(255 255 255 / 50%);
  backdrop-filter: var(--app-navigation-backdrop-filter);
  transition:
    transform var(--app-motion-duration-fast) var(--app-motion-ease-out),
    box-shadow var(--app-motion-duration-base) ease,
    background-color var(--app-motion-duration-base) ease;
  -webkit-backdrop-filter: var(--app-navigation-backdrop-filter);
}
.navigation-trigger::after {
  @apply border-0;
}
.navigation-trigger--switchable:active {
  @apply opacity-76;
}
.navigation-trigger:disabled {
  @apply text-content-secondary opacity-100;
}
.navigation-trigger__identity {
  @apply text-content-muted;
}
.navigation-trigger__title {
  @apply text-inherit;
}
.navigation-trigger__arrow {
  @apply text-content-muted;
}
.mode-cell {
  border: 1rpx solid rgb(217 227 240 / 35%);
  @apply bg-surface-card;
}
.mode-cell__chip {
  @apply border-hairline border-solid border-app-border text-content-secondary bg-surface-subtle;
}
.mode-cell__chip--active {
  @apply border-app-border-brand-soft text-app-brand-active bg-surface-brand-soft;
}
.mode-cell__status {
  @apply text-app-brand-active;
}
.compact-trigger {
  @apply border-hairline border-solid border-app-border text-content-secondary bg-surface-translucent;
}
.compact-trigger:active {
  @apply border-app-border-brand-soft text-app-brand-active bg-surface-brand-soft;
}
.workspace-switcher__title {
  @apply text-content-primary;
  letter-spacing: -1rpx;
}
.workspace-switcher__section-title {
  @apply text-content-secondary;
}
.workspace-switcher__count {
  @apply text-content-muted;
}
.workspace-option {
  @apply border-hairline border-solid border-app-card text-content-primary;
  background: rgb(255 255 255 / 92%);
  transition:
    transform var(--app-motion-duration-fast) var(--app-motion-ease-out),
    border-color var(--app-motion-duration-base) ease,
    background-color var(--app-motion-duration-base) ease;
}
.workspace-option::after {
  @apply border-0;
}
.workspace-option:active {
  transform: scale(0.985);
}
.workspace-option:disabled:not(.workspace-option--switching) {
  @apply opacity-46;
}
.workspace-option--switching {
  @apply border-app-border-brand-soft opacity-100 bg-surface-brand-soft;
}
.workspace-option__icon {
  @apply text-app-brand-active bg-surface-brand-soft;
}
.workspace-option__title {
  @apply text-content-primary;
  overflow-wrap: anywhere;
}
.workspace-option__description {
  @apply text-content-muted;
}
.workspace-option__trail {
  @apply text-content-muted;
}
</style>
