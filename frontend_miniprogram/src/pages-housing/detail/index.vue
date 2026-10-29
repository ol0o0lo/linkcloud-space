<script setup lang="ts">
import type { PublicHouseDetailOut } from '@/features/houses/service'
import type { CommutePlace, CommuteRoute } from '@/features/houses/commute'
import type { CommuteMode } from '@/services/manual/house-commute'
import { onHide, onLoad, onPageScroll, onShareAppMessage, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getHttpErrorMessage } from '@/domain/http-error'
import { getHouseDisplayMedia, getHouseMigrationMedia } from '@/domain/house-media'
import { favoriteHouse, getHouseFavorite, unfavoriteHouse } from '@/features/favorites/service'
import { getPublicHouse } from '@/features/houses/service'
import { COMMUTE_MODES, getCommuteRoute, getHouseCommuteRoute } from '@/features/houses/commute'
import { useWorkPlacePreferenceStore } from '@/features/houses/commute/preference'
import { startTenantChat } from '@/features/tenant-rental/service'
import { trackPublicHouseEvent } from '@/infra/analytics/client'
import { APP_ROUTES, getConversationRoute, getHouseDetailRoute, getLoginRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import HouseDetailPage from '@/components/house/HouseDetailPage.vue'
import HouseDetailSummary from '@/components/house/HouseDetailSummary.vue'
import HouseLocationCard from '@/components/house/HouseLocationCard.vue'
import HouseCommuteCard from '@/components/house/HouseCommuteCard.vue'
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
const commuteRouteId = ref(0)
const commuteRoute = ref<CommuteRoute | null>(null)
const commuteRouteError = ref('')
const commuteLoading = ref(false)
const commuteSettingsVisible = ref(false)
const commuteRetryCooldownMs = 60_000
let commuteLoadedKey = ''
let commuteLoadedAt = 0
let commuteRequestVersion = 0
const house = ref<PublicHouseDetailOut | null>(null)
const migrationMedia = computed(() => getHouseMigrationMedia(house.value))
const emptyMedia = computed(() => {
  if (!house.value)
    return false
  return ![...getHouseDisplayMedia(house.value, 'image'), ...getHouseDisplayMedia(house.value, 'video')].some(item => typeof item.url === 'string' && item.url)
})
const loading = ref(true)
const loadError = ref('')
const favorited = ref(false)
const favoriteLoading = ref(false)
const contactOpening = ref(false)
let contactOpenVersion = 0
let contactPageActive = true
const appContextStore = useAppContextStore()
const sessionStore = useSessionStore()
const workPlacePreference = useWorkPlacePreferenceStore()
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState({ threshold: 120, fadeDistance: 120 })
onPageScroll(handleNavigationScroll)
const updatedLabel = computed(() => house.value?.updated_at ? new Date(house.value.updated_at).toLocaleDateString('zh-CN') : '')
const title = computed(() => {
  if (!house.value)
    return '房源详情'
  const estateName = house.value.building.estate?.display_name || house.value.building.estate?.name || ''
  return Array.from(new Set([estateName, house.value.building.name, house.value.room_number].filter(Boolean))).join(' ')
})

const commuteDestinationName = computed(() => workPlacePreference.preference?.place.name || commuteRoute.value?.destination_name || '')
const commuteMode = computed<CommuteMode>(() => workPlacePreference.preference?.mode || commuteRoute.value?.mode || 'metro')

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

async function loadCommuteRoute(force = false, retry = false) {
  if (!houseId.value || (retry && commuteLoading.value))
    return
  const preference = workPlacePreference.preference
  const key = preference
    ? `${houseId.value}:${preference.place.destinationId}:${preference.mode}`
    : `${houseId.value}:route:${commuteRouteId.value}`
  if (!force && commuteLoadedKey === key && Date.now() - commuteLoadedAt < commuteRetryCooldownMs)
    return
  commuteLoadedKey = key
  commuteLoadedAt = Date.now()
  const version = ++commuteRequestVersion
  commuteRoute.value = null
  commuteRouteError.value = ''
  if (!preference && !commuteRouteId.value)
    return
  commuteLoading.value = true
  try {
    const route = preference
      ? await getHouseCommuteRoute(houseId.value, preference.place.destinationId, preference.mode, retry)
      : await getCommuteRoute(commuteRouteId.value, houseId.value, retry)
    if (version === commuteRequestVersion)
      commuteRoute.value = route
  }
  catch (error) {
    if (version === commuteRequestVersion)
      commuteRouteError.value = getHttpErrorMessage(error, '路线暂时无法计算，请稍后重试')
  }
  finally {
    if (version === commuteRequestVersion)
      commuteLoading.value = false
  }
}

function retryCommuteRoute() {
  const remainingSeconds = Math.ceil((commuteLoadedAt + commuteRetryCooldownMs - Date.now()) / 1000)
  if (remainingSeconds > 0) {
    uni.showToast({ title: `请${remainingSeconds}秒后重新计算`, icon: 'none' })
    return
  }
  void loadCommuteRoute(true, true)
}

function openCommuteSettings() {
  commuteSettingsVisible.value = true
}

function openWorkPlacePicker() {
  commuteSettingsVisible.value = false
  uni.navigateTo({
    url: `${APP_ROUTES.houseCommutePlace}${workPlacePreference.preference?.place.destinationId ? `?selected_id=${workPlacePreference.preference.place.destinationId}` : ''}`,
    events: {
      selectCommutePlace: (place: CommutePlace) => {
        workPlacePreference.save(place)
        void loadCommuteRoute()
      },
    },
  })
}

function selectCommuteMode(mode: CommuteMode) {
  workPlacePreference.setMode(mode)
  commuteSettingsVisible.value = false
  void loadCommuteRoute()
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

async function openContact() {
  const redirect = getHouseDetailRoute(houseId.value)
  if (!appContextStore.authenticated) {
    uni.navigateTo({ url: getLoginRoute(redirect) })
    return
  }
  const userId = appContextStore.user?.id
  if (!userId || contactOpening.value)
    return
  const currentHouseId = houseId.value
  const version = ++contactOpenVersion
  const current = () => contactPageActive && version === contactOpenVersion && appContextStore.user?.id === userId && houseId.value === currentHouseId
  contactOpening.value = true
  try {
    const conversation = await startTenantChat(currentHouseId, userId)
    if (current())
      await uni.navigateTo({ url: getConversationRoute(conversation.id, conversation.organization.slug, 'business_party') })
  }
  catch (error) {
    if (current())
      uni.showToast({ title: getHttpErrorMessage(error, '聊天暂时无法打开，请重试'), icon: 'none' })
  }
  finally {
    if (version === contactOpenVersion)
      contactOpening.value = false
  }
}

function shareHouse() {
  // #ifdef H5
  uni.setClipboardData({ data: window.location.href })
  // #endif
}

function retry() {
  void loadHouse()
  void loadCommuteRoute(true)
}

onLoad((options) => {
  houseId.value = Number(options?.id || 0)
  commuteRouteId.value = Number(options?.commute_route_id || 0)
  if (!houseId.value) {
    loadError.value = '房源参数不正确'
    loading.value = false
    return
  }
  void loadHouse()
  void loadCommuteRoute()
})

onShow(() => {
  contactPageActive = true
  contactOpening.value = false
  void refreshFavorite()
  void loadCommuteRoute()
})
function leaveContactPage() {
  contactPageActive = false
  contactOpenVersion += 1
  contactOpening.value = false
}
onHide(leaveContactPage)
onUnload(leaveContactPage)

onShareAppMessage(() => ({
  title: title.value,
  path: getHouseDetailRoute(houseId.value, commuteRouteId.value),
}))
</script>

<template>
  <HouseDetailPage
    class="public-house-page"
    :class="{ 'public-house-page--empty-media': emptyMedia }"
    :loading="loading"
    :error="loadError"
    :show-actions="Boolean(house)"
    :fallback-url="APP_ROUTES.publicHouseSearch"
    :scrolled="navigationScrolled"
    :scroll-progress="navigationProgress"
    @retry="retry"
  >
    <template #hero>
      <HouseMediaGallery v-if="house" :videos="house.videos" :images="house.images" :migration-media="migrationMedia" />
    </template>
    <template v-if="house">
      <view class="public-house-content bg-hex-f3f6fa">
        <HouseDetailSummary :house="house" prominent />
        <HousePublicDetails :house="house" section="intro" />
        <HouseCommuteCard
          :destination-name="commuteDestinationName"
          :mode="commuteMode"
          :route="commuteRoute"
          :loading="commuteLoading"
          :error="commuteRouteError"
          @configure="openCommuteSettings"
          @retry="retryCommuteRoute"
        />
        <HousePublicDetails :house="house" section="facts" />
        <HouseLocationCard
          :name="house.building.estate?.display_name || house.building.name"
          :address="location"
          :latitude="house.building.location?.latitude"
          :longitude="house.building.location?.longitude"
          :preview-count="4"
          hide-nearby-hint
          compact
        />
        <view class="detail-page-end">
          房源编号 #{{ house.id }} · 资料更新于 {{ updatedLabel }}
        </view>
      </view>
    </template>
    <template #actions>
      <view class="detail-actions public-house-actions">
        <button class="detail-action-icon" open-type="share" @click="shareHouse">
          <text class="i-carbon-share detail-action-icon__glyph" /><text>分享</text>
        </button>
        <button class="detail-action-icon" :class="{ 'favorite-active': favorited }" :disabled="favoriteLoading" @click="toggleFavorite">
          <text class="detail-action-icon__glyph" :class="favorited ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" /><text>{{ favorited ? '已收藏' : '收藏' }}</text>
        </button>
        <view class="detail-action-primary">
          <wd-button block :loading="contactOpening" :disabled="contactOpening" @click="openContact">
            <text class="i-carbon-chat" /> 在线咨询
          </wd-button>
        </view>
      </view>
    </template>
    <template #overlay>
      <template v-if="house">
        <AppBottomSheet v-model:visible="commuteSettingsVisible" title="到上班地点" description="选择地点和常用出行方式" :z-index="1200" show-handle>
          <view class="commute-settings flex flex-col gap-3">
            <button class="commute-settings__place m-0 min-h-11 w-full flex items-center gap-2 border-1 border-hex-e7ecf2 rounded-2.5 border-solid bg-hex-f8fafc px-3 py-0 text-left text-size-xs text-hex-182538" @click="openWorkPlacePicker">
              <view class="i-carbon-location-star" />
              <text>{{ workPlacePreference.preference?.place.name || '设置上班地点' }}</text>
              <view class="i-carbon-chevron-right" />
            </button>
            <text v-if="workPlacePreference.preference" class="commute-settings__label text-size-xs text-hex-182538 font-semibold">出行方式</text>
            <view v-if="workPlacePreference.preference" class="commute-settings__modes flex flex-wrap gap-1.5">
              <button v-for="item in COMMUTE_MODES" :key="item.value" class="commute-settings__mode m-0 flex items-center gap-1.5 border-1 border-hex-dfe6ef rounded-2 border-solid bg-hex-fff px-2.5 py-0 text-size-xs text-hex-526177 leading-8.5" :class="{ 'commute-settings__mode--active': commuteMode === item.value }" @click="selectCommuteMode(item.value)">
                <view :class="item.icon" />{{ item.label }}
              </button>
            </view>
          </view>
        </AppBottomSheet>
      </template>
    </template>
  </HouseDetailPage>
</template>

<style scoped lang="scss">
@use '@/components/house/detail.scss';
.public-house-page {
  --app-bg-page: #f3f6fa;
  --app-text-primary: #182b43;
  --app-text-secondary: #5c6e83;
  --house-line: #e8eef5;
  @apply bg-hex-f3f6fa;
}
.public-house-page :deep(.house-media) {
  height: 64vw;
  @apply max-h-90;
}
.public-house-page :deep(.house-media--empty) {
  height: calc(var(--status-bar-height, 0px) + 136px);
  @apply bg-hex-e3f0ff;
}
.public-house-page :deep(.house-media--empty::before),
.public-house-page :deep(.house-media--empty::after) {
  @apply hidden;
}
.public-house-page :deep(.house-media__empty) {
  @apply box-border;
  padding: calc(var(--status-bar-height, 0px) + 44px) 0 16px;
  @apply text-hex-46698e;
  background: linear-gradient(145deg, #deedff, #edf5ff 65%, #f3f6fa);
}
.public-house-page :deep(.house-media__empty-icon) {
  @apply text-hex-5f86b1;
}
.public-house-page--empty-media :deep(.house-detail-navigation__hero-background) {
  @apply bg-none;
  @apply bg-transparent;
}
.public-house-page--empty-media :deep(.house-detail-navigation__title) {
  @apply text-hex-182b43;
}
.public-house-page--empty-media :deep(.house-detail-navigation__back) {
  @apply border-hex-d0e1f1;
  @apply text-hex-31597f;
}
.public-house-content :deep(.summary--prominent) {
  @apply p-4;
  @apply rounded-4;
}
.public-house-content :deep(.summary--prominent .house-title) {
  @apply flex-1;
  @apply break-anywhere;
}
.public-house-content :deep(.summary--prominent .room-label) {
  @apply text-hex-66788d;
}
.public-house-content :deep(.price-caption) {
  @apply mt-3;
}
.public-house-content :deep(.summary--prominent .price-line) {
  @apply flex-wrap;
}
.public-house-content :deep(.summary--prominent .param-row) {
  @apply grid;
  @apply grid-cols-4;
  @apply gap-1;
  @apply mt-3;
  @apply py-2.5 px-1;
}
.public-house-content :deep(.detail-card:not(.summary)) {
  @apply mt-2.5 mx-3 mb-0;
  @apply p-4;
  @apply border-1 border-solid border-hex-e4ebf3;
  @apply bg-none;
  @apply rounded-4;
  @apply bg-hex-fff;
}
.public-house-content :deep(.detail-heading) {
  @apply min-h-5;
  @apply mb-2;
  @apply pl-0;
  @apply border-0;
  @apply text-hex-526177;
  @apply text-size-xs;
  @apply font-semibold;
  @apply leading-5;
}
.public-house-content :deep(.intro .detail-heading) {
  @apply hidden;
}
.public-house-content :deep(.details .detail-heading) {
  @apply min-h-4.5;
  @apply mb-1;
  @apply text-hex-66788d;
  @apply text-size-xs;
  @apply font-medium;
  @apply leading-4.5;
}
.public-house-content :deep(.detail-meta) {
  @apply text-hex-66788d;
  @apply text-size-2xs;
  @apply font-normal;
}
.public-house-content :deep(.tag-group) {
  @apply mt-0;
}
.public-house-content :deep(.tag-item) {
  @apply py-1 px-2;
  @apply border-1 border-solid border-transparent;
  @apply rounded-1.5;
  @apply text-hex-526177;
  @apply bg-hex-f1f5fa;
}
.public-house-content :deep(.tag-item--inherited) {
  @apply bg-hex-f1f5fa;
}
.public-house-content :deep(.description) {
  @apply mt-0;
  @apply text-hex-43566d;
  @apply text-size-xs;
  @apply leading-5.5;
}
.public-house-content :deep(.tag-group + .description) {
  @apply mt-2.5;
}
.public-house-content :deep(.commute-card__mode-icon),
.public-house-content :deep(.address-icon) {
  @apply text-hex-1269db;
}
.public-house-content :deep(.details .datum) {
  @apply py-2.5 px-0;
}
.public-house-content :deep(.details .datum-label) {
  @apply text-hex-66788d;
  @apply text-size-2xs;
}
.public-house-content :deep(.details .detail-value) {
  @apply text-hex-273a51;
  @apply text-size-xs;
}
.public-house-content .detail-page-end {
  @apply pt-7 px-3 pb-7;
}
.public-house-actions {
  @apply gap-3;
  --wot-button-primary-bg: #1269db;
  --wot-button-primary-bg-active: #0c58bd;
  --wot-button-height-medium: 48px;
  --wot-button-radius-main: 12px;
}
.public-house-actions .detail-action-icon {
  @apply w-11.5;
  @apply h-12;
}
.public-house-actions .detail-action-icon__glyph {
  @apply text-size-xl;
}
.public-house-actions .favorite-active {
  @apply text-hex-1269db;
}
.commute-settings__place::after,
.commute-settings__mode::after {
  @apply border-0;
}
.commute-settings__place text {
  @apply min-w-0;
  @apply flex-1;
  @apply overflow-hidden;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}
.commute-settings__mode--active {
  @apply border-hex-b8d7f5;
  @apply text-hex-006bcc;
  @apply bg-hex-edf6ff;
}
.favorite-active {
  @apply text-hex-006bcc;
}
</style>
