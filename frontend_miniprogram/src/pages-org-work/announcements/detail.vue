<script setup lang="ts">
import type { OrganizationAnnouncementAction } from '@/domain/organization-work'
import type { AnnouncementOut } from '@/features/organization-work/service'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { formatOrganizationWorkDateTime, formatOrganizationWorkUser, getAnnouncementActions, getAnnouncementStatusTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import { acknowledgeOrganizationAnnouncement, getOrganizationAnnouncement, publishOrganizationAnnouncement, withdrawOrganizationAnnouncement } from '@/features/organization-work/service'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '公告详情' } })

const actionLabels: Record<OrganizationAnnouncementAction, string> = { acknowledge: '确认已阅', publish: '发布公告', withdraw: '撤回公告' }
const toast = useToast()
const appContextStore = useAppContextStore()
const announcementId = ref(0)
const announcement = ref<AnnouncementOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref<OrganizationAnnouncementAction | null>(null)
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | undefined
const actions = computed(() => announcement.value ? getAnnouncementActions(announcement.value, now.value) : [])

function stopNowTimer() {
  if (nowTimer === undefined)
    return
  clearInterval(nowTimer)
  nowTimer = undefined
}

function startNowTimer() {
  stopNowTimer()
  now.value = Date.now()
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

async function loadAnnouncement() {
  loading.value = true
  loadError.value = ''
  try {
    if (!announcementId.value)
      throw new Error('公告参数不正确')
    announcement.value = await getOrganizationAnnouncement(appContextStore.organizationSlug, announcementId.value)
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '公告详情加载失败' }
  finally { loading.value = false }
}

async function runAction(action: OrganizationAnnouncementAction) {
  now.value = Date.now()
  if (submitting.value || !announcement.value || !actions.value.includes(action))
    return
  if (action !== 'acknowledge') {
    const confirmation = await uni.showModal({ title: actionLabels[action], content: action === 'publish' ? '发布后公告将发送给公告范围内的成员。' : '撤回后成员将不再看到这条公告。', confirmText: '确认' })
    if (!confirmation.confirm)
      return
  }
  submitting.value = action
  try {
    if (action === 'acknowledge') {
      await acknowledgeOrganizationAnnouncement(appContextStore.organizationSlug, announcement.value.id)
      announcement.value = { ...announcement.value, is_acknowledged: true }
    }
    else if (action === 'publish') {
      announcement.value = await publishOrganizationAnnouncement(appContextStore.organizationSlug, announcement.value.id)
    }
    else {
      announcement.value = await withdrawOrganizationAnnouncement(appContextStore.organizationSlug, announcement.value.id)
    }
    toast.success(`${actionLabels[action]}成功`)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : `${actionLabels[action]}失败`) }
  finally { submitting.value = null }
}

onLoad((options) => {
  announcementId.value = Number(options?.id || 0)
  void loadAnnouncement()
})
onShow(startNowTimer)
onHide(stopNowTimer)
onUnload(stopNowTimer)
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载公告…"
    error-title="公告详情加载失败"
    :show-actions="actions.length > 0"
    @retry="loadAnnouncement"
  >
    <template #navigation>
      <AppCustomNavigation title="公告详情" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <template v-if="announcement">
      <view class="mx-app-gutter app-card-plain p-4">
        <view class="flex items-center gap-1.5">
          <AppStatusTag :text="announcement.status__mapping" :tone="getAnnouncementStatusTone(announcement.status)" />
          <AppStatusTag
            v-if="shouldShowAnnouncementAcknowledgement(announcement, now)"
            :text="announcement.is_acknowledged ? '已确认' : '待确认'"
            :tone="announcement.is_acknowledged ? 'success' : 'warning'"
          />
        </view>
        <view class="mt-2.5 text-lg text-content-primary font-bold leading-snug">
          {{ announcement.title }}
        </view>
        <view class="mt-1.5 text-xs text-content-muted">
          {{ announcement.team_name || '整个工作空间' }} · {{ formatOrganizationWorkDateTime(announcement.published_at || announcement.created_at) }}
        </view>
        <text class="mt-3.5 block whitespace-pre-wrap text-sm text-content-secondary leading-relaxed">{{ announcement.body }}</text>
      </view>
      <wd-cell-group title="公告信息" insert>
        <wd-cell title="发布人" :value="formatOrganizationWorkUser(announcement.published_by)" />
        <wd-cell title="确认要求" :value="announcement.require_acknowledgement ? '需要确认' : '无需确认'" />
        <wd-cell v-if="announcement.can_manage && announcement.require_acknowledgement" title="确认进度" :value="`${announcement.acknowledged_count || 0}/${announcement.recipient_count || 0}`" />
        <wd-cell title="有效期至" :value="formatOrganizationWorkDateTime(announcement.expires_at)" />
      </wd-cell-group>
    </template>

    <template #actions>
      <view class="w-full flex flex-wrap justify-end gap-1.5">
        <template v-if="announcement">
          <wd-button v-for="action in actions" :key="action" size="small" :type="action === 'withdraw' ? 'danger' : 'primary'" :variant="action === 'acknowledge' ? 'base' : 'plain'" :loading="submitting === action" :disabled="submitting !== null" @click="runAction(action)">
            {{ actionLabels[action] }}
          </wd-button>
        </template>
      </view>
    </template>
  </AppDetailPage>
</template>
