<script setup lang="ts">
import type { PublicHouseDetailOut } from '@/features/houses/service'
import type { TenantContactChannel, TenantContactPreference } from '@/features/tenant-rental/service'
import { onLoad, onPageScroll, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { favoriteHouse, getHouseFavorite, unfavoriteHouse } from '@/features/favorites/service'
import { getPublicHouse } from '@/features/houses/service'
import { getTenantContactPreference, sendTenantContact } from '@/features/tenant-rental/service'
import { trackPublicHouseEvent } from '@/infra/analytics/client'
import { APP_ROUTES, getHouseDetailRoute, getLoginRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import HouseDetailPage from '@/components/house/HouseDetailPage.vue'
import HouseDetailSummary from '@/components/house/HouseDetailSummary.vue'
import HouseInsightCard from '@/components/house/HouseInsightCard.vue'
import HouseLocationCard from '@/components/house/HouseLocationCard.vue'
import HousePublicDetails from '@/components/house/HousePublicDetails.vue'
import HouseMediaGallery from '@/components/house/HouseMediaGallery.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'

definePage({
  style: {
    navigationBarTitleText: '房源详情',
    navigationStyle: 'custom',
  },
})

const houseId = ref(0)
const house = ref<PublicHouseDetailOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const favorited = ref(false)
const favoriteLoading = ref(false)
const contactVisible = ref(false)
const contactEditing = ref(false)
const contactLoading = ref(false)
const contactSending = ref(false)
const contactChannels = ref<TenantContactChannel[]>([])
const contactPhone = ref('')
const contactWechat = ref('')
const appContextStore = useAppContextStore()
const sessionStore = useSessionStore()
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState({ threshold: 190, fadeDistance: 190 })
onPageScroll(handleNavigationScroll)
const updatedLabel = computed(() => house.value?.updated_at ? new Date(house.value.updated_at).toLocaleDateString('zh-CN') : '')
const boundPhone = computed(() => {
  const user = appContextStore.user
  if (!user?.phone_verified || !user.phone_national_number)
    return ''
  return `${user.phone_country_code || ''}${user.phone_national_number}`
})
const contactRows = computed(() => [
  contactChannels.value.includes('phone') && contactPhone.value.trim() ? { label: '手机号', value: contactPhone.value.trim() } : null,
  contactChannels.value.includes('wechat') && contactWechat.value.trim() ? { label: '微信号', value: contactWechat.value.trim() } : null,
].filter((item): item is { label: string, value: string } => Boolean(item)))

const title = computed(() => {
  if (!house.value)
    return '房源详情'
  const estateName = house.value.building.estate?.display_name || house.value.building.estate?.name || ''
  return Array.from(new Set([estateName, house.value.building.name, house.value.room_number].filter(Boolean))).join(' ')
})

const location = computed(() => {
  if (!house.value)
    return ''
  const estate = house.value.building.estate
  return [estate?.city, estate?.district, estate?.address || house.value.building.address].filter(Boolean).join(' ')
})

async function loadHouse() {
  loading.value = true
  loadError.value = ''
  try {
    house.value = await getPublicHouse(houseId.value)
    trackPublicHouseEvent('house.view', houseId.value)
  }
  catch {
    loadError.value = '房源不存在、已下架或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

async function refreshFavorite() {
  if (!appContextStore.authenticated || !houseId.value) {
    favorited.value = false
    return
  }
  try {
    const result = await getHouseFavorite(houseId.value)
    favorited.value = result.items.length > 0
  }
  catch {
    favorited.value = false
  }
}

async function toggleFavorite() {
  if (!appContextStore.authenticated) {
    const redirect = getHouseDetailRoute(houseId.value)
    sessionStore.deferFavorite(houseId.value, redirect)
    uni.navigateTo({ url: getLoginRoute(redirect) })
    return
  }
  if (favoriteLoading.value)
    return
  favoriteLoading.value = true
  try {
    if (favorited.value)
      await unfavoriteHouse(houseId.value)
    else
      await favoriteHouse(houseId.value)
    favorited.value = !favorited.value
    if (favorited.value)
      trackPublicHouseEvent('house.favorite', houseId.value)
    uni.showToast({ title: favorited.value ? '已收藏' : '已取消收藏', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
  }
  finally {
    favoriteLoading.value = false
  }
}

function applyContactPreference(value: unknown): boolean {
  if (!value || typeof value !== 'object')
    return false
  const preference = value as Partial<TenantContactPreference>
  const channels = Array.isArray(preference.channels)
    ? preference.channels.filter((channel): channel is TenantContactChannel => channel === 'phone' || channel === 'wechat')
    : []
  contactPhone.value = typeof preference.phone === 'string' ? preference.phone : ''
  contactWechat.value = typeof preference.wechat === 'string' ? preference.wechat : ''
  contactChannels.value = channels.filter(channel => channel === 'phone' ? Boolean(contactPhone.value.trim()) : Boolean(contactWechat.value.trim()))
  return contactChannels.value.length > 0
}

async function openContact() {
  const redirect = getHouseDetailRoute(houseId.value)
  if (!appContextStore.authenticated) {
    uni.navigateTo({ url: getLoginRoute(redirect) })
    return
  }

  contactVisible.value = true
  contactEditing.value = false
  contactLoading.value = true
  contactPhone.value = boundPhone.value
  contactWechat.value = ''
  contactChannels.value = boundPhone.value ? ['phone'] : []
  try {
    const setting = await getTenantContactPreference()
    applyContactPreference(setting.value)
  }
  catch {
    // 首次使用没有私有设置时，直接采用账号绑定手机号。
  }
  finally {
    contactLoading.value = false
    if (!contactRows.value.length)
      contactEditing.value = true
  }
}

async function submitContact() {
  if (contactLoading.value || contactSending.value)
    return
  if (!contactChannels.value.length) {
    uni.showToast({ title: '请至少选择一种联系方式', icon: 'none' })
    return
  }
  if (contactChannels.value.includes('phone') && !contactPhone.value.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  if (contactChannels.value.includes('wechat') && !contactWechat.value.trim()) {
    uni.showToast({ title: '请输入微信号', icon: 'none' })
    return
  }

  contactSending.value = true
  try {
    await sendTenantContact({
      house_id: houseId.value,
      channels: contactChannels.value,
      phone: contactPhone.value.trim(),
      wechat: contactWechat.value.trim(),
    })
    contactVisible.value = false
    uni.showToast({ title: '已发送，中介将主动联系你', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '发送失败，请稍后重试', icon: 'none' })
  }
  finally {
    contactSending.value = false
  }
}

function shareHouse() {
  // #ifdef H5
  uni.setClipboardData({ data: window.location.href })
  // #endif
}

function retry() {
  void loadHouse()
}

onLoad((options) => {
  houseId.value = Number(options?.id || 0)
  if (!houseId.value) {
    loadError.value = '房源参数不正确'
    loading.value = false
    return
  }
  void loadHouse()
})

onShow(() => {
  void refreshFavorite()
})

onShareAppMessage(() => ({
  title: title.value,
  path: getHouseDetailRoute(houseId.value),
}))
</script>

<template>
  <HouseDetailPage
    :loading="loading"
    :error="loadError"
    :show-actions="Boolean(house)"
    :fallback-url="APP_ROUTES.publicHouseSearch"
    :scrolled="navigationScrolled"
    :scroll-progress="navigationProgress"
    @retry="retry"
  >
    <template #hero>
      <HouseMediaGallery v-if="house" :videos="house.videos" :images="house.images" />
    </template>
    <template v-if="house">
      <HouseDetailSummary :house="house" />
      <HouseInsightCard />
      <HousePublicDetails :house="house" />
      <HouseLocationCard
        :name="house.building.estate?.display_name || house.building.name"
        :address="location"
        :latitude="house.building.location?.latitude"
        :longitude="house.building.location?.longitude"
      />
      <view class="detail-page-end">
        房源编号 #{{ house.id }} · 资料更新于 {{ updatedLabel }}
      </view>
    </template>
    <template #actions>
      <view class="detail-actions">
        <button class="detail-action-icon" open-type="share" @click="shareHouse">
          <text class="i-carbon-share detail-action-icon__glyph" /><text>分享</text>
        </button>
        <button class="detail-action-icon" :class="{ 'favorite-active': favorited }" :disabled="favoriteLoading" @click="toggleFavorite">
          <text class="detail-action-icon__glyph" :class="favorited ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" /><text>{{ favorited ? '已收藏' : '收藏' }}</text>
        </button>
        <view class="detail-action-primary">
          <wd-button block @click="openContact">
            <text class="i-carbon-chat" /> 预约联系
          </wd-button>
        </view>
      </view>
    </template>
    <template #overlay>
      <template v-if="house">
        <AppBottomSheet v-model:visible="contactVisible" title="预约联系" description="发送后，中介将主动联系你并协商看房时间" :z-index="1200" show-handle custom-style="--wot-popup-radius:22px;--wot-popup-close-margin:24px;--wot-popup-close-size:20px">
          <view class="contact-form">
            <view v-if="contactLoading" class="contact-hint">
              正在读取联系方式…
            </view>
            <template v-else-if="contactEditing">
              <view class="contact-field">
                <text>选择本次发送方式</text>
                <wd-checkbox-group v-model="contactChannels" direction="horizontal">
                  <wd-checkbox name="phone" type="button">
                    手机号
                  </wd-checkbox>
                  <wd-checkbox name="wechat" type="button">
                    微信号
                  </wd-checkbox>
                </wd-checkbox-group>
              </view>
              <view v-if="contactChannels.includes('phone')" class="contact-field">
                <text>手机号</text>
                <wd-input v-model="contactPhone" type="tel" clearable :maxlength="32" placeholder="请输入手机号" custom-style="border:1px solid #dce4ed;border-radius:8px;--wot-input-padding:10px 11px" />
              </view>
              <view v-if="contactChannels.includes('wechat')" class="contact-field">
                <text>微信号</text>
                <wd-input v-model="contactWechat" clearable :maxlength="64" placeholder="请输入微信号" custom-style="border:1px solid #dce4ed;border-radius:8px;--wot-input-padding:10px 11px" />
              </view>
              <view class="contact-hint">
                发送成功后会保存为下次默认联系方式，仅你自己可用。
              </view>
            </template>
            <template v-else>
              <view class="contact-summary">
                <view class="contact-summary__label">
                  本次发送
                </view>
                <view v-for="row in contactRows" :key="row.label" class="contact-summary__row">
                  <strong>{{ row.label }}</strong><text>{{ row.value }}</text>
                </view>
              </view>
              <button class="contact-edit-trigger" @click="contactEditing = true">
                修改联系方式
              </button>
            </template>
          </view>
          <template #footer>
            <view class="detail-actions">
              <view class="detail-action-primary">
                <wd-button block :loading="contactSending" :disabled="contactLoading" @click="submitContact">
                  {{ contactEditing ? '保存并发送' : '一键发送给中介' }}
                </wd-button>
              </view>
            </view>
          </template>
        </AppBottomSheet>
      </template>
    </template>
  </HouseDetailPage>
</template>

<style scoped lang="scss">
@use '@/components/house/detail.scss';
.favorite-active {
  color: #006bcc;
}
.contact-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.contact-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #182538;
  font-size: 12px;
  font-weight: 550;
}
.contact-summary {
  padding: 12px;
  border-radius: 10px;
  background: #f1f7fc;
}
.contact-summary__label {
  margin-bottom: 6px;
  color: #78869a;
  font-size: 11px;
}
.contact-summary__row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 30px;
  color: #25374b;
  font-size: 13px;
}
.contact-summary__row strong {
  width: 52px;
  flex: 0 0 52px;
  font-weight: 650;
}
.contact-edit-trigger {
  min-height: 32px;
  margin: -4px 0 0;
  padding: 0;
  color: #0878d1;
  font-size: 13px;
  font-weight: 650;
  line-height: 32px;
  background: transparent;
}
.contact-edit-trigger::after {
  border: 0;
}
.contact-hint {
  color: #78869a;
  font-size: 12px;
  line-height: 19px;
}
</style>
