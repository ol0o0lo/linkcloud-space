<script setup lang="ts">
import { computed, ref } from 'vue'
import { getDefaultRouteForMode } from '@/modules/registry'
import AppCustomNavigation from '@/shared/components/AppCustomNavigation.vue'
import { useAppContextStore } from '@/store/app-context-v2'

withDefaults(defineProps<{
  variant?: 'compact' | 'cell' | 'navigation'
}>(), {
  variant: 'compact',
})

const appContextStore = useAppContextStore()
const visible = ref(false)
const switchingKey = ref('')
const canSwitch = computed(() => appContextStore.modeOptions.length > 1)
const actions = computed(() => appContextStore.modeOptions.map(option => ({
  name: option.active ? `✓ ${option.title}` : option.title,
  description: option.description,
  color: option.active ? 'var(--app-color-brand-active)' : undefined,
  loading: switchingKey.value === option.key,
  disabled: Boolean(switchingKey.value) && switchingKey.value !== option.key,
})))

function openSwitcher() {
  if (canSwitch.value)
    visible.value = true
}

async function handleSelect({ index }: { index: number }) {
  if (switchingKey.value)
    return
  const option = appContextStore.modeOptions[index]
  if (!option)
    return
  if (option.active) {
    visible.value = false
    return
  }

  switchingKey.value = option.key
  try {
    await appContextStore.switchMode(option.selection)
    visible.value = false
    uni.reLaunch({ url: getDefaultRouteForMode(appContextStore.mode) })
  }
  catch {
    uni.showToast({ title: '身份切换失败，请稍后重试', icon: 'none' })
  }
  finally {
    switchingKey.value = ''
  }
}
</script>

<template>
  <view class="app-mode-switcher">
    <wd-cell
      v-if="variant === 'cell'"
      :title="appContextStore.modePresentation.title"
      :label="appContextStore.modePresentation.description"
      :value="canSwitch ? '切换' : '当前身份'"
      :is-link="canSwitch"
      :clickable="canSwitch"
      @click="openSwitcher"
    />
    <AppCustomNavigation
      v-else-if="variant === 'navigation'"
      :title="appContextStore.modePresentation.title"
      :subtitle="appContextStore.modePresentation.description"
      :clickable="canSwitch"
      @click="openSwitcher"
    />
    <view v-else class="compact-trigger" :class="{ 'compact-trigger--static': !canSwitch }" @click="openSwitcher">
      <view class="identity-icon i-carbon-switcher" />
      <view class="identity-copy">
        <text class="identity-title">
          {{ appContextStore.modePresentation.title }}
        </text>
        <text class="identity-description">
          {{ appContextStore.modePresentation.description }}
        </text>
      </view>
      <view v-if="canSwitch" class="identity-arrow i-carbon-chevron-down" />
    </view>

    <wd-action-sheet
      v-model="visible"
      title="切换身份"
      cancel-text="取消"
      :actions="actions"
      :close-on-click-action="false"
      :z-index="1200"
      root-portal
      @select="handleSelect"
    />
  </view>
</template>

<style scoped lang="scss">
.compact-trigger {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
  padding: 20rpx 22rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 22rpx;
  background: var(--app-bg-elevated-translucent);
  box-shadow: var(--app-shadow-card);
}
.compact-trigger--static {
  border-color: transparent;
}
.identity-icon,
.identity-arrow {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 34rpx;
}
.identity-arrow {
  font-size: 28rpx;
}
.identity-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}
.identity-title,
.identity-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.identity-title {
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 600;
}
.identity-description {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
</style>
