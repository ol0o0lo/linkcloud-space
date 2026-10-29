<script setup lang="ts">
import { getLoginRoute } from '@/modules/routes'

const props = withDefaults(defineProps<{
  title: string
  description: string
  icon?: string
  actionText?: string
  redirect?: string
}>(), {
  icon: 'i-carbon-user-avatar',
  actionText: '登录 / 注册',
  redirect: '',
})

function openLogin() {
  uni.navigateTo({ url: getLoginRoute(props.redirect) })
}
</script>

<template>
  <view class="login-guide flex flex-col items-center gap-2.5 rounded-3.5 bg-surface-card px-4.5 py-7 text-center">
    <view v-if="icon" class="login-guide__icon text-size-4xl text-app-brand" :class="icon" />
    <view class="login-guide__title text-size-base text-content-primary font-bold">
      {{ title }}
    </view>
    <view class="login-guide__description mb-0.5 text-size-xs text-content-secondary leading-relaxed">
      {{ description }}
    </view>
    <wd-button block @click="openLogin">
      {{ actionText }}
    </wd-button>
  </view>
</template>
