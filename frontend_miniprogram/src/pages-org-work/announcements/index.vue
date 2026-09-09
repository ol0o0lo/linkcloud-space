<script setup lang="ts">
import type { AnnouncementOut, TeamOperationsCapabilitiesOut, TeamOut } from '@/features/organization-work/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { buildOrganizationWorkManageScopeOptions, formatOrganizationWorkDateTime, getAnnouncementStatusTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import { createOrganizationAnnouncement, getOrganizationWorkCapabilities, listOrganizationAnnouncements, listOrganizationWorkTeams } from '@/features/organization-work/service'
import { getOrganizationAnnouncementDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '团队公告', enablePullDownRefresh: true } })

interface SegmentedOption { value: string | number }
interface PickerConfirmEvent { value: Array<string | number> }

const toast = useToast()
const appContextStore = useAppContextStore()
const capabilities = ref<TeamOperationsCapabilitiesOut | null>(null)
const organizationTeams = ref<TeamOut[]>([])
const filter = ref<'published' | 'all'>('published')
const keyword = ref('')
const createVisible = ref(false)
const createScopePickerVisible = ref(false)
const creating = ref(false)
const title = ref('')
const body = ref('')
const requireAcknowledgement = ref(true)
const selectedCreateScope = ref<Array<string | number>>([])
const canManageAnnouncements = computed(() => capabilities.value?.announcement_organization_manage === true || Boolean(capabilities.value?.announcement_team_ids?.length))
const createScopeOptions = computed(() => buildOrganizationWorkManageScopeOptions({
  organizationManage: capabilities.value?.announcement_organization_manage === true,
  teamIds: capabilities.value?.announcement_team_ids,
  teams: organizationTeams.value,
}))
const selectedCreateScopeOption = computed(() => createScopeOptions.value.find(item => item.value === selectedCreateScope.value[0]))
const selectedCreateTeamId = computed(() => selectedCreateScopeOption.value?.teamId)
const selectedCreateScopeLabel = computed(() => selectedCreateScopeOption.value?.label || '请选择公告范围')
const filterOptions = computed(() => canManageAnnouncements.value
  ? [{ label: '已发布', value: 'published' }, { label: '全部公告', value: 'all' }]
  : [{ label: '已发布', value: 'published' }])

const announcementQuery = usePagedQuery<AnnouncementOut>(({ page, pageSize }) => listOrganizationAnnouncements(appContextStore.organizationSlug, page, pageSize, {
  status: filter.value === 'published' ? 'published' : undefined,
  keyword: keyword.value.trim() || undefined,
}), { pageSize: 15 })

async function refreshList() {
  try {
    await announcementQuery.refresh()
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await announcementQuery.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

async function changeFilter(option: SegmentedOption) {
  filter.value = String(option.value) as 'published' | 'all'
  await refreshList()
}

function openAnnouncement(item: AnnouncementOut) {
  uni.navigateTo({ url: getOrganizationAnnouncementDetailRoute(item.id) })
}

function openCreate() {
  selectedCreateScope.value = []
  createScopePickerVisible.value = false
  createVisible.value = true
}

function changeCreateScope(event: PickerConfirmEvent) {
  selectedCreateScope.value = event.value
}

async function submitAnnouncement() {
  if (creating.value)
    return
  if (!selectedCreateScopeOption.value || !title.value.trim() || !body.value.trim()) {
    toast.warning('请选择公告范围并填写标题和正文')
    return
  }
  creating.value = true
  try {
    await createOrganizationAnnouncement(appContextStore.organizationSlug, {
      team_id: selectedCreateTeamId.value,
      title: title.value.trim(),
      body: body.value.trim(),
      require_acknowledgement: requireAcknowledgement.value,
    })
    createVisible.value = false
    title.value = ''
    body.value = ''
    requireAcknowledgement.value = true
    filter.value = 'all'
    toast.success('公告草稿已创建')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '公告创建失败') }
  finally { creating.value = false }
}

onShow(async () => {
  try {
    capabilities.value = await getOrganizationWorkCapabilities(appContextStore.organizationSlug)
    organizationTeams.value = canManageAnnouncements.value ? await listOrganizationWorkTeams(appContextStore.organizationSlug) : []
    if (!canManageAnnouncements.value)
      filter.value = 'published'
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '公告权限加载失败') }
  await refreshList()
})
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="announcements-page">
    <wd-toast />
    <view class="toolbar-card">
      <view class="toolbar-line">
        <wd-segmented :value="filter" :options="filterOptions" @change="changeFilter">
          <template #label="{ option }">
            {{ option.label }}
          </template>
        </wd-segmented>
        <wd-button v-if="canManageAnnouncements" size="small" @click="openCreate">
          创建公告
        </wd-button>
      </view>
      <wd-search v-model="keyword" placeholder="搜索公告标题或正文" hide-cancel @search="refreshList" @clear="refreshList" />
    </view>

    <view v-if="announcementQuery.items.value.length" class="card-list">
      <view v-for="item in announcementQuery.items.value" :key="item.id" class="record-card" @click="openAnnouncement(item)">
        <view class="card-topline">
          <strong>{{ item.title }}</strong><wd-tag :type="getAnnouncementStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <text class="announcement-body">{{ item.body }}</text>
        <view class="tag-row">
          <wd-tag v-if="shouldShowAnnouncementAcknowledgement(item)" :type="item.is_acknowledged ? 'success' : 'warning'" variant="light" size="small">
            {{ item.is_acknowledged ? '已确认' : '待确认' }}
          </wd-tag><text>{{ item.team_name || '全组织' }}</text>
        </view>
        <view class="record-meta">
          <text>{{ item.status === 'published' ? formatOrganizationWorkDateTime(item.published_at) : formatOrganizationWorkDateTime(item.created_at) }}</text><text v-if="item.can_manage && item.require_acknowledgement">{{ item.acknowledged_count || 0 }}/{{ item.recipient_count || 0 }} 已确认</text>
        </view>
      </view>
    </view>
    <AppListState :loading="announcementQuery.loading.value" :has-items="Boolean(announcementQuery.items.value.length)" :finished="announcementQuery.finished.value" :error-message="announcementQuery.error.value?.message || ''" loading-text="正在加载公告…" empty-text="当前筛选下没有公告" finished-text="没有更多公告了" @retry="refreshList" />

    <wd-popup v-model="createVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 34rpx 28rpx 28rpx; max-height: 84vh; overflow: auto;">
      <view class="popup-title">
        创建团队公告
      </view>
      <wd-cell title="公告范围" :value="selectedCreateScopeLabel" is-link @click="createScopePickerVisible = true" />
      <wd-picker v-model="selectedCreateScope" v-model:visible="createScopePickerVisible" :columns="createScopeOptions" title="选择公告范围" @confirm="changeCreateScope" />
      <wd-input v-model="title" label="公告标题" placeholder="请输入公告标题" :maxlength="120" clearable />
      <wd-textarea v-model="body" placeholder="请输入公告正文" :maxlength="5000" show-word-limit />
      <view class="acknowledgement-line">
        <view><strong>要求确认</strong><text>发布后收件人需要主动确认</text></view><wd-switch v-model="requireAcknowledgement" />
      </view>
      <wd-button block :loading="creating" @click="submitAnnouncement">
        创建公告草稿
      </wd-button>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.announcements-page {
  min-height: 100vh;
  padding: 20rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.toolbar-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.toolbar-line,
.card-topline,
.record-meta,
.tag-row,
.acknowledgement-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.toolbar-line :deep(.wd-segmented) {
  flex: 1;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}
.record-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.card-topline strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 29rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.announcement-body {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 14rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.tag-row {
  justify-content: flex-start;
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.record-meta {
  margin-top: 18rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.popup-title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.scope-tip {
  margin: 10rpx 0 20rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.acknowledgement-line {
  margin: 24rpx 0;
  padding: 22rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}
.acknowledgement-line strong,
.acknowledgement-line text {
  display: block;
}
.acknowledgement-line strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.acknowledgement-line text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
</style>
