<script setup lang="ts">
import type { NotificationDispatchOut, NotificationDispatchTargetOut } from '@/features/organization-admin/service'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import { buildTenantDispatchScope, getNotificationDispatchScopeLabel, getNotificationDispatchStatusLabel } from '@/domain/organization-admin'
import type { TenantDispatchScope } from '@/domain/organization-admin'
import { createOrganizationNotificationDispatch, listAllOrganizationNotificationDispatchTargets, listOrganizationNotificationDispatches } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { createLatestRequestGuard } from '@/hooks/useAsyncTask'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '通知发送', navigationStyle: 'custom', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const tenantRequest = { management_context: 'tenant' as const }
const createVisible = ref(false)
const scope = ref<TenantDispatchScope>('organization')
const targetKeyword = ref('')
const targets = ref<NotificationDispatchTargetOut[]>([])
const selectedIds = ref<number[]>([])
const title = ref('')
const body = ref('')
const category = ref('')
const creating = ref(false)
const searching = ref(false)
const requestGuard = createLatestRequestGuard()

const dispatchPage = usePagedPage<NotificationDispatchOut>({
  loader: ({ page, pageSize }) => listOrganizationNotificationDispatches(appContextStore.organizationSlug, page, pageSize),
  pageSize: 15,
  keyOf: item => item.id,
})

async function refreshList() {
  await dispatchPage.refresh()
}

function changeScope(nextScope: TenantDispatchScope) {
  requestGuard.invalidate()
  scope.value = nextScope
  selectedIds.value = []
  targets.value = []
  searching.value = false
  if (nextScope !== 'organization')
    void searchTargets()
}

function toggleTarget(id: number) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0)
    selectedIds.value.splice(index, 1)
  else
    selectedIds.value.push(id)
}

async function searchTargets() {
  if (scope.value === 'organization')
    return
  const scopeSnapshot = scope.value
  const keywordSnapshot = targetKeyword.value.trim()
  const organizationSlugSnapshot = appContextStore.organizationSlug
  const requestGeneration = requestGuard.begin()
  searching.value = true
  try {
    const nextTargets = await listAllOrganizationNotificationDispatchTargets(organizationSlugSnapshot, scopeSnapshot, keywordSnapshot)
    if (!requestGuard.isCurrent(requestGeneration) || scope.value !== scopeSnapshot)
      return
    targets.value = nextTargets
  }
  catch (error) {
    if (requestGuard.isCurrent(requestGeneration) && scope.value === scopeSnapshot)
      toast.error(error instanceof Error ? error.message : '接收对象加载失败')
  }
  finally {
    if (requestGuard.isCurrent(requestGeneration) && scope.value === scopeSnapshot)
      searching.value = false
  }
}

function openDispatch(item: NotificationDispatchOut) {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminNotificationDispatchDetail}?id=${item.id}` })
}

async function submitDispatch() {
  if (creating.value || !title.value.trim())
    return
  const organizationId = appContextStore.currentOrganization?.id
  if (!organizationId) {
    toast.error('未选择工作空间，请先切换到经纪人身份')
    return
  }
  if (scope.value !== 'organization' && !selectedIds.value.length) {
    toast.warning('请选择接收对象')
    return
  }
  const scopePayload = buildTenantDispatchScope(scope.value, organizationId, selectedIds.value)
  const confirmation = await uni.showModal({
    title: '确认发送通知',
    content: `通知将在${tenantRequest.management_context === 'tenant' ? '当前工作空间' : ''}范围内异步发送，创建后不能撤回。`,
    confirmText: '确认发送',
  })
  if (!confirmation.confirm)
    return
  creating.value = true
  try {
    await createOrganizationNotificationDispatch(appContextStore.organizationSlug, {
      ...scopePayload,
      category: category.value.trim() || 'system',
      title: title.value.trim(),
      body: body.value.trim(),
    })
    toast.success('通知已提交发送')
    createVisible.value = false
    title.value = ''
    body.value = ''
    selectedIds.value = []
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '通知发送失败') }
  finally { creating.value = false }
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="通知发送" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <view class="app-row-between app-card-plain p-3">
      <text class="text-xs text-content-muted">向整个工作空间、指定团队或成员发送通知</text><wd-button size="small" @click="createVisible = true">
        发送通知
      </wd-button>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="dispatchPage.items.value"
        item-key="id"
        :loading="dispatchPage.loading.value"
        :refreshing="dispatchPage.refreshing.value"
        :loading-more="dispatchPage.loadingMore.value"
        :finished="dispatchPage.finished.value"
        :error="dispatchPage.error.value"
        loading-text="正在加载发送记录…"
        empty-text="当前工作空间还没有发送记录"
        empty-description="创建通知后，可以在这里查看接收范围和送达情况。"
        empty-icon="no-message"
        empty-action-text="发送通知"
        finished-text="没有更多发送记录了"
        @retry="refreshList"
        @empty-action="createVisible = true"
      >
        <template #item="{ item }">
          <AppRecordCard clickable @click="openDispatch(item)">
            <template #title>
              {{ item.title }}
            </template>
            <template #status>
              <wd-tag variant="light" size="small">
                {{ getNotificationDispatchStatusLabel(item.status, item.status__mapping) }}
              </wd-tag>
            </template>
            <template #description>
              {{ item.body || '无正文' }}
            </template>
            <template #meta>
              <view class="app-row-between text-2xs">
                <text>{{ getNotificationDispatchScopeLabel(item.scope, item.scope__mapping) }} · {{ item.target_count }} 人</text><text>已发送 {{ item.delivered_count }} 人</text>
              </view>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>
    <AppBottomSheet v-model:visible="createVisible" title="发送通知" height="tall">
      <view class="flex flex-col gap-2">
        <view class="flex flex-wrap gap-1.5">
          <view
            v-for="option in [{ label: '整个工作空间', value: 'organization' }, { label: '指定团队', value: 'teams' }, { label: '指定成员', value: 'users' }]"
            :key="option.value"
            class="app-touchable rounded-full px-2 py-1.5 text-2xs"
            :class="scope === option.value ? 'bg-app-brand text-content-on-brand' : 'bg-surface-page text-content-secondary'"
            @click="changeScope(option.value as TenantDispatchScope)"
          >
            {{ option.label }}
          </view>
        </view>
        <template v-if="scope !== 'organization'">
          <wd-search v-model="targetKeyword" placeholder="搜索接收对象" hide-cancel @search="searchTargets" />
          <view v-if="searching" class="py-2.5 text-center text-content-muted">
            正在加载接收对象…
          </view>
          <view class="flex flex-wrap gap-1.5">
            <view
              v-for="target in targets"
              :key="target.id"
              class="app-touchable rounded-full px-2 py-1.5 text-2xs"
              :class="selectedIds.includes(target.id) ? 'bg-app-brand text-content-on-brand' : 'bg-surface-page text-content-secondary'"
              @click="toggleTarget(target.id)"
            >
              {{ target.label }}
            </view>
          </view>
        </template>
        <wd-cell title="通知类别代码（可选）" center>
          <wd-input v-model="category" placeholder="留空则归为系统通知" compact align-right />
        </wd-cell>
        <wd-cell title="标题" center>
          <wd-input v-model="title" placeholder="请输入通知标题" compact align-right />
        </wd-cell>
        <wd-textarea v-model="body" placeholder="请输入通知正文" :maxlength="2000" show-word-limit />
      </view>
      <template #footer>
        <wd-button block :loading="creating" :disabled="creating" @click="submitDispatch">
          确认创建并发送
        </wd-button>
      </template>
    </AppBottomSheet>
  </AppPage>
</template>
