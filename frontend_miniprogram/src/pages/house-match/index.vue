<script setup lang="ts">
import type { PublicHouseListOut, PublicHouseMatchShare } from '@/features/house-match/service'
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { getPublicHouseMatchShare, listPublicHouseMatchHouses } from '@/features/house-match/service'
import { getHouseMatchErrorCopy, resolveHouseMatchError } from '@/domain/house-match'
import type { HouseMatchErrorKind } from '@/domain/house-match'
import { getHouseMatchDetailRoute, getHouseMatchRoute } from '@/modules/routes'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '配房推荐',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const PAGE_SIZE = 12
const shareKey = ref('')
const share = ref<PublicHouseMatchShare | null>(null)
const loading = ref(true)
const errorKind = ref<HouseMatchErrorKind | null>(null)

const errorCopy = computed(() => errorKind.value ? getHouseMatchErrorCopy(errorKind.value) : null)
const expiryText = computed(() => {
  if (!share.value?.expires_at)
    return '长期有效'
  return `有效期至 ${dayjs(share.value.expires_at).format('YYYY年M月D日')}`
})

const housePage = usePagedPage<PublicHouseListOut>({
  loader: ({ page, pageSize }) => listPublicHouseMatchHouses(shareKey.value, page, pageSize),
  pageSize: PAGE_SIZE,
  enabled: () => Boolean(shareKey.value) && !errorKind.value,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

async function loadInitial() {
  if (!shareKey.value) {
    errorKind.value = 'not-found'
    loading.value = false
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  errorKind.value = null
  try {
    const shareResult = await getPublicHouseMatchShare(shareKey.value)
    share.value = shareResult
    await housePage.refresh()
    uni.setNavigationBarTitle({ title: shareResult.title || '配房推荐' })
  }
  catch (error) {
    share.value = null
    housePage.reset()
    errorKind.value = resolveHouseMatchError(error)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadMore() {
  await housePage.loadMore()
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseMatchDetailRoute(shareKey.value, houseId) })
}

function callConsultant(phone?: string | null) {
  const phoneNumber = phone?.trim()
  if (phoneNumber)
    void uni.makePhoneCall({ phoneNumber })
}

onLoad((options) => {
  shareKey.value = String(options?.key || '').trim()
  void loadInitial()
})

onPullDownRefresh(loadInitial)
onReachBottom(loadMore)
onShareAppMessage(() => ({
  title: share.value?.title || '配房推荐',
  path: getHouseMatchRoute(shareKey.value),
}))
</script>

<template>
  <AppPage variant="list" gutter="none">
    <template #navigation>
      <AppCustomNavigation :title="share?.title || '配房推荐'" back scroll-mode="sticky" />
    </template>
    <view class="match-page box-border bg-surface-page px-5 pb-10 pt-5 min-h-inherit">
      <AppLoading v-if="loading" text="正在加载配房推荐…" />

      <AppErrorView
        v-else-if="errorCopy"
        :title="errorCopy.title"
        :message="errorCopy.tip"
        :retryable="errorKind === 'load-failed'"
        @retry="loadInitial"
      />

      <template v-else-if="share">
        <view class="share-card flex flex-col gap-4">
          <view class="share-summary border-hairline border-app-border-brand-soft rounded-5 border-solid p-4">
            <view class="flex flex-wrap items-center justify-between gap-2">
              <view class="share-card__eyebrow text-size-xs text-app-brand font-semibold">
                专属配房推荐
              </view>
              <!-- #ifdef MP-WEIXIN -->
              <wd-button size="small" variant="soft" open-type="share">
                分享推荐
              </wd-button>
              <!-- #endif -->
            </view>
            <view class="share-card__title mt-1.5 text-size-xl text-content-primary font-bold leading-snug">
              {{ share.title }}
            </view>
            <view v-if="share.remark" class="share-card__remark mt-2.5 whitespace-pre-wrap text-size-sm text-content-secondary leading-relaxed">
              {{ share.remark }}
            </view>
            <view class="share-card__meta mt-3 flex items-center gap-2 text-size-xs text-content-muted">
              <wd-tag type="primary" variant="light">
                {{ share.mode === 'manual' ? '顾问精选' : '动态匹配' }}
              </wd-tag>
              <text>{{ expiryText }}</text>
            </view>
          </view>
          <view v-if="share.consultant" class="consultant-row box-border min-h-15 flex items-center gap-2.5 rounded-4 bg-surface-card px-3.5 py-2.5">
            <image v-if="share.consultant.avatar_url" class="consultant-avatar h-9.5 w-9.5 flex-none basis-9.5 rounded-full" :src="share.consultant.avatar_url" mode="aspectFill" />
            <view v-else class="consultant-avatar consultant-avatar--empty h-9.5 w-9.5 flex flex-none basis-9.5 items-center justify-center rounded-full text-size-sm text-app-brand font-bold">
              {{ share.consultant.name.slice(0, 1) }}
            </view>
            <view class="consultant-info min-w-0 flex flex-1 flex-col gap-0.5">
              <text class="consultant-name text-size-sm text-content-primary font-semibold">{{ share.consultant.name }}</text>
              <text class="consultant-label text-size-xs text-content-muted">为你整理本次房源推荐</text>
            </view>
            <wd-button v-if="share.consultant.phone" size="small" variant="plain" @click="callConsultant(share.consultant.phone)">
              联系顾问
            </wd-button>
          </view>
        </view>

        <view class="list-heading flex items-center justify-between px-0.5 pb-2.5 pt-4 text-size-sm text-content-primary font-semibold">
          <text>推荐房源</text>
          <text>{{ housePage.total.value }} 套</text>
        </view>

        <AppPagedList
          :items="housePage.items.value"
          item-key="id"
          :loading="housePage.loading.value"
          :refreshing="housePage.refreshing.value"
          :loading-more="housePage.loadingMore.value"
          :finished="housePage.finished.value"
          :error="housePage.error.value"
          loading-text="正在加载推荐房源…"
          finished-text="已展示全部推荐房源"
          @retry="housePage.refresh"
        >
          <template #item="{ item }">
            <HouseCard :house="item" @click="openHouse(item.id)" />
          </template>
          <template #empty>
            <AppEmpty title="当前推荐中暂无可展示房源" description="房源可能已出租或下架，请联系顾问更新推荐。" icon="no-result" />
          </template>
        </AppPagedList>
      </template>
    </view>
  </AppPage>
</template>

<style scoped>
.share-summary {
  background: #f4f9ff;
}

.consultant-avatar {
  @apply bg-surface-brand-soft;
}

.list-heading text:last-child {
  @apply text-content-muted text-size-xs font-normal;
}

.house-list {
  @apply flex flex-col gap-2.5;
}
</style>
