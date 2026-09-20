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
      <view class="security-hero">
        <view class="security-hero__icon">
          <view class="i-carbon-security" />
        </view>
        <view><strong>多因素验证</strong><text>为登录和敏感操作增加额外保护</text></view>
        <wd-tag :type="overview.totpEnabled ? 'success' : 'warning'" variant="light">
          {{ overview.totpEnabled ? '已保护' : '待设置' }}
        </wd-tag>
      </view>

      <view class="section-title">
        验证方式
      </view>
      <view class="security-list">
        <view class="security-item">
          <view class="security-item__icon security-item__icon--green">
            <view class="i-carbon-two-factor-authentication" />
          </view>
          <view><strong>动态验证码（TOTP）</strong><text>{{ overview.totpEnabled ? '已启用，可在网页安全中心更新绑定' : '尚未启用，可在网页安全中心完成绑定' }}</text></view>
          <text class="security-item__arrow">›</text>
        </view>
        <view class="security-item">
          <view class="security-item__icon security-item__icon--orange">
            <view class="i-carbon-key" />
          </view>
          <view><strong>恢复码</strong><text>{{ overview.totpEnabled ? '用于无法获取动态验证码时恢复登录' : '启用动态验证码后生成恢复码' }}</text></view>
          <text class="security-item__arrow">›</text>
        </view>
        <view class="security-item">
          <view class="security-item__icon">
            <view class="i-carbon-fingerprint-recognition" />
          </view>
          <view><strong>通行密钥（Passkey）</strong><text>小程序暂不支持管理，网页端可用</text></view>
          <text class="security-item__arrow">›</text>
        </view>
      </view>

      <AppNotice
        class="security-notice"
        tone="warning"
        title="修改前需要重新验证"
        description="修改验证方式前需要输入当前密码；安全网页端也可使用已绑定通行密钥。"
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

<style scoped lang="scss">
.security-hero,
.security-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: var(--app-bg-card);
}
.security-hero {
  min-height: 224rpx;
  padding: 32rpx;
  border-radius: 40rpx;
  box-sizing: border-box;
}
.security-hero__icon,
.security-item__icon {
  display: flex;
  width: 128rpx;
  height: 128rpx;
  flex: 0 0 128rpx;
  align-items: center;
  justify-content: center;
  border-radius: 32rpx;
  color: #176fdb;
  font-size: 52rpx;
  background: #eaf3ff;
  box-shadow: inset 0 0 0 1rpx rgba(23, 111, 219, 0.08);
}
.security-hero > view:nth-child(2),
.security-item > view:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
}
.security-hero strong,
.security-item strong {
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.security-hero text,
.security-item text {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}
.section-title {
  margin: 52rpx 0 20rpx;
  font-size: 34rpx;
  font-weight: 700;
}
.security-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.security-item {
  min-height: 148rpx;
  padding: 24rpx;
  border-radius: 32rpx;
  box-sizing: border-box;
}
.security-item__icon {
  width: 88rpx;
  height: 88rpx;
  flex-basis: 88rpx;
  border-radius: 24rpx;
  font-size: 40rpx;
}
.security-hero__icon > view {
  width: 52rpx;
  height: 52rpx;
}
.security-item__icon > view {
  width: 40rpx;
  height: 40rpx;
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
  color: var(--app-color-brand) !important;
  font-size: 36rpx !important;
}
.security-notice {
  margin-top: 48rpx;
}
.security-refresh-notice {
  margin-top: 28rpx;
}
</style>
