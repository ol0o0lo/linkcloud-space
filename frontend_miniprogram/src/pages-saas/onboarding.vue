<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { createSaaSWorkspace } from '@/features/saas/service'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '开通经纪工作台' } })

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
    await uni.showModal({ title: '开通成功', content: `${trialText} 接下来可以录入第一套房源。`, showCancel: false, confirmText: '进入工作台' })
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
  <view class="onboarding-page box-border min-h-screen bg-surface-page px-3 pb-8 pt-0">
    <AppCustomNavigation title="开通经纪工作台" back scroll-mode="sticky" />
    <wd-toast />
    <view class="intro-card flex flex-col gap-1.5 border-hairline border-app-border-brand-soft rounded-xl border-solid p-3.5 bg-gradient-profile">
      <wd-tag type="success" variant="soft">
        符合条件可享 14 天专业版试用
      </wd-tag>
      <strong class="text-size-base text-content-primary leading-snug">创建工作空间，开始管理日常业务</strong>
      <text class="text-size-xs text-content-secondary leading-relaxed">集中管理房源、带看、租约和团队协作，功能与额度以当前套餐为准。</text>
    </view>

    <view class="form-card mt-2.5 flex flex-col gap-3 rounded-xl bg-surface-card p-3.5">
      <view class="field-block flex flex-col gap-1.5">
        <view class="field-label text-size-xs text-content-primary font-semibold">
          经营类型
        </view>
        <wd-radio-group v-model="businessType" type="button" direction="horizontal">
          <wd-radio value="individual">
            独立经纪人
          </wd-radio>
          <wd-radio value="store">
            经纪门店
          </wd-radio>
        </wd-radio-group>
      </view>
      <wd-input v-model="organizationName" label="名称" clearable placeholder="例如：向阳房产城西店" />
      <wd-input v-model="cityName" label="所在城市" clearable placeholder="例如：杭州" />
      <view class="field-block flex flex-col gap-1.5">
        <view class="field-label text-size-xs text-content-primary font-semibold">
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
        免费开通工作台
      </wd-button>
      <text class="agreement-tip text-center text-size-2xs text-content-muted leading-normal">符合条件的新工作空间可享 14 天专业版试用；创建后可在“套餐与用量”查看当前套餐和可用额度。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.onboarding-page :deep(.app-custom-navigation) {
  @apply mt-0 mb-3 -mx-3;
}
</style>
