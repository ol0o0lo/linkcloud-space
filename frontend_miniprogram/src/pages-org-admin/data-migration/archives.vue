<script setup lang="ts">
import type { MigrationArchiveFilters, MigrationRecord } from '@/services/manual/data-migration'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { migrationEntityLabel, migrationEntityOptions, migrationStateLabel } from '@/domain/data-migration'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES } from '@/modules/routes'
import { getMigrationArchive, listMigrationArchives } from '@/services/manual/data-migration'
import { useWorkspaceStore } from '@/store/workspace'
import MigrationRecordData from './components/MigrationRecordData.vue'

definePage({ style: { navigationBarTitleText: '旧版历史档案', navigationStyle: 'custom', enablePullDownRefresh: true } })

const workspace = useWorkspaceStore()
const toast = useToast()
const batchId = ref('')
const search = ref('')
const entityType = ref<Array<string | number>>([''])
const pickerVisible = ref(false)
const selected = ref<MigrationRecord | null>(null)
const detailVisible = ref(false)
const opening = ref(false)
const filtersVisible = ref(false)
const draft = ref({ created_from: '', created_to: '', staff_id: '', bill_number: '', checked: '', approved: '', source_deleted: '' })
const appliedFilters = ref<MigrationArchiveFilters>({})
const booleanPickerVisible = ref(false)
const booleanPickerValue = ref<Array<string | number>>([''])
const booleanColumns = [{ value: '', label: '不限' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]
let booleanField: 'checked' | 'approved' | 'source_deleted' = 'checked'
let loadedSlug = ''
const archives = usePagedPage<MigrationRecord>({
  loader: ({ page, pageSize }) => listMigrationArchives(workspace.organizationSlug, page, pageSize, { ...appliedFilters.value, batch_id: batchId.value || undefined }),
  refreshOnShow: false,
  keyOf: item => item.id,
})
function booleanLabel(value: string) {
  return booleanColumns.find(item => item.value === value)?.label || '不限'
}
function chooseBoolean(field: 'checked' | 'approved' | 'source_deleted') {
  booleanField = field
  booleanPickerValue.value = [draft.value[field]]
  booleanPickerVisible.value = true
}
function confirmBoolean(event: { value: Array<string | number> }) {
  draft.value[booleanField] = String(event.value[0] || '')
}
function applyFilters() {
  for (const field of ['created_from', 'created_to'] as const) {
    const value = draft.value[field].trim()
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
      toast.warning('日期请填写 YYYY-MM-DD 格式的有效日期')
      return
    }
  }
  if (draft.value.created_from && draft.value.created_to && draft.value.created_from > draft.value.created_to) {
    toast.warning('开始日期不能晚于结束日期')
    return
  }
  appliedFilters.value = {
    entity_type: String(entityType.value[0] || '') || undefined,
    search: search.value.trim() || undefined,
    created_from: draft.value.created_from.trim() || undefined,
    created_to: draft.value.created_to.trim() || undefined,
    staff_id: draft.value.staff_id.trim() || undefined,
    bill_number: draft.value.bill_number.trim() || undefined,
    checked: draft.value.checked ? draft.value.checked === 'true' : undefined,
    approved: draft.value.approved ? draft.value.approved === 'true' : undefined,
    source_deleted: draft.value.source_deleted ? draft.value.source_deleted === 'true' : undefined,
  }
  filtersVisible.value = false
  void archives.refresh()
}
async function openRecord(record: MigrationRecord) {
  if (opening.value)
    return
  const slug = workspace.organizationSlug
  opening.value = true
  try {
    const result = await getMigrationArchive(slug, record.id)
    if (slug !== workspace.organizationSlug)
      return
    selected.value = result
    detailVisible.value = true
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '档案详情加载失败') }
  finally { opening.value = false }
}
onLoad(query => batchId.value = String(query?.batchId || ''))
onShow(() => {
  if (loadedSlug !== workspace.organizationSlug) {
    archives.reset()
    selected.value = null
    detailVisible.value = false
    loadedSlug = workspace.organizationSlug
  }
  void archives.refresh()
})
</script>

<template>
  <AppPage variant="list" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="旧版历史档案" back :fallback-url="APP_ROUTES.organizationAdminDataMigration" scroll-mode="sticky" />
    </template>
    <view class="archive-header mx-0 mb-4 mt-1.5 flex flex-col gap-3">
      <strong>{{ workspace.currentOrganization?.name }}</strong>
      <text class="hint text-size-xs text-content-muted leading-relaxed">保留旧版业务资料和处理结果，财务档案按当前权限开放。</text>
      <wd-input v-model="search" clearable placeholder="搜索旧单号、经办人、业务资料" confirm-type="search" @confirm="applyFilters" />
      <view class="filter-row flex flex-wrap gap-2">
        <wd-button size="small" variant="plain" @click="pickerVisible = true">
          {{ migrationEntityOptions.find(item => item.value === entityType[0])?.label || '全部类型' }}
        </wd-button><wd-button size="small" variant="plain" @click="filtersVisible = true">
          更多筛选
        </wd-button><wd-button size="small" @click="applyFilters">
          查询
        </wd-button><wd-button v-if="batchId" size="small" variant="text" @click="batchId = ''; archives.refresh()">
          查看全部批次
        </wd-button>
      </view>
    </view>
    <AppPagedList :items="archives.items.value" :loading="archives.loading.value" :loading-more="archives.loadingMore.value" :finished="archives.finished.value" :error="archives.error.value" empty-text="暂无可查看的历史档案" @retry="archives.refresh">
      <template #item="{ item }">
        <view class="archive-card flex flex-col app-touchable gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-4 text-size-xs text-content-primary" @click="openRecord(item)">
          <strong>{{ migrationEntityLabel(item.entity_type) }} · {{ item.source_id }}</strong><text>{{ item.data.name || item.data.houseId || item.data.bill_number || item.data.houseNum || '查看原始业务资料' }}</text><text class="hint text-size-xs text-content-muted leading-relaxed">{{ migrationStateLabel(item.state) }}{{ item.source_deleted ? ' · 来源已删除' : '' }} ›</text>
        </view>
      </template>
    </AppPagedList>
    <wd-picker v-model="entityType" v-model:visible="pickerVisible" :columns="migrationEntityOptions" title="档案类型" @confirm="applyFilters" />
    <AppBottomSheet v-model:visible="filtersVisible" title="筛选历史档案" height="tall">
      <view class="archive-header mx-0 mb-4 mt-1.5 flex flex-col gap-3">
        <text class="hint text-size-xs text-content-muted leading-relaxed">按旧版业务发生日期、经办人和审核状态筛选。</text>
        <text>开始日期</text><wd-input v-model="draft.created_from" placeholder="YYYY-MM-DD" />
        <text>结束日期</text><wd-input v-model="draft.created_to" placeholder="YYYY-MM-DD" />
        <text>旧员工编号</text><wd-input v-model="draft.staff_id" placeholder="旧版经办员工标识" />
        <text>旧账单号</text><wd-input v-model="draft.bill_number" placeholder="旧版账单号" />
        <wd-button variant="plain" @click="chooseBoolean('checked')">
          已核对：{{ booleanLabel(draft.checked) }}
        </wd-button>
        <wd-button variant="plain" @click="chooseBoolean('approved')">
          已审核通过：{{ booleanLabel(draft.approved) }}
        </wd-button>
        <wd-button variant="plain" @click="chooseBoolean('source_deleted')">
          来源已删除：{{ booleanLabel(draft.source_deleted) }}
        </wd-button>
      </view>
      <template #footer>
        <wd-button block @click="applyFilters">
          应用筛选
        </wd-button>
      </template>
    </AppBottomSheet>
    <wd-picker v-model="booleanPickerValue" v-model:visible="booleanPickerVisible" :columns="booleanColumns" :z-index="30" root-portal title="选择筛选状态" @confirm="confirmBoolean" />
    <AppBottomSheet v-model:visible="detailVisible" title="历史档案详情" height="tall">
      <MigrationRecordData v-if="selected" :record="selected" />
    </AppBottomSheet>
    <wd-toast />
  </AppPage>
</template>
