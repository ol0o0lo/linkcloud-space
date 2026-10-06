<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppModeOption } from '@/domain/app-mode'
import { useAppContextStore } from '@/store/app-context-v2'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'

withDefaults(defineProps<{
  variant?: 'compact' | 'cell' | 'navigation'
}>(), {
  variant: 'compact',
})

const appContextStore = useAppContextStore()
const visible = ref(false)
const switchingKey = ref('')
const organizationExpanded = ref(true)
const currentModeOption = computed(() => appContextStore.modeOptions.find(option => option.active))
const otherModeOptions = computed(() => appContextStore.modeOptions.filter(option => !option.active))
const canSwitch = computed(() => otherModeOptions.value.length > 0)
const organizationModeOptions = computed(() => appContextStore.modeOptions.filter(option => option.selection.mode === 'organization'))
const switchableOrganizationModeOptions = computed(() => organizationModeOptions.value.filter(option => !option.active))
const hasOrganizationGroup = computed(() => organizationModeOptions.value.length > 1 && switchableOrganizationModeOptions.value.length > 0)
const standaloneModeOptions = computed(() => {
  if (!hasOrganizationGroup.value)
    return otherModeOptions.value
  return otherModeOptions.value.filter(option => option.selection.mode !== 'organization')
})
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
    organizationExpanded.value = true
    visible.value = true
  }
}

function toggleOrganizationGroup() {
  if (!switchingKey.value)
    organizationExpanded.value = !organizationExpanded.value
}

function getModeIconClass(option: AppModeOption) {
  if (option.selection.mode === 'landlord')
    return 'i-carbon-home'
  if (option.selection.mode === 'organization')
    return 'i-carbon-building'
  return 'i-carbon-search-locate'
}

function getOrganizationTitle(option: AppModeOption) {
  return option.title.replace(/^中介端\s*·\s*/, '')
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
    visible.value = false
  }
  catch {
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
      v-if="variant === 'navigation'"
      class="navigation-trigger"
      :class="{ 'navigation-trigger--switchable': canSwitch }"
      :disabled="!canSwitch"
      :aria-label="canSwitch ? `当前身份：${appContextStore.modePresentation.title}，点击切换` : `当前身份：${appContextStore.modePresentation.title}`"
      @click="openSwitcher"
    >
      <view class="navigation-trigger__identity">
        <view class="navigation-trigger__glyph" :class="currentModeIconClass" />
      </view>
      <text class="navigation-trigger__title">{{ appContextStore.modePresentation.title }}</text>
      <view v-if="canSwitch" class="navigation-trigger__arrow i-carbon-chevron-down" />
    </button>
    <view v-else-if="variant === 'cell'" class="mode-cell" @click="openSwitcher">
      <view class="mode-cell__chips">
        <view v-for="item in identityKinds" :key="item.key" class="mode-cell__chip" :class="{ 'mode-cell__chip--active': item.active }">
          {{ item.label }}
        </view>
      </view>
      <text class="mode-cell__status">{{ canSwitch ? '当前' : '当前身份' }}</text>
    </view>
    <view v-else-if="canSwitch" class="compact-trigger" @click="openSwitcher">
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
        <view
          v-if="currentModeOption"
          class="current-workspace"
        >
          <view class="current-workspace__decoration current-workspace__decoration--large" />
          <view class="current-workspace__decoration current-workspace__decoration--small" />
          <view class="current-workspace__icon">
            <view :class="getModeIconClass(currentModeOption)" />
          </view>
          <view class="current-workspace__main">
            <text class="current-workspace__label">正在使用</text>
            <text class="current-workspace__title">{{ currentModeOption.title }}</text>
            <text class="current-workspace__description">{{ currentModeOption.description }}</text>
          </view>
        </view>

        <view class="workspace-switcher__section-heading">
          <text class="workspace-switcher__section-title">切换到</text>
          <text class="workspace-switcher__count">{{ otherModeOptions.length }} 个可切换</text>
        </view>

        <view class="workspace-list">
          <button
            v-for="option in standaloneModeOptions"
            :key="option.key"
            class="workspace-option"
            :class="{ 'workspace-option--switching': switchingKey === option.key }"
            :disabled="Boolean(switchingKey)"
            :aria-label="`切换到${option.title}`"
            @click="handleSelect(option)"
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

          <view v-if="hasOrganizationGroup" class="organization-group">
            <button
              class="organization-group__trigger"
              :disabled="Boolean(switchingKey)"
              :aria-expanded="organizationExpanded"
              :aria-label="`${organizationExpanded ? '收起' : '展开'}中介端组织列表，共${organizationModeOptions.length}个可选组织`"
              @click="toggleOrganizationGroup"
            >
              <view class="organization-group__icon">
                <view class="i-carbon-building" />
              </view>
              <view class="organization-group__main">
                <text class="organization-group__title">中介端</text>
                <text class="organization-group__description">{{ organizationModeOptions.length }} 个可选组织</text>
              </view>
              <view
                class="organization-group__arrow i-carbon-chevron-down"
                :class="{ 'organization-group__arrow--expanded': organizationExpanded }"
              />
            </button>

            <view v-if="organizationExpanded" class="organization-group__list">
              <button
                v-for="option in organizationModeOptions"
                :key="option.key"
                class="organization-option"
                :class="{
                  'organization-option--active': option.active,
                  'organization-option--switching': switchingKey === option.key,
                }"
                :disabled="Boolean(switchingKey) || option.active"
                :aria-label="option.active ? `${getOrganizationTitle(option)}，当前组织` : `切换到${getOrganizationTitle(option)}`"
                @click="handleSelect(option)"
              >
                <view class="organization-option__main">
                  <text class="organization-option__title">{{ getOrganizationTitle(option) }}</text>
                  <text class="organization-option__description">{{ option.description }}</text>
                </view>
                <view class="organization-option__trail">
                  <wd-loading v-if="switchingKey === option.key" type="spinner" size="30rpx" color="#0081ff" />
                  <text v-else-if="option.active" class="organization-option__current">当前</text>
                  <view v-else class="i-carbon-chevron-right" />
                </view>
              </button>
            </view>
          </view>
        </view>
      </view>
    </AppBottomSheet>
  </view>
</template>

<style scoped lang="scss">
.navigation-trigger {
  display: flex;
  overflow: hidden;
  width: auto;
  max-width: 100%;
  height: 60rpx;
  min-height: 60rpx;
  margin: 0;
  padding: 6rpx 14rpx 6rpx 8rpx;
  align-items: center;
  gap: 10rpx;
  border: 1rpx solid rgb(255 255 255 / 76%);
  border-radius: 999rpx;
  color: var(--app-text-primary);
  line-height: 1;
  text-align: left;
  background: rgb(255 255 255 / 82%);
  box-shadow: var(--app-navigation-shadow);
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
  transform: scale(0.97);
  background: rgb(255 255 255 / 94%);
  box-shadow: var(--app-shadow-card);
}
.navigation-trigger:disabled {
  color: var(--app-text-primary);
  opacity: 1;
}
.navigation-trigger__identity {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.navigation-trigger__glyph {
  font-size: 23rpx;
}
.navigation-trigger__title {
  overflow: hidden;
  min-width: 0;
  color: inherit;
  font-size: 27rpx;
  font-weight: 700;
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
  min-height: 58vh;
  padding: 4rpx 0 12rpx;
  box-sizing: border-box;
}
.current-workspace {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 176rpx;
  align-items: center;
  gap: 22rpx;
  padding: 28rpx 24rpx;
  border-radius: 36rpx;
  box-sizing: border-box;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-brand);
  box-shadow: var(--app-shadow-hero-brand);
}
.current-workspace__decoration {
  position: absolute;
  border-radius: 999rpx;
  background: rgb(255 255 255 / 10%);
  pointer-events: none;
}
.current-workspace__decoration--large {
  width: 210rpx;
  height: 210rpx;
  top: -118rpx;
  right: -42rpx;
}
.current-workspace__decoration--small {
  width: 76rpx;
  height: 76rpx;
  right: 96rpx;
  bottom: -48rpx;
}
.current-workspace__icon {
  position: relative;
  z-index: 1;
  display: flex;
  width: 80rpx;
  height: 80rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(255 255 255 / 20%);
  border-radius: 26rpx;
  font-size: 38rpx;
  background: rgb(255 255 255 / 16%);
  backdrop-filter: blur(12rpx);
}
.current-workspace__main {
  position: relative;
  z-index: 1;
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.current-workspace__label {
  color: rgb(255 255 255 / 72%);
  font-size: 19rpx;
  font-weight: 650;
  line-height: 1.2;
}
.current-workspace__title {
  overflow: hidden;
  margin-top: 8rpx;
  color: inherit;
  font-size: 29rpx;
  font-weight: 750;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.current-workspace__description {
  overflow: hidden;
  margin-top: 8rpx;
  color: rgb(255 255 255 / 76%);
  font-size: 21rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-switcher__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 34rpx 4rpx 16rpx;
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
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.organization-group {
  overflow: hidden;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 30rpx;
  background: rgb(255 255 255 / 92%);
  box-shadow: var(--app-shadow-card);
}
.organization-group__trigger {
  display: flex;
  width: 100%;
  min-height: 108rpx;
  margin: 0;
  padding: 18rpx 20rpx;
  align-items: center;
  gap: 20rpx;
  border: 0;
  border-radius: 0;
  color: var(--app-text-primary);
  line-height: normal;
  text-align: left;
  background: var(--app-bg-brand-soft);
}
.organization-group__trigger::after,
.organization-option::after {
  border: 0;
}
.organization-group__trigger:active {
  background: var(--app-color-brand-soft);
}
.organization-group__trigger:disabled {
  color: var(--app-text-primary);
  opacity: 0.72;
}
.organization-group__icon {
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
.organization-group__main {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.organization-group__title {
  color: var(--app-text-primary);
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.3;
}
.organization-group__description {
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1.35;
}
.organization-group__arrow {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 28rpx;
  transition: transform var(--app-motion-duration-base) var(--app-motion-ease-out);
}
.organization-group__arrow--expanded {
  transform: rotate(180deg);
}
.organization-group__list {
  padding: 0 18rpx 12rpx 112rpx;
}
.organization-option {
  display: flex;
  width: 100%;
  min-height: 82rpx;
  margin: 0;
  padding: 12rpx 4rpx;
  align-items: center;
  gap: 12rpx;
  border: 0;
  border-bottom: 1rpx solid var(--app-divider-color);
  border-radius: 0;
  color: var(--app-text-primary);
  line-height: normal;
  text-align: left;
  background: transparent;
}
.organization-option:last-child {
  border-bottom: 0;
}
.organization-option:active:not(.organization-option--active) {
  background: var(--app-bg-brand-soft);
}
.organization-option:disabled {
  color: var(--app-text-primary);
  opacity: 0.46;
}
.organization-option--active:disabled,
.organization-option--switching:disabled {
  opacity: 1;
}
.organization-option__main {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.organization-option__title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.organization-option__description {
  overflow: hidden;
  margin-top: 5rpx;
  color: var(--app-text-muted);
  font-size: 18rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.organization-option__trail {
  display: flex;
  min-width: 54rpx;
  height: 40rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  color: var(--app-text-muted);
  font-size: 26rpx;
}
.organization-option__current {
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 17rpx;
  font-weight: 700;
  background: var(--app-bg-brand-soft);
}
</style>
