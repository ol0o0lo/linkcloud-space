<script setup lang="ts">
withDefaults(defineProps<{
  tabbar?: boolean
}>(), {
  tabbar: false,
})
</script>

<template>
  <view class="app-page">
    <slot name="navigation" />
    <view class="app-page__content" :class="{ 'app-page__content--tabbar': tabbar }">
      <slot />
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  min-height: 100vh;
  background: var(--app-bg-page);
  box-sizing: border-box;
}

.app-page__content {
  min-height: inherit;
  padding: var(--app-page-gutter);
  box-sizing: border-box;
}

.app-page__content--tabbar {
  /* Tabbar 自带 placeholder 与底部安全区；页面只保留内容间距，避免重复留白。 */
  padding-bottom: var(--app-page-gutter);
}
</style>
