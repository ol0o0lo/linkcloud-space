<script setup lang="ts">
import type { MigrationAsset, MigrationBatch, MigrationDecisions, MigrationOptions, MigrationRecord, MigrationReport } from '@/services/manual/data-migration'
import { onHide, onLoad, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { migrationEntityLabel, migrationEntityOptions, migrationIsRunning, migrationMediaLabel, migrationStateLabel, migrationSummaryLabel } from '@/domain/data-migration'
import { usePagedPage } from '@/hooks/usePagedPage'
import { chooseAndUploadMedia } from '@/infra/upload/client'
import { APP_ROUTES } from '@/modules/routes'
import { confirmMigrationBatch, getMigrationBatch, getMigrationOptions, getMigrationReport, listMigrationAssets, listMigrationRecords, previewMigrationBatch, retryMigrationAsset, retryMigrationBatch } from '@/services/manual/data-migration'
import { requestAllOrganizationBuildings, requestAllResponsibilityLandlords } from '@/services/manual/organization-admin'
import { useWorkspaceStore } from '@/store/workspace'
import { collectAllPages } from '@/utils/pagination/collectAllPages'
import MigrationPreview from './components/MigrationPreview.vue'
import MigrationProgress from './components/MigrationProgress.vue'
import MigrationRecordData from './components/MigrationRecordData.vue'

definePage({ style: { navigationBarTitleText: '迁移任务', navigationStyle: 'custom', enablePullDownRefresh: true } })

const workspace = useWorkspaceStore()
const toast = useToast()
const batchId = ref('')
const batch = ref<MigrationBatch | null>(null)
const options = ref<MigrationOptions | null>(null)
const staff = ref<MigrationRecord[]>([])
const buildings = ref<Array<{ value: number, label: string }>>([])
const landlords = ref<Array<{ value: number, label: string }>>([])
const loading = ref(false)
const error = ref('')
const acting = ref(false)
const previewDirty = ref(false)
const adjustingBindings = ref(false)
const tab = ref<'records' | 'assets'>('records')
const errorsOnly = ref(false)
const keyword = ref('')
const entityType = ref<Array<string | number>>([''])
const entityPickerVisible = ref(false)
const selectedRecord = ref<MigrationRecord | null>(null)
const recordVisible = ref(false)
const selectedAsset = ref<MigrationAsset | null>(null)
const assetVisible = ref(false)
const assetUrl = ref('')
const report = ref<MigrationReport | null>(null)
const reportVisible = ref(false)
let slug = ''
let generation = 0
let visible = false
let timer: ReturnType<typeof setTimeout> | undefined
const previewEditable = computed(() => batch.value && ['blocked', 'awaiting_confirmation'].includes(batch.value.status))
const retryable = computed(() => batch.value && ['failed', 'partial_failed'].includes(batch.value.status))
const summary = computed(() => Object.entries(batch.value?.summary || {}))
const records = usePagedPage<MigrationRecord>({
  loader: ({ page, pageSize }) => listMigrationRecords(slug, batchId.value, page, pageSize, { state: errorsOnly.value ? 'failed' : undefined, search: keyword.value || undefined, entity_type: String(entityType.value[0] || '') || undefined }),
  enabled: () => Boolean(batch.value) && tab.value === 'records',
  refreshOnShow: false,
  pullDownRefresh: false,
  keyOf: item => item.id,
})
const assets = usePagedPage<MigrationAsset>({
  loader: ({ page, pageSize }) => listMigrationAssets(slug, batchId.value, page, pageSize, errorsOnly.value ? 'failed' : ''),
  enabled: () => Boolean(batch.value) && tab.value === 'assets',
  refreshOnShow: false,
  pullDownRefresh: false,
  keyOf: item => item.id,
})

function stopPoll() {
  if (timer)
    clearTimeout(timer)
  timer = undefined
}
function schedulePoll() {
  stopPoll()
  if (visible && batch.value && migrationIsRunning(batch.value.status, batch.value.media_status))
    timer = setTimeout(() => void refresh(false), 4000)
}
function scopeCurrent() {
  return slug === workspace.organizationSlug
}

async function refresh(full = true) {
  if (!batchId.value || !visible)
    return
  const requestGeneration = ++generation
  if (!slug)
    slug = workspace.organizationSlug
  if (!scopeCurrent()) {
    batch.value = null
    options.value = null
    error.value = '工作空间已切换，请返回当前空间的迁移任务列表'
    stopPoll()
    return
  }
  if (full)
    loading.value = true
  error.value = ''
  try {
    const [nextBatch, nextOptions] = await Promise.all([getMigrationBatch(slug, batchId.value), options.value ? Promise.resolve(options.value) : getMigrationOptions(slug)])
    if (requestGeneration !== generation || !scopeCurrent() || !visible)
      return
    const previousStatus = batch.value?.status
    batch.value = nextBatch
    options.value = nextOptions
    if (full || previousStatus !== nextBatch.status) {
      await refreshItems()
      if (previewEditable.value && nextOptions.can_manage) {
        const nextStaff = await collectAllPages(({ page, pageSize }) => listMigrationRecords(slug, batchId.value, page, pageSize, { entity_type: 'staff' }), { getKey: item => item.id })
        if (requestGeneration === generation && scopeCurrent())
          staff.value = nextStaff
        const needsReferences = nextBatch.preview?.issues.some(issue => ['building_id', 'landlord_id'].includes(issue.field))
        if (needsReferences) {
          const [buildingResult, landlordResult] = await Promise.allSettled([requestAllOrganizationBuildings(slug), requestAllResponsibilityLandlords(slug, { role: 'landlord' })])
          if (requestGeneration === generation && scopeCurrent()) {
            buildings.value = buildingResult.status === 'fulfilled' ? buildingResult.value.map(item => ({ value: item.id, label: `${item.name} · ${item.address}` })) : []
            landlords.value = landlordResult.status === 'fulfilled' ? landlordResult.value.map(item => ({ value: item.id, label: `${item.name} · ${item.phone}` })) : []
          }
        }
      }
    }
  }
  catch (cause) {
    if (requestGeneration === generation && scopeCurrent())
      error.value = cause instanceof Error ? cause.message : '迁移任务加载失败'
  }
  finally {
    if (requestGeneration === generation)
      loading.value = false
    uni.stopPullDownRefresh()
    schedulePoll()
  }
}

async function refreshItems() {
  if (tab.value === 'records')
    await records.refresh()
  else
    await assets.refresh()
}
function changeTab(value: 'records' | 'assets') {
  tab.value = value
  void refreshItems()
}
function toggleErrors() {
  errorsOnly.value = !errorsOnly.value
  void refreshItems()
}
async function savePreview(decisions: MigrationDecisions) {
  if (acting.value || !batch.value || !options.value?.can_manage || !scopeCurrent())
    return
  acting.value = true
  try {
    const result = await previewMigrationBatch(slug, batchId.value, decisions)
    if (scopeCurrent()) {
      batch.value = result
      toast.success('预检已提交')
      schedulePoll()
    }
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '预检提交失败') }
  finally { acting.value = false }
}
async function confirmImport() {
  if (acting.value || previewDirty.value || !batch.value?.preview || batch.value.status !== 'awaiting_confirmation' || !options.value?.can_manage || !scopeCurrent())
    return
  const version = batch.value.preview.version
  acting.value = true
  try {
    const result = await uni.showModal({ title: adjustingBindings.value ? '确认恢复员工绑定与分配' : '确认导入当前工作空间', content: `来源：${batch.value.source_team_name}\n目标：${options.value.organization.name}\n${adjustingBindings.value ? '确认后后台恢复新绑定员工及相应分配，已成功的业务记录保持原结果。' : '确认后将按预检结果写入业务数据。图片和视频会继续在后台迁移。'}`, confirmText: adjustingBindings.value ? '确认绑定' : '确认导入' })
    if (!result.confirm || !scopeCurrent())
      return
    const next = await confirmMigrationBatch(slug, batchId.value, version)
    if (scopeCurrent()) {
      batch.value = next
      schedulePoll()
      toast.success('导入任务已提交')
    }
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '确认失败，请刷新预检结果后重试') }
  finally { acting.value = false }
}
async function reopenMemberBindings() {
  if (acting.value || batch.value?.status !== 'completed' || !scopeCurrent() || !options.value?.can_manage)
    return
  const decisions = batch.value.preview?.decisions || { overrides: [], mappings: [], member_mappings: {} }
  await savePreview(decisions)
  if (['awaiting_confirmation', 'blocked'].includes(batch.value.status)) {
    adjustingBindings.value = true
    await refresh()
  }
}
async function retryBatch() {
  if (acting.value || !options.value?.can_manage || !scopeCurrent())
    return
  acting.value = true
  try {
    const next = await retryMigrationBatch(slug, batchId.value)
    if (scopeCurrent()) {
      batch.value = next
      schedulePoll()
      toast.success('重试已提交')
    }
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '重试失败') }
  finally { acting.value = false }
}
function openRecord(item: MigrationRecord) {
  selectedRecord.value = item
  recordVisible.value = true
}
function openAsset(item: MigrationAsset) {
  selectedAsset.value = item
  assetUrl.value = item.source_url
  assetVisible.value = true
}
async function retryAsset(reupload = false) {
  if (acting.value || !selectedAsset.value || !options.value?.can_manage || !scopeCurrent())
    return
  acting.value = true
  const assetId = selectedAsset.value.id
  try {
    let mediaId: number | undefined
    if (reupload) {
      const uploaded = await chooseAndUploadMedia({ kind: 'file', scope: { kind: 'organization', organizationSlug: slug }, mediaScope: 'org', resourceType: 'legacy_archive_asset', maxCount: 1, maxSizeBytes: 100 * 1024 * 1024, extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'pdf', 'doc', 'docx'] })
      if (!uploaded[0] || !scopeCurrent())
        return
      mediaId = uploaded[0].id
    }
    const next = await retryMigrationAsset(slug, assetId, mediaId ? { media_id: mediaId } : assetUrl.value.trim() !== selectedAsset.value.source_url ? { source_url: assetUrl.value.trim() } : {})
    if (!scopeCurrent())
      return
    assets.upsert(next)
    assetVisible.value = false
    toast.success('资源处理已提交')
    await refresh(false)
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '资源重试失败') }
  finally { acting.value = false }
}
async function showReport() {
  if (acting.value || !scopeCurrent())
    return
  acting.value = true
  try {
    const result = await getMigrationReport(slug, batchId.value)
    if (scopeCurrent()) {
      report.value = result
      reportVisible.value = true
    }
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '报告加载失败') }
  finally { acting.value = false }
}
function openArchives() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminMigrationArchives}?batchId=${encodeURIComponent(batchId.value)}` })
}
onLoad(query => batchId.value = String(query?.id || ''))
onShow(() => {
  visible = true
  void refresh()
})
onPullDownRefresh(() => void refresh())
onHide(() => {
  visible = false
  generation += 1
  stopPoll()
})
onUnload(() => {
  visible = false
  generation += 1
  stopPoll()
})
</script>

<template>
  <AppPage variant="detail" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="迁移任务" back :fallback-url="APP_ROUTES.organizationAdminDataMigration" scroll-mode="sticky" />
    </template>
    <AppErrorView v-if="error" :message="error" @retry="refresh()" />
    <view v-if="batch && options" class="detail-stack flex flex-col gap-3">
      <view class="detail-card flex flex-col gap-3 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-4">
        <text class="hint text-size-xs text-content-muted leading-relaxed">目标工作空间</text><strong class="detail-title">{{ options.organization.name }}</strong>
        <text>来源 {{ batch.source_team_name || batch.source_team_id }}</text>
        <text class="hint text-size-xs text-content-muted leading-relaxed">创建于 {{ batch.created_at.replace('T', ' ').slice(0, 16) }}</text>
        <MigrationProgress :batch="batch" />
        <text class="hint text-size-xs text-content-muted leading-relaxed">业务导入与媒体迁移独立进行，离开页面后任务仍在后台运行。</text>
        <text v-if="batch.error_message" class="error-text text-size-xs leading-relaxed">{{ batch.error_message }}</text>
        <view class="action-row flex flex-wrap items-center gap-2">
          <wd-button size="small" variant="plain" :loading="loading" @click="refresh()">
            刷新进度
          </wd-button><wd-button size="small" variant="text" :loading="acting" @click="showReport">
            查看报告
          </wd-button><wd-button size="small" variant="text" @click="openArchives">
            历史档案
          </wd-button>
        </view>
        <wd-button v-if="retryable && options.can_manage" block :loading="acting" @click="retryBatch">
          重试失败业务
        </wd-button>
        <wd-button v-if="batch.status === 'completed' && options.can_manage" block variant="plain" :loading="acting" @click="reopenMemberBindings">
          调整员工绑定
        </wd-button>
      </view>
      <view v-if="previewEditable" class="detail-card flex flex-col gap-3 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-4">
        <text v-if="adjustingBindings" class="hint text-size-xs text-content-muted leading-relaxed">可将归档的旧员工绑定到现有组织成员，确认后恢复对应分配。已成功导入的业务记录保持原结果。</text>
        <MigrationPreview :batch="batch" :options="options" :staff="staff" :buildings="buildings" :landlords="landlords" :loading="acting" @submit="savePreview" @dirty="previewDirty = $event" />
        <text v-if="previewDirty" class="hint text-size-xs text-content-muted leading-relaxed">资料已修改，请先保存并重新预检。</text>
        <wd-button v-if="batch.status === 'awaiting_confirmation' && options.can_manage" block :disabled="previewDirty" :loading="acting" @click="confirmImport">
          {{ adjustingBindings ? '确认绑定并恢复分配' : `确认导入 ${options.organization.name}` }}
        </wd-button>
      </view>
      <view class="detail-card flex flex-col gap-3 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-4">
        <strong>处理记录</strong>
        <view class="summary-row flex flex-wrap items-center gap-2 text-size-xs text-content-muted">
          <text v-for="[key, value] in summary" :key="key">{{ migrationSummaryLabel(key) }} {{ value }}</text>
        </view>
        <view class="action-row flex flex-wrap items-center gap-2">
          <wd-button size="small" :variant="tab === 'records' ? 'base' : 'plain'" @click="changeTab('records')">
            业务记录
          </wd-button><wd-button size="small" :variant="tab === 'assets' ? 'base' : 'plain'" @click="changeTab('assets')">
            媒体资源
          </wd-button><wd-button size="small" :variant="errorsOnly ? 'soft' : 'text'" @click="toggleErrors">
            {{ errorsOnly ? '仅失败' : '全部状态' }}
          </wd-button>
        </view>
        <wd-input v-if="tab === 'records'" v-model="keyword" placeholder="搜索旧标识或业务资料" confirm-type="search" clearable @confirm="refreshItems" />
        <view v-if="tab === 'records'" class="action-row flex flex-wrap items-center gap-2">
          <wd-button size="small" variant="plain" @click="entityPickerVisible = true">
            {{ migrationEntityOptions.find(item => item.value === entityType[0])?.label || '全部类型' }}
          </wd-button><text class="hint text-size-xs text-content-muted leading-relaxed">共 {{ records.total.value }} 条记录</text>
        </view>
        <AppPagedList v-if="tab === 'records'" :items="records.items.value" :loading="records.loading.value" :loading-more="records.loadingMore.value" :finished="records.finished.value" :error="records.error.value" empty-text="暂无对应业务记录" @retry="records.refresh">
          <template #item="{ item }">
            <view class="item-row app-touchable border-b-hairline border-b-app-card border-b-solid px-0 py-3 text-size-xs" @click="openRecord(item)">
              <view><strong>{{ migrationEntityLabel(item.entity_type) }} · {{ item.source_id }}</strong><text class="hint text-size-xs text-content-muted leading-relaxed">{{ migrationStateLabel(item.state) }}{{ item.source_deleted ? ' · 来源已删除' : '' }} · 查看详情 ›</text><text v-if="item.error_message" class="error-text text-size-xs leading-relaxed">{{ item.error_message }}</text></view>
            </view>
          </template>
        </AppPagedList>
        <AppPagedList v-else :items="assets.items.value" :loading="assets.loading.value" :loading-more="assets.loadingMore.value" :finished="assets.finished.value" :error="assets.error.value" empty-text="暂无对应媒体资源" @retry="assets.refresh">
          <template #item="{ item }">
            <view class="item-row app-touchable border-b-hairline border-b-app-card border-b-solid px-0 py-3 text-size-xs" @click="openAsset(item)">
              <view><strong>{{ migrationStateLabel(item.status) }} · 已尝试 {{ item.attempts }} 次</strong><text v-if="item.binding_state === 'detached'" class="error-text text-size-xs leading-relaxed">待确认关联至当前目标</text><text class="asset-url text-size-xs text-content-muted leading-relaxed">{{ item.url || item.source_url }}</text><text v-if="item.error_message" class="error-text text-size-xs leading-relaxed">{{ item.error_message }}</text></view>
            </view>
          </template>
        </AppPagedList>
      </view>
    </view>
    <text v-else-if="loading" class="hint text-size-xs text-content-muted leading-relaxed">正在加载迁移任务…</text>
    <AppBottomSheet v-model:visible="recordVisible" title="旧版记录详情" height="tall">
      <MigrationRecordData v-if="selectedRecord" :record="selectedRecord" />
    </AppBottomSheet>
    <wd-picker v-model="entityType" v-model:visible="entityPickerVisible" :columns="migrationEntityOptions" title="记录类型" @confirm="records.refresh" />
    <AppBottomSheet v-model:visible="assetVisible" title="媒体资源" height="tall">
      <view v-if="selectedAsset" class="detail-stack flex flex-col gap-3">
        <text>{{ migrationStateLabel(selectedAsset.status) }} · 已尝试 {{ selectedAsset.attempts }} 次</text>
        <text v-if="selectedAsset.error_message" class="error-text text-size-xs leading-relaxed">{{ selectedAsset.error_message }}</text>
        <text class="hint text-size-xs text-content-muted leading-relaxed">当前资源地址</text><text selectable class="asset-url text-size-xs text-content-muted leading-relaxed">{{ selectedAsset.url || selectedAsset.source_url }}</text>
        <image v-if="selectedAsset.url && selectedAsset.media_type === 'image'" class="resource-preview h-45 w-full rounded-2" :src="selectedAsset.url" mode="aspectFit" />
        <video v-else-if="selectedAsset.url && selectedAsset.media_type === 'video'" class="resource-preview h-45 w-full rounded-2" :src="selectedAsset.url" controls />
        <template v-if="options?.can_manage && (['failed', 'missing'].includes(selectedAsset.status) || selectedAsset.binding_state === 'detached')">
          <text v-if="selectedAsset.binding_state === 'detached'" class="hint text-size-xs text-content-muted leading-relaxed">媒体已迁入，但目标内容发生变化。确认重试后，将安全追加到当前目标，不覆盖现有资源。</text>
          <template v-if="selectedAsset.binding_state !== 'detached'">
            <text class="hint text-size-xs text-content-muted leading-relaxed">可修正失效地址后重试，也可补传本地文件。</text>
            <wd-input v-model="assetUrl" placeholder="新的完整资源 URL" clearable />
          </template>
          <wd-button block :loading="acting" @click="retryAsset()">
            {{ selectedAsset.binding_state === 'detached' ? '确认关联到当前目标' : '重试此资源' }}
          </wd-button>
          <wd-button v-if="selectedAsset.binding_state !== 'detached'" block variant="plain" :loading="acting" @click="retryAsset(true)">
            选择文件并补传
          </wd-button>
        </template>
      </view>
    </AppBottomSheet>
    <AppBottomSheet v-model:visible="reportVisible" title="迁移报告" height="tall">
      <view v-if="report" class="detail-stack flex flex-col gap-3">
        <strong>{{ report.source_team_name }}</strong>
        <text class="hint text-size-xs text-content-muted leading-relaxed">协议版本 {{ report.manifest.schema_version || '—' }} · 快照时间 {{ report.manifest.snapshot_at || '—' }}</text>
        <text>{{ migrationStateLabel(report.status) }} · {{ migrationMediaLabel(report.media_status) }}</text>
        <text v-if="report.manifest.complete === false" class="error-text text-size-xs leading-relaxed">来源导出存在未解决的归属异常，请在旧版修正后重新导出。</text>
        <view class="summary-row flex flex-wrap items-center gap-2 text-size-xs text-content-muted">
          <text v-for="(value, key) in report.summary" :key="key">{{ migrationSummaryLabel(String(key)) }} {{ value }}</text>
        </view>
        <text>媒体成功 {{ report.media_summary.succeeded }} / {{ report.media_summary.total }}，失败 {{ report.media_summary.failed }}，缺失 {{ report.media_summary.missing }}，待确认关联 {{ report.media_summary.detached || 0 }}</text>
        <strong>预检问题（{{ report.issues.length }}）</strong>
        <text v-for="(item, index) in report.issues" :key="index" class="error-text text-size-xs leading-relaxed">{{ migrationEntityLabel(item.entity_type) }} {{ item.source_id }}：{{ item.message }}</text>
        <strong>业务异常（{{ report.record_errors.length }}）</strong>
        <text v-for="(item, index) in report.record_errors" :key="index" class="error-text text-size-xs leading-relaxed">{{ migrationEntityLabel(item.entity_type) }} {{ item.source_id }}：{{ item.error_message }}</text>
        <strong>媒体异常（{{ report.media_errors.length }}）</strong>
        <text v-for="item in report.media_errors" :key="item.id" class="error-text text-size-xs leading-relaxed">{{ item.id }}：{{ item.error_message }}</text>
      </view>
    </AppBottomSheet>
    <wd-toast />
  </AppPage>
</template>

<style scoped>
.detail-title {
  @apply text-size-lg;
}
.item-row > view {
  @apply flex flex-col gap-1.5;
}
.asset-url {
  overflow-wrap: anywhere;
}
.error-text {
  color: var(--app-color-danger, #d94a4a);
  overflow-wrap: anywhere;
}
</style>
