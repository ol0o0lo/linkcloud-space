<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, formatOrganizationMoney, getOrganizationHouseLifecycleActions, getOrganizationHouseStatusTone } from '@/domain/organization-rental'
import { getOrganizationHouse, HouseStatus, patchOrganizationHouse } from '@/features/organization-rental/service'
import type { HouseOut } from '@/features/organization-rental/service'
import { getOrganizationHouseFormRoute } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房源详情' } })

const appContextStore = useAppContextStore()
const toast = useToast()
const houseId = ref(0)
const house = ref<HouseOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const submittingAction = ref<string | null>(null)
const lifecycleActions = computed(() => house.value ? getOrganizationHouseLifecycleActions(house.value.status) : [])

async function loadHouse() {
  loading.value = true
  loadError.value = ''
  try {
    house.value = await getOrganizationHouse(appContextStore.organizationSlug, houseId.value)
  }
  catch {
    loadError.value = '房源不存在或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

function editHouse() {
  uni.navigateTo({ url: getOrganizationHouseFormRoute(houseId.value) })
}

async function updateStatus(action: 'publish' | 'unpublish' | 'disable') {
  if (!house.value || submittingAction.value)
    return
  const actionConfig = {
    publish: { title: '确认发布房源', content: '确认后房源状态将切换为招租，继续承接带看。', confirmText: '确认发布', status: HouseStatus.listed, success: '房源已发布' },
    unpublish: { title: '确认下架房源', content: '确认后房源状态将切换为空置，不再对外展示。', confirmText: '确认下架', status: HouseStatus.vacant, success: '房源已下架' },
    disable: { title: '确认停用房源', content: '停用后不再参与日常经营筛选，历史业务关联仍会保留。', confirmText: '确认停用', status: HouseStatus.inactive, success: '房源已停用' },
  }[action]
  const confirmation = await uni.showModal({ title: actionConfig.title, content: actionConfig.content, confirmText: actionConfig.confirmText })
  if (!confirmation.confirm)
    return
  submittingAction.value = action
  try {
    house.value = await patchOrganizationHouse(appContextStore.organizationSlug, house.value.id, { status: actionConfig.status })
    toast.success(actionConfig.success)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源状态更新失败') }
  finally { submittingAction.value = null }
}

onLoad((options) => {
  houseId.value = Number(options?.id || 0)
  if (!houseId.value) {
    loadError.value = '房源参数不正确'
    loading.value = false
    return
  }
})
onShow(() => {
  if (houseId.value)
    void loadHouse()
})
</script>

<template>
  <view class="detail-page">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载房源…" />
    <AppErrorView v-else-if="loadError" title="房源加载失败" :message="loadError" @retry="loadHouse" />
    <template v-else-if="house">
      <view class="hero-card">
        <view class="hero-topline">
          <wd-tag :type="getOrganizationHouseStatusTone(house.status)" variant="light">
            {{ house.status__mapping }}
          </wd-tag><text>{{ formatOrganizationDateTime(house.updated_at) }}</text>
        </view>
        <view class="house-title">
          {{ formatOrganizationHouseTitle(house) }}
        </view>
        <view class="rent">
          {{ formatOrganizationMoney(house.asking_rent) }}<text>/月</text>
        </view>
      </view>
      <wd-cell-group title="房源信息" insert>
        <wd-cell title="户型" :value="formatHouseLayout(house.bedrooms, house.living_rooms)" />
        <wd-cell title="面积" :value="house.area ? `${house.area}㎡` : '未登记'" />
        <wd-cell title="楼层" :value="house.floor == null ? '未登记' : `${house.floor} 层`" />
        <wd-cell title="朝向" :value="house.orientation__mapping || '未登记'" />
        <wd-cell title="装修" :value="house.decoration__mapping || '未登记'" />
        <wd-cell title="押金" :value="formatOrganizationMoney(house.deposit_amount)" />
        <wd-cell title="房东" :value="house.landlord?.name || '未关联'" />
      </wd-cell-group>
      <wd-cell-group title="经营信息" insert>
        <wd-cell title="标签" :value="house.effective_tags.join('、') || '暂无标签'" />
        <wd-cell title="巡检" :value="house.inspection_reasons.length ? house.inspection_reasons.join('、') : '资料正常'" />
        <wd-cell title="公开描述" :label="house.public_description || '未填写'" />
        <wd-cell title="内部备注" :label="house.internal_notes || '未填写'" />
      </wd-cell-group>
      <view class="action-card">
        <wd-button block variant="plain" :disabled="submittingAction !== null" @click="editHouse">
          编辑房源资料
        </wd-button>
        <wd-button v-if="lifecycleActions.includes('publish')" block :loading="submittingAction === 'publish'" :disabled="submittingAction !== null" @click="updateStatus('publish')">
          发布房源
        </wd-button>
        <wd-button v-if="lifecycleActions.includes('unpublish')" block type="warning" variant="plain" :loading="submittingAction === 'unpublish'" :disabled="submittingAction !== null" @click="updateStatus('unpublish')">
          下架房源
        </wd-button>
        <wd-button v-if="lifecycleActions.includes('disable')" block type="danger" variant="plain" :loading="submittingAction === 'disable'" :disabled="submittingAction !== null" @click="updateStatus('disable')">
          停用房源
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 56rpx;
  background: var(--app-bg-page);
}
.hero-card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 26rpx;
  background: var(--app-bg-card);
}
.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.house-title {
  margin-top: 22rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.rent {
  margin-top: 20rpx;
  color: var(--app-color-price);
  font-size: 42rpx;
  font-weight: 700;
}
.rent text {
  margin-left: 4rpx;
  font-size: 23rpx;
  font-weight: 400;
}
.action-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin: 24rpx;
  padding: 26rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
</style>
