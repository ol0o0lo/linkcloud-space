<script setup lang="ts">
import type { AnnouncementOut, TeamOperationsCapabilitiesOut, TeamOut } from '@/features/organization-work/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { buildOrganizationWorkManageScopeOptions, formatOrganizationWorkDateTime, getAnnouncementStatusTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import { createOrganizationAnnouncement, getOrganizationWorkCapabilities, listOrganizationAnnouncements, listOrganizationWorkTeams } from '@/features/organization-work/service'
import { getOrganizationAnnouncementDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '团队公告', enablePullDownRefresh: true } })

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
const announcementEmptyActionText = computed(() => {
  if (keyword.value.trim())
    return '清除搜索'
  if (filter.value === 'published' && canManageAnnouncements.value)
    return '查看全部公告'
  return canManageAnnouncements.value ? '创建公告' : ''
})
const announcementEmptyDescription = computed(() => {
  if (keyword.value.trim())
    return '试试清空搜索内容后重新查看。'
  if (filter.value === 'published' && canManageAnnouncements.value)
    return '当前没有已发布公告，可以查看草稿或创建新公告。'
  return canManageAnnouncements.value ? '创建公告后，可按空间或团队范围发布。' : '新公告发布后会显示在这里。'
})

const announcementPage = usePagedPage<AnnouncementOut>({
  loader: ({ page, pageSize }) => listOrganizationAnnouncements(appContextStore.organizationSlug, page, pageSize, {
    status: filter.value === 'published' ? 'published' : undefined,
    keyword: keyword.value.trim() || undefined,
  }),
  pageSize: 15,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

async function refreshList() {
  await announcementPage.refresh()
}

async function loadMore() {
  await announcementPage.loadMore()
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

function handleEmptyAction() {
  if (keyword.value.trim()) {
    keyword.value = ''
    void refreshList()
    return
  }
  if (filter.value === 'published' && canManageAnnouncements.value) {
    filter.value = 'all'
    void refreshList()
    return
  }
  openCreate()
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
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="团队公告" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <AppListToolbar v-model:keyword="keyword" card search-placeholder="搜索公告标题或正文" @search="refreshList" @clear="refreshList">
      <template #before>
        <view class="flex items-center gap-2">
          <wd-segmented class="min-w-0 flex-1" :value="filter" :options="filterOptions" @change="changeFilter">
            <template #label="{ option }">
              {{ option.label }}
            </template>
          </wd-segmented>
          <wd-button v-if="canManageAnnouncements" size="small" @click="openCreate">
            创建公告
          </wd-button>
        </view>
      </template>
    </AppListToolbar>

    <view class="mt-2.5">
      <AppPagedList
        :items="announcementPage.items.value"
        item-key="id"
        :loading="announcementPage.loading.value"
        :refreshing="announcementPage.refreshing.value"
        :loading-more="announcementPage.loadingMore.value"
        :finished="announcementPage.finished.value"
        :error="announcementPage.error.value"
        loading-text="正在加载公告…"
        :empty-text="keyword.trim() ? '没有找到相关公告' : filter === 'published' ? '当前没有已发布公告' : '当前还没有公告'"
        :empty-description="announcementEmptyDescription"
        empty-icon="no-message"
        :empty-action-text="announcementEmptyActionText"
        finished-text="没有更多公告了"
        @retry="refreshList"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <AppRecordCard clickable @click="openAnnouncement(item)">
            <template #title>
              {{ item.title }}
            </template>
            <template #status>
              <wd-tag :type="getAnnouncementStatusTone(item.status)" variant="light" size="small">
                {{ item.status__mapping }}
              </wd-tag>
            </template>
            <text class="announcement-body overflow-hidden leading-relaxed">{{ item.body }}</text>
            <view class="mt-2 flex items-center gap-2 text-xs text-content-muted">
              <wd-tag v-if="shouldShowAnnouncementAcknowledgement(item)" :type="item.is_acknowledged ? 'success' : 'warning'" variant="light" size="small">
                {{ item.is_acknowledged ? '已确认' : '待确认' }}
              </wd-tag><text>{{ item.team_name || '整个工作空间' }}</text>
            </view>
            <template #meta>
              <view class="app-row-between text-2xs">
                <text>{{ item.status === 'published' ? formatOrganizationWorkDateTime(item.published_at) : formatOrganizationWorkDateTime(item.created_at) }}</text><text v-if="item.can_manage && item.require_acknowledgement">{{ item.acknowledged_count || 0 }}/{{ item.recipient_count || 0 }} 已确认</text>
              </view>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>

    <AppBottomSheet v-model:visible="createVisible" title="创建团队公告" height="tall">
      <view class="flex flex-col gap-2">
        <wd-cell title="公告范围" :value="selectedCreateScopeLabel" is-link @click="createScopePickerVisible = true" />
        <wd-picker v-model="selectedCreateScope" v-model:visible="createScopePickerVisible" :columns="createScopeOptions" title="选择公告范围" @confirm="changeCreateScope" />
        <wd-cell title="公告标题" center>
          <wd-input v-model="title" placeholder="请输入公告标题" :maxlength="120" clearable compact align-right />
        </wd-cell>
        <wd-textarea v-model="body" placeholder="请输入公告正文" :maxlength="5000" show-word-limit />
        <view class="my-3 app-row-between rounded-app-md bg-surface-subtle p-2.5">
          <view><strong class="block text-sm text-content-primary">要求确认</strong><text class="mt-1 block text-2xs text-content-muted">发布后收件人需要主动确认</text></view><wd-switch v-model="requireAcknowledgement" />
        </view>
      </view>
      <template #footer>
        <wd-button block :loading="creating" @click="submitAnnouncement">
          创建公告草稿
        </wd-button>
      </template>
    </AppBottomSheet>
  </AppPage>
</template>

<style scoped>
.announcement-body {
  @apply line-clamp-3;
}
</style>
