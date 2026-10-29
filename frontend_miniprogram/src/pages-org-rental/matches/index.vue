<script setup lang="ts">
import type { HouseMatchShareOut } from '@/services/manual/organization-matches'
import { onShareAppMessage } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'
import { formatMerchantTime, formatShareValidity } from '@/domain/merchant-presentation'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getHouseMatchRoute } from '@/modules/routes'
import { getMatchExtensionDate } from '@/pages-org-rental/domain/organization-matches'
import { formatOrganizationDateTime, isUniActionCanceled } from '@/pages-org-rental/domain/organization-rental'
import { extendOrganizationMatch, listOrganizationMatches, revokeOrganizationMatch } from '@/services/manual/organization-matches'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '配房管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const toast = useToast()
const pendingId = ref<number | null>(null)
const shareTarget = ref<HouseMatchShareOut | null>(null)
const statusLabels = { active: '生效中', expired: '已过期', revoked: '已失效' }
const list = usePagedPage<HouseMatchShareOut>({
  pageSize: 15,
  keyOf: item => item.id,
  enabled: () => Boolean(appContextStore.organizationSlug),
  loader: async ({ page, pageSize }) => {
    const slug = appContextStore.organizationSlug
    const result = await listOrganizationMatches(slug, page, pageSize)
    return slug === appContextStore.organizationSlug ? result : { ...result, items: [], total: 0 }
  },
})

function createMatch() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationHouses}?status=listed&match=true` })
}

function copyLink(share: HouseMatchShareOut) {
  if (share.status === 'active')
    uni.setClipboardData({ data: share.share_url })
}

function previewShare(share: HouseMatchShareOut) {
  if (share.status === 'active')
    uni.navigateTo({ url: getHouseMatchRoute(share.share_key) })
}

async function showMoreActions(share: HouseMatchShareOut) {
  if (pendingId.value || share.status === 'revoked')
    return
  pendingId.value = share.id
  const slug = appContextStore.organizationSlug
  try {
    const actions = share.expires_at ? ['延长有效期', '使其失效'] : ['使其失效']
    const choice = await uni.showActionSheet({ itemList: actions })
    if (slug !== appContextStore.organizationSlug)
      return
    pendingId.value = null
    if (share.expires_at && choice.tapIndex === 0)
      await extendShare(share)
    else
      await revokeShare(share)
  }
  catch (error) {
    if (!isUniActionCanceled(error))
      toast.error(error instanceof Error ? error.message : '操作失败，请稍后重试')
  }
  finally {
    pendingId.value = null
  }
}

async function extendShare(share: HouseMatchShareOut) {
  if (pendingId.value || share.status === 'revoked' || !share.expires_at)
    return
  pendingId.value = share.id
  const slug = appContextStore.organizationSlug
  try {
    const choice = await uni.showActionSheet({ itemList: ['延期 7 天', '延期 30 天'] })
    const expiresAt = getMatchExtensionDate(share.expires_at, choice.tapIndex === 0 ? 7 : 30)
    const result = await uni.showModal({
      title: '确认延期配房单',
      content: `「${share.title}」将延期至 ${formatOrganizationDateTime(expiresAt)}。已过期的链接会重新生效。`,
      confirmText: '确认延期',
    })
    if (!result.confirm || slug !== appContextStore.organizationSlug)
      return
    const updated = await extendOrganizationMatch(slug, share.id, expiresAt)
    if (slug !== appContextStore.organizationSlug)
      return
    list.upsert(updated)
    await list.refresh()
    toast.success('配房单已延期')
  }
  catch (error) {
    if (!isUniActionCanceled(error))
      toast.error(error instanceof Error ? error.message : '延期失败，请稍后重试')
  }
  finally {
    pendingId.value = null
  }
}

async function revokeShare(share: HouseMatchShareOut) {
  if (pendingId.value || share.status === 'revoked')
    return
  pendingId.value = share.id
  const slug = appContextStore.organizationSlug
  try {
    const confirmation = await uni.showModal({
      title: '使配房单失效',
      content: `确认使「${share.title}」失效？失效后收件人将无法查看，也不能再次延期。`,
      confirmText: '确认失效',
      confirmColor: '#d14343',
    })
    if (!confirmation.confirm || slug !== appContextStore.organizationSlug)
      return
    const updated = await revokeOrganizationMatch(slug, share.id)
    if (slug !== appContextStore.organizationSlug)
      return
    list.upsert(updated)
    if (shareTarget.value?.id === share.id)
      shareTarget.value = null
    await list.refresh()
    toast.success('配房单已失效')
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '操作失败，请稍后重试')
  }
  finally {
    pendingId.value = null
  }
}

onShareAppMessage(() => ({
  title: shareTarget.value?.title || '为你精选的房源',
  path: shareTarget.value ? getHouseMatchRoute(shareTarget.value.share_key) : APP_ROUTES.houses,
}))

watch(() => appContextStore.organizationSlug, (slug, previous) => {
  if (!previous || slug === previous)
    return
  shareTarget.value = null
  list.reset()
  void list.refresh()
})
</script>

<template>
  <AppPage class="rental-page" variant="list">
    <template #navigation>
      <AppCustomNavigation title="配房管理" back scroll-mode="sticky" />
    </template>
    <RentalPageHeading title="配房分享" description="精选房源发给客户，跟进推荐访问情况" :total="list.loaded.value ? list.total.value : null" unit="份">
      <wd-button size="small" @click="createMatch">
        新建配房
      </wd-button>
    </RentalPageHeading>
    <view class="rental-note">
      <view class="i-carbon-share shrink-0" /><text>我的配房单 · 可预览、分享及管理有效期</text>
    </view>
    <AppPagedList
      :items="list.items.value"
      :loading="list.loading.value"
      :refreshing="list.refreshing.value"
      :loading-more="list.loadingMore.value"
      :finished="list.finished.value"
      :error="list.error.value"
      loading-text="正在加载配房单…"
      empty-text="还没有配房单"
      empty-description="筛选招租中的房源，批量生成一份推荐发给客户。"
      empty-action-text="筛房配房"
      finished-text="没有更多配房单了"
      @retry="list.refresh"
      @empty-action="createMatch"
    >
      <template #item="{ item }">
        <AppRecordCard>
          <template #title>
            {{ item.title }}
          </template>
          <template #status>
            <text class="shrink-0 text-xs" :class="item.status === 'active' ? 'text-app-brand' : 'text-content-muted'">{{ statusLabels[item.status] }}</text>
          </template>
          <view class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted leading-relaxed">
            <text>{{ formatShareValidity(item.expires_at, item.status) }}</text>
            <text>创建于 {{ formatMerchantTime(item.created_at) }}</text>
          </view>
          <view class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-content-muted">
            <view class="text-content-secondary">
              浏览 <text class="text-base text-content-primary font-semibold">{{ item.view_count }}</text> 次
            </view>
            <text v-if="item.last_accessed_at">最近访问 {{ formatMerchantTime(item.last_accessed_at) }}</text>
          </view>
          <view v-if="item.status !== 'revoked'" class="mt-3 flex items-center justify-end gap-2">
            <view v-if="item.status === 'active'" class="min-w-0 flex-1">
              <!-- #ifndef MP-WEIXIN -->
              <wd-button block size="small" :disabled="pendingId !== null" @click="copyLink(item)">
                复制分享链接
              </wd-button>
              <!-- #endif -->
              <!-- #ifdef MP-WEIXIN -->
              <wd-button block size="small" open-type="share" :disabled="pendingId !== null" @click="shareTarget = item">
                发送给客户
              </wd-button>
              <!-- #endif -->
            </view>
            <wd-button v-if="item.status === 'active'" size="small" variant="plain" type="info" :disabled="pendingId !== null" @click="previewShare(item)">
              预览
            </wd-button>
            <wd-button size="small" variant="text" type="info" :disabled="pendingId !== null" :loading="pendingId === item.id" @click="showMoreActions(item)">
              更多
            </wd-button>
          </view>
        </AppRecordCard>
      </template>
    </AppPagedList>
    <template #overlay>
      <wd-toast />
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
@use '../components/management';
</style>
