<script setup lang="ts">
import type { AccountSecurityOverview } from '@/features/account/security'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getAccountSecurityOverview } from '@/features/account/security'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationBarTitleText: '账号安全', navigationStyle: 'custom' } })

const overview = ref<AccountSecurityOverview | null>(null)
const loading = ref(false)
const loadError = ref('')

async function loadOverview() {
  loading.value = true
  loadError.value = ''
  try {
    overview.value = await getAccountSecurityOverview()
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '安全信息加载失败'
  }
  finally {
    loading.value = false
  }
}

onShow(() => void loadOverview())
</script>

<template>
  <AppPage variant="list" gutter="loose">
    <template #navigation>
      <AppCustomNavigation title="账号安全" back scroll-mode="sticky" />
    </template>
    <AppLoading v-if="loading && !overview" text="正在加载安全信息…" />
    <AppErrorView v-else-if="loadError && !overview" title="安全信息加载失败" :message="loadError" @retry="loadOverview" />
    <template v-else-if="overview">
      <view class="security-hero box-border min-h-28 flex items-center gap-3 rounded-5 bg-surface-card p-4">
        <view class="security-hero__icon flex items-center justify-center">
          <view class="i-carbon-security" />
        </view>
        <view><strong>多因素验证</strong><text>为登录和敏感操作增加额外保护</text></view>
        <wd-tag :type="overview.totpEnabled ? 'success' : 'warning'" variant="light">
          {{ overview.totpEnabled ? '动态验证码已启用' : '动态验证码未启用' }}
        </wd-tag>
      </view>

      <view class="section-title mx-0 mb-2.5 mt-6.5 text-size-base font-bold">
        验证方式
      </view>
      <view class="security-list flex flex-col gap-3">
        <view class="security-item box-border min-h-19 flex items-center gap-3 rounded-4 bg-surface-card p-3">
          <view class="security-item__icon security-item__icon--green flex items-center justify-center">
            <view class="i-carbon-two-factor-authentication" />
          </view>
          <view><strong>动态验证码（TOTP）</strong><text>{{ overview.totpEnabled ? '已启用，可在 PC 管理端的“账号安全”更新绑定' : '尚未启用，可在 PC 管理端的“账号安全”完成绑定' }}</text></view>
          <text class="security-item__arrow">›</text>
        </view>
        <view class="security-item box-border min-h-19 flex items-center gap-3 rounded-4 bg-surface-card p-3">
          <view class="security-item__icon security-item__icon--orange flex items-center justify-center">
            <view class="i-carbon-key" />
          </view>
          <view><strong>恢复码</strong><text>{{ overview.totpEnabled ? '用于无法获取动态验证码时恢复登录' : '启用动态验证码后生成恢复码' }}</text></view>
          <text class="security-item__arrow">›</text>
        </view>
        <view class="security-item box-border min-h-19 flex items-center gap-3 rounded-4 bg-surface-card p-3">
          <view class="security-item__icon flex items-center justify-center">
            <view class="i-carbon-fingerprint-recognition" />
          </view>
          <view><strong>通行密钥（Passkey）</strong><text>请前往 PC 管理端的“账号安全”管理</text></view>
          <text class="security-item__arrow">›</text>
        </view>
      </view>

      <AppNotice
        class="security-notice"
        tone="warning"
        title="修改前需要重新验证"
        description="修改验证方式前需要重新验证身份，可使用当前密码或已绑定的通行密钥。"
        compact
      />
      <AppNotice
        v-if="loadError"
        class="security-refresh-notice"
        tone="danger"
        title="安全信息刷新失败"
        description="当前展示上次成功加载的状态，可稍后重新加载。"
        action-text="重新加载"
        compact
        @action="loadOverview"
      />
    </template>
  </AppPage>
</template>

<style scoped>
.security-hero__icon,
.security-item__icon {
  @apply w-16 h-16 flex-none basis-16 rounded-4;
  color: #176fdb;
  @apply text-size-2xl;
  background: #eaf3ff;
  box-shadow: inset 0 0 0 1rpx rgba(23, 111, 219, 0.08);
}
.security-hero > view:nth-child(2),
.security-item > view:nth-child(2) {
  @apply flex min-w-0 flex-1 flex-col gap-1.5;
}
.security-hero strong,
.security-item strong {
  @apply text-content-primary text-size-sm;
}
.security-hero text,
.security-item text {
  @apply text-content-muted text-size-2xs leading-normal;
}
.security-item__icon {
  @apply w-11 h-11 basis-11 rounded-3 text-size-xl;
}
.security-hero__icon > view {
  @apply w-6.5 h-6.5;
}
.security-item__icon > view {
  @apply w-5 h-5;
}
.security-item__icon--green {
  color: #0b9a6e;
  background: #e8f8f1;
  box-shadow: inset 0 0 0 1rpx rgba(11, 154, 110, 0.1);
}
.security-item__icon--orange {
  color: #d77600;
  background: #fff3df;
  box-shadow: inset 0 0 0 1rpx rgba(215, 118, 0, 0.1);
}
.security-item__arrow {
  @apply text-app-brand !important;
  @apply text-size-lg !important;
}
.security-notice {
  @apply mt-6;
}
.security-refresh-notice {
  @apply mt-3.5;
}
</style>
