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
    bordered safe-area-inset-bottom placeholder fixed
    :z-index="1000"
    active-color="var(--app-color-brand)"
    inactive-color="var(--app-text-secondary)"
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
      <template #icon>
        <view :class="item.icon" class="text-22px" />
      </template>
    </wd-tabbar-item>
  </wd-tabbar>
</template>
