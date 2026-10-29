<script setup lang="ts">
import { computed } from 'vue'
import { tabbarList, tabbarStore } from './store'

// #ifdef MP-WEIXIN
// 将自定义节点设置成虚拟的（去掉自定义组件包裹层），更加接近Vue组件的表现，能更好的使用flex属性
defineOptions({
  virtualHost: true,
})
// #endif

const activePath = computed(() => tabbarStore.currentPath || tabbarList.value[0]?.pagePath || '')
const tabbarStyle = [
  '--wot-tabbar-height: var(--app-tabbar-height)',
  '--wot-tabbar-bg: var(--app-tabbar-background)',
  '--wot-tabbar-item-title-font-size: var(--app-tabbar-title-size)',
  '--wot-tabbar-item-title-line-height: var(--app-tabbar-title-line-height)',
].join(';')

function handleChange({ value }: { value: string | number }) {
  const url = String(value)
  if (url === tabbarStore.currentPath) {
    return
  }
  tabbarStore.setCurrentPath(url)
  uni.switchTab({ url })
}
// #ifndef MP-WEIXIN
onLoad(() => {
  uni.hideTabBar({
    fail(err) {
      console.log('hideTabBar fail: ', err)
    },
  })
})
// #endif
</script>

<template>
  <wd-tabbar
    :model-value="activePath"
    bordered safe-area-inset-bottom fixed
    custom-class="app-role-tabbar"
    :custom-style="tabbarStyle"
    :z-index="1000"
    active-color="var(--app-color-brand)"
    inactive-color="var(--app-tabbar-inactive-color)"
    @change="handleChange"
  >
    <wd-tabbar-item
      v-for="item in tabbarList"
      :key="item.slot"
      :name="item.pagePath"
      :title="item.text"
      :value="typeof item.badge === 'number' ? item.badge : undefined"
      :is-dot="item.badge === 'dot'"
    >
      <template #icon="{ active }">
        <view
          class="app-role-tabbar__icon leading-none"
          :class="[item.icon, { 'app-role-tabbar__icon--active': active }]"
        />
      </template>
    </wd-tabbar-item>
  </wd-tabbar>
</template>

<style scoped lang="scss">
.app-role-tabbar__icon {
  width: 1em;
  height: 1em;
  color: var(--app-tabbar-inactive-color);
  font-size: var(--app-tabbar-icon-size);
  transition: color 160ms ease;
}

.app-role-tabbar__icon--active {
  @apply text-app-brand;
}

:deep(.app-role-tabbar .wd-tabbar-item__body) {
  gap: 2rpx;
}
</style>
