<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { createSaaSWorkspace } from '@/features/saas/service'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '开通中介工作台' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const submitting = ref(false)
const redirecting = ref(false)
const organizationName = ref('')
const businessType = ref<'individual' | 'store'>('store')
const cityName = ref('')
const teamSizeBand = ref<'1' | '2_10' | '11_50' | '51_plus'>('2_10')
const phoneVerified = computed(() => appContextStore.user?.phone_verified === true)

function ensureReady() {
  if (redirecting.value)
    return false
  if (!appContextStore.authenticated) {
    redirecting.value = true
    uni.redirectTo({ url: getLoginRoute(APP_ROUTES.saasOnboarding) })
    return false
  }
  if (!phoneVerified.value) {
    redirecting.value = true
    uni.redirectTo({ url: `${APP_ROUTES.phoneVerification}?redirect=${encodeURIComponent(APP_ROUTES.saasOnboarding)}` })
    return false
  }
  return true
}

async function submit() {
  if (!ensureReady() || submitting.value)
    return
  if (!organizationName.value.trim()) {
    toast.warning('请填写门店或工作空间名称')
    return
  }
  if (!cityName.value.trim()) {
    toast.warning('请填写所在城市')
    return
  }
  submitting.value = true
  try {
    const result = await createSaaSWorkspace({
      name: organizationName.value.trim(),
      business_type: businessType.value,
      city_name: cityName.value.trim(),
      team_size_band: teamSizeBand.value,
      source: 'miniprogram_saas',
    })
    await appContextStore.refreshAuthenticatedContext()
    await appContextStore.switchMode({ mode: 'organization', organizationSlug: result.slug })
    const trialText = result.trial?.granted ? `已开通${result.trial.plan_name} 14 天试用。` : '工作台已创建。'
    await uni.showModal({ title: '开通成功', content: `${trialText} 接下来录入第一套房源，完成激活任务。`, showCancel: false, confirmText: '进入工作台' })
    uni.reLaunch({ url: APP_ROUTES.organizationRental })
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '工作台开通失败')
  }
  finally {
    submitting.value = false
  }
}

onShow(() => {
  redirecting.value = false
  ensureReady()
})
</script>

<template>
  <view class="onboarding-page">
    <AppCustomNavigation title="开通中介工作台" back scroll-mode="sticky" />
    <wd-toast />
    <view class="intro-card">
      <wd-tag type="success" variant="soft">
        14 天专业版试用
      </wd-tag>
      <strong>先把门店跑起来，再决定是否购买</strong>
      <text>创建后立即获得房源、带看、租约、成员协作和经营分析能力。</text>
    </view>

    <view class="form-card">
      <view class="field-block">
        <view class="field-label">
          经营类型
        </view>
        <wd-radio-group v-model="businessType" type="button" direction="horizontal">
          <wd-radio value="individual">
            独立中介
          </wd-radio>
          <wd-radio value="store">
            中介门店
          </wd-radio>
        </wd-radio-group>
      </view>
      <wd-input v-model="organizationName" label="名称" clearable placeholder="例如：向阳房产城西店" />
      <wd-input v-model="cityName" label="所在城市" clearable placeholder="例如：杭州" />
      <view class="field-block">
        <view class="field-label">
          团队规模
        </view>
        <wd-radio-group v-model="teamSizeBand" type="button" direction="vertical">
          <wd-radio value="1">
            1 人
          </wd-radio>
          <wd-radio value="2_10">
            2～10 人
          </wd-radio>
          <wd-radio value="11_50">
            11～50 人
          </wd-radio>
          <wd-radio value="51_plus">
            51 人以上
          </wd-radio>
        </wd-radio-group>
      </view>
      <wd-button block size="large" :loading="submitting" :disabled="submitting" @click="submit">
        免费开通并开始试用
      </wd-button>
      <text class="agreement-tip">提交即表示你同意平台按所选规模初始化工作空间；套餐到期后可选择购买或继续使用免费权益。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.onboarding-page {
  min-height: 100vh;
  padding: 0 24rpx 64rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.onboarding-page :deep(.app-custom-navigation) {
  margin: 0 -24rpx 24rpx;
}
.intro-card,
.form-card {
  padding: 30rpx;
  border-radius: 28rpx;
  background: var(--app-bg-card);
}
.intro-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  background: var(--app-gradient-profile);
}
.intro-card strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
  line-height: 1.35;
}
.intro-card text {
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.6;
}
.form-card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 20rpx;
}
.field-block {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.field-label {
  color: var(--app-text-primary);
  font-size: 25rpx;
  font-weight: 650;
}
.agreement-tip {
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1.5;
  text-align: center;
}
</style>
