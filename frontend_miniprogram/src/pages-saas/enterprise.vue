<script setup lang="ts">
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { createSalesLead } from '@/features/saas/service'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '企业版咨询' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const contactName = ref('')
const contactPhone = ref('')
const companyName = ref(appContextStore.currentOrganization?.name || '')
const cityName = ref('')
const teamSize = ref('51_plus')
const houseScale = ref('1000_3000')
const needs = ref('')
const submitting = ref(false)
const submitted = ref(false)

async function submit() {
  if (submitting.value)
    return
  if (!contactName.value.trim() || !contactPhone.value.trim()) {
    toast.warning('请填写联系人和联系电话')
    return
  }
  submitting.value = true
  try {
    await createSalesLead({
      contact_name: contactName.value.trim(),
      contact_phone: contactPhone.value.trim(),
      company_name: companyName.value.trim(),
      city_name: cityName.value.trim(),
      team_size: teamSize.value,
      house_scale: houseScale.value,
      needs: needs.value.trim(),
      source: 'miniprogram_enterprise',
    }, appContextStore.organizationSlug)
    submitted.value = true
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '需求提交失败')
  }
  finally {
    submitting.value = false
  }
}

function backToPlans() {
  uni.redirectTo({ url: APP_ROUTES.saasHome })
}
</script>

<template>
  <view class="enterprise-page box-border min-h-screen bg-surface-page px-3 pb-8 pt-0">
    <AppCustomNavigation title="企业版咨询" back scroll-mode="sticky" />
    <wd-toast />
    <view v-if="submitted" class="success-card flex flex-col items-center gap-2.5 rounded-xl bg-surface-card px-3.5 pb-3.5 pt-7 text-center">
      <view class="success-icon i-carbon-checkmark-filled text-size-5xl text-app-success" />
      <strong class="text-size-base text-content-primary leading-snug">需求已提交</strong>
      <text class="text-size-xs text-content-secondary leading-relaxed">销售顾问将根据团队、房源规模和实施需求与你联系。请保持电话畅通。</text>
      <wd-button block @click="backToPlans">
        返回套餐页
      </wd-button>
    </view>
    <template v-else>
      <view class="enterprise-hero flex flex-col gap-1.5 border-hairline border-app-border-brand-soft rounded-xl border-solid bg-surface-card p-3.5">
        <wd-tag type="warning" variant="soft">
          企业版
        </wd-tag>
        <strong class="text-size-base text-content-primary leading-snug">多门店、高级权限和接口集成，需要先做需求评估</strong>
        <text class="text-size-xs text-content-secondary leading-relaxed">提交后进入平台销售线索池，跟进状态和备注由运营团队统一管理。</text>
      </view>
      <view class="form-card mt-2.5 flex flex-col gap-3 rounded-xl bg-surface-card p-3.5">
        <wd-input v-model="contactName" label="联系人" clearable placeholder="请填写姓名" />
        <wd-input v-model="contactPhone" label="联系电话" type="number" clearable placeholder="手机或座机" />
        <wd-input v-model="companyName" label="公司/门店" clearable placeholder="请填写主体名称" />
        <wd-input v-model="cityName" label="所在城市" clearable placeholder="例如：杭州" />
        <view class="field-block flex flex-col gap-1.5">
          <view class="field-label text-size-xs text-content-primary font-semibold">
            团队规模
          </view>
          <wd-radio-group v-model="teamSize" type="button" direction="vertical">
            <wd-radio value="11_50">
              11～50 人
            </wd-radio>
            <wd-radio value="51_plus">
              51 人以上
            </wd-radio>
          </wd-radio-group>
        </view>
        <view class="field-block flex flex-col gap-1.5">
          <view class="field-label text-size-xs text-content-primary font-semibold">
            在管房源
          </view>
          <wd-radio-group v-model="houseScale" type="button" direction="vertical">
            <wd-radio value="under_1000">
              1000 套以内
            </wd-radio>
            <wd-radio value="1000_3000">
              1000～3000 套
            </wd-radio>
            <wd-radio value="3000_plus">
              3000 套以上
            </wd-radio>
          </wd-radio-group>
        </view>
        <view class="field-block flex flex-col gap-1.5">
          <view class="field-label text-size-xs text-content-primary font-semibold">
            重点需求
          </view>
          <wd-textarea v-model="needs" :maxlength="500" show-word-limit auto-height placeholder="例如：多门店数据隔离、总部看板、开放 API、历史数据迁移" />
        </view>
        <wd-button block size="large" :loading="submitting" :disabled="submitting" @click="submit">
          提交企业需求
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.enterprise-page :deep(.app-custom-navigation) {
  @apply mt-0 mb-3 -mx-3;
}
</style>
