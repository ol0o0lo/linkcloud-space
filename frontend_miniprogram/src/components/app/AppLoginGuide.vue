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
  <view class="login-guide">
    <view v-if="icon" class="login-guide__icon" :class="icon" />
    <view class="login-guide__title">
      {{ title }}
    </view>
    <view class="login-guide__description">
      {{ description }}
    </view>
    <wd-button block @click="openLogin">
      {{ actionText }}
    </wd-button>
  </view>
</template>

<style scoped lang="scss">
.login-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  padding: 54rpx 34rpx;
  border-radius: 28rpx;
  text-align: center;
  background: var(--app-bg-card);
}

.login-guide__icon {
  color: var(--app-color-brand);
  font-size: 72rpx;
}

.login-guide__title {
  color: var(--app-text-primary);
  font-size: 31rpx;
  font-weight: 700;
}

.login-guide__description {
  margin-bottom: 4rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  line-height: 1.7;
}
</style>
