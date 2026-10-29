<script setup lang="ts">
import type { BuildingOut, VacancySyncIn, VacancySyncOut } from '@/pages-org-rental/api/organization-rental'
import type { VacancySyncBlock, VacancySyncFilter } from '@/pages-org-rental/domain/vacancy-sync'
import { computed, nextTick, ref, watch } from 'vue'
import { getVacancyBuildingMatchStatusLabel, getVacancyLineStatusLabel, isVacancySyncPreviewStale } from '@/pages-org-rental/domain/organization-rental'
import { formatVacancyFieldValue, getVacancyChangeGroups, getVacancyVisibleLines, isVacancyBlockVisible, vacancyFieldLabels } from '@/pages-org-rental/domain/vacancy-sync'
import { applyVacancySync, listOrganizationBuildings, previewVacancySync } from '@/pages-org-rental/api/organization-rental'
import AppActionBar from '@/components/app/AppActionBar.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import { AppError } from '@/core/errors/app-error'
import { formatHouseLayout } from '@/domain/house'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getOrganizationHouseDetailRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '房表同步' } })

const appContextStore = useAppContextStore()
const rawText = ref('')
const result = ref<VacancySyncOut | null>(null)
const previewInput = ref<VacancySyncIn | null>(null)
const buildingOverrides = ref<Record<number, number>>({})
const ignoredLines = ref<number[]>([])
const previewing = ref(false)
const applying = ref(false)
const confirming = ref(false)
const planExpired = ref(false)
const requestError = ref('')
const showExample = ref(false)
const filter = ref<VacancySyncFilter>('all')
const expandedBlocks = ref<string[]>([])
const choosingBlock = ref<number | null>(null)
const buildingKeyword = ref('')
let generation = 0
const busy = computed(() => previewing.value || applying.value || confirming.value)
const previewStale = computed(() => Boolean(result.value && !result.value.applied && (planExpired.value || isVacancySyncPreviewStale(previewInput.value, buildPayload('preview')))))
const canApply = computed(() => Boolean(result.value?.can_apply && result.value.plan_hash && !result.value.applied && !previewStale.value && !requestError.value && !busy.value))
const visibleBlocks = computed(() => (result.value?.blocks || []).filter(block => isVacancyBlockVisible(block, filter.value)))
const selectedBlock = computed(() => result.value?.blocks.find(block => block.block_index === choosingBlock.value))
const filters: Array<{ value: VacancySyncFilter, label: string }> = [{ value: 'all', label: '全部' }, { value: 'errors', label: '错误与忽略' }, { value: 'changes', label: '只看变更' }]
const statusLabels: Record<string, string> = { listed: '招租中', paused: '暂不出租', rented: '已租' }
const exampleText = '测试路1号\n101单间1200\n202一房一厅1800采光好\n\n测试路2号\n301两房一厅2500'
const buildingList = usePagedPage<BuildingOut>({
  loader: ({ page, pageSize }) => listOrganizationBuildings(appContextStore.organizationSlug, page, pageSize, { keyword: buildingKeyword.value.trim() || undefined }),
  enabled: () => choosingBlock.value !== null,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
})
const footerHint = computed(() => {
  if (applying.value)
    return '正在更新房源，请稍候…'
  if (previewing.value)
    return '正在重新计算同步计划…'
  if (result.value?.applied)
    return '本次同步已完成'
  if (previewStale.value || requestError.value)
    return '请重新预览并核对变更'
  return result.value?.errors.length ? `还有 ${result.value.errors.length} 项问题待处理` : '核对变更明细后再执行同步'
})

function buildPayload(mode: 'preview' | 'apply', planHash?: string | null): VacancySyncIn {
  return {
    mode,
    raw_text: rawText.value,
    building_overrides: Object.entries(buildingOverrides.value)
      .map(([blockIndex, buildingId]) => ({ block_index: Number(blockIndex), building_id: buildingId }))
      .sort((left, right) => left.block_index - right.block_index),
    ignored_lines: [...ignoredLines.value].sort((left, right) => left - right),
    plan_hash: planHash ?? null,
  }
}

function invalidatePreview() {
  if (previewInput.value?.raw_text === rawText.value)
    return
  buildingOverrides.value = {}
  ignoredLines.value = []
  if (result.value?.applied)
    result.value = null
}

function updateRawText(value: string) {
  if (busy.value)
    return
  rawText.value = value
  invalidatePreview()
}

async function preview() {
  if (busy.value)
    return
  if (!rawText.value.trim()) {
    uni.showToast({ title: '请先粘贴房表文本', icon: 'none' })
    return
  }
  previewing.value = true
  requestError.value = ''
  const currentGeneration = ++generation
  const slug = appContextStore.organizationSlug
  try {
    const payload = buildPayload('preview')
    const response = await previewVacancySync(slug, payload)
    if (currentGeneration !== generation || slug !== appContextStore.organizationSlug)
      return
    result.value = response
    previewInput.value = payload
    planExpired.value = false
    expandedBlocks.value = response.blocks.filter(block => block.errors.length || block.warnings.length).map(block => String(block.block_index))
    if (!expandedBlocks.value.length && response.blocks.length)
      expandedBlocks.value = [String(response.blocks[0].block_index)]
    await nextTick()
    uni.pageScrollTo({ selector: '#sync-result', duration: 200 })
  }
  catch (error) {
    if (currentGeneration === generation)
      requestError.value = error instanceof Error ? error.message : '房表预览失败，请重试'
  }
  finally {
    if (currentGeneration === generation)
      previewing.value = false
  }
}

async function applySync() {
  if (!canApply.value || !result.value?.plan_hash)
    return
  const summary = result.value.summary
  const payload = buildPayload('apply', result.value.plan_hash)
  const currentGeneration = generation
  const slug = appContextStore.organizationSlug
  confirming.value = true
  try {
    const confirmation = await uni.showModal({
      title: '确认更新房源资料和房态',
      content: `本次涉及 ${summary.buildings} 个楼栋，新增楼栋 ${summary.create_buildings} 个；新增房源 ${summary.create_houses} 套、更新资料 ${summary.update_houses} 套；改为暂不出租 ${summary.mark_paused} 套、已租 ${summary.mark_rented} 套，忽略保护 ${summary.preserve_ignored} 套。仅处理预览中的楼栋，已租房号请在变更明细中核对。`,
      confirmText: '确认同步',
    })
    if (!confirmation.confirm || currentGeneration !== generation || slug !== appContextStore.organizationSlug)
      return
    applying.value = true
    const response = await applyVacancySync(slug, payload)
    if (currentGeneration !== generation || slug !== appContextStore.organizationSlug)
      return
    result.value = response
    previewInput.value = payload
    uni.showToast({ title: '房表同步完成', icon: 'success' })
  }
  catch (error) {
    if (currentGeneration !== generation)
      return
    planExpired.value = true
    requestError.value = error instanceof AppError && error.kind === 'conflict'
      ? '房源数据已变化，原计划已失效，请重新预览后确认。'
      : `${error instanceof Error ? error.message : '房表同步失败'}。请重新预览核对当前结果后再操作。`
  }
  finally {
    if (currentGeneration === generation) {
      applying.value = false
      confirming.value = false
    }
  }
}

function updateBuildingOverride(blockIndex: number, event: { value: string | number | boolean }) {
  if (busy.value || result.value?.applied || previewStale.value)
    return
  buildingOverrides.value = { ...buildingOverrides.value, [blockIndex]: Number(event.value) }
  void preview()
}

function updateIgnoredLine(lineNumber: number, event: { value: string | number | boolean }) {
  if (busy.value || result.value?.applied || previewStale.value)
    return
  const next = new Set(ignoredLines.value)
  if (event.value)
    next.add(lineNumber)
  else
    next.delete(lineNumber)
  ignoredLines.value = Array.from(next)
  void preview()
}

function openBuildingPicker(block: VacancySyncBlock) {
  if (busy.value || previewStale.value || result.value?.applied)
    return
  choosingBlock.value = block.block_index
  buildingKeyword.value = ''
  buildingList.reset()
  void buildingList.refresh()
}

function chooseBuilding(buildingId: number) {
  if (choosingBlock.value === null)
    return
  const blockIndex = choosingBlock.value
  choosingBlock.value = null
  updateBuildingOverride(blockIndex, { value: buildingId })
}

function resetBuilding(blockIndex: number) {
  if (busy.value || previewStale.value || result.value?.applied)
    return
  const overrides = { ...buildingOverrides.value }
  delete overrides[blockIndex]
  buildingOverrides.value = overrides
  choosingBlock.value = null
  void preview()
}

async function locateError(blockIndex: number | null | undefined, lineNumber?: number | null) {
  const block = result.value?.blocks.find(item => item.block_index === blockIndex)
  if (!block)
    return
  filter.value = 'all'
  expandedBlocks.value = Array.from(new Set([...expandedBlocks.value, String(block.block_index)]))
  await nextTick()
  const lineExists = block.lines.some(line => line.line_number === lineNumber)
  uni.pageScrollTo({ selector: lineExists ? `#sync-line-${lineNumber}` : `#sync-block-${block.block_index}`, duration: 200 })
}

async function editLine(lineNumber: number) {
  if (busy.value || result.value?.applied)
    return
  const lines = rawText.value.replace(/\r\n?/g, '\n').split('\n')
  const currentGeneration = generation
  confirming.value = true
  try {
    const response = await uni.showModal({ title: `修改第 ${lineNumber} 行`, content: lines[lineNumber - 1] || '', editable: true, confirmText: '保存并预览' })
    if (!response.confirm || currentGeneration !== generation)
      return
    if (!response.content?.trim()) {
      uni.showToast({ title: '请输入修正后的文本', icon: 'none' })
      return
    }
    lines[lineNumber - 1] = response.content
    confirming.value = false
    updateRawText(lines.join('\n'))
    await preview()
  }
  finally {
    if (currentGeneration === generation)
      confirming.value = false
  }
}

function continueSync() {
  if (busy.value)
    return
  rawText.value = ''
  result.value = null
  previewInput.value = null
  buildingOverrides.value = {}
  ignoredLines.value = []
  requestError.value = ''
  planExpired.value = false
  filter.value = 'all'
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
}

function openHouse(houseId: number) {
  if (!busy.value)
    uni.navigateTo({ url: getOrganizationHouseDetailRoute(houseId) })
}

function openHouses() {
  if (!busy.value)
    uni.navigateTo({ url: APP_ROUTES.organizationHouses })
}

watch(() => appContextStore.organizationSlug, () => {
  generation += 1
  previewing.value = false
  applying.value = false
  confirming.value = false
  choosingBlock.value = null
  buildingList.reset()
  continueSync()
})
</script>

<template>
  <view class="sync-page min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="房表同步" back scroll-mode="sticky" />
    <RentalPageHeading title="房表同步" description="粘贴房表，批量维护房源资料与房态" />
    <view class="sync-steps mx-0 mb-3.5 mt-0 flex items-center gap-2 border-hairline border-app-card rounded-3 border-solid bg-surface-card p-3">
      <view :class="{ 'sync-steps__active': !result }">
        <strong>1</strong><text>粘贴房表</text>
      </view><view class="sync-steps__line w-2.5 bg-app-border" />
      <view :class="{ 'sync-steps__active': result && !result.applied }">
        <strong>2</strong><text>核对变更</text>
      </view><view class="sync-steps__line w-2.5 bg-app-border" />
      <view :class="{ 'sync-steps__active': result?.applied }">
        <strong>3</strong><text>确认同步</text>
      </view>
    </view>
    <view class="intro-card rounded-3 bg-surface-card p-3.5">
      <view class="title text-size-base font-bold">
        粘贴待租房表
      </view>
      <view class="subtitle mx-0 mb-3 mt-1.5 text-size-xs leading-relaxed">
        每行一套房源，楼栋之间空一行。预览后核对变更，再确认同步。
      </view>
      <view class="toolbar flex flex-wrap items-center gap-1.5">
        <wd-button size="small" variant="text" :disabled="busy" @click="showExample = !showExample">
          {{ showExample ? '收起示例' : '查看格式示例' }}
        </wd-button>
        <wd-button size="small" variant="text" :disabled="busy || !rawText" @click="continueSync">
          清空
        </wd-button>
      </view>
      <view v-if="showExample" class="example whitespace-pre-wrap rounded-2 bg-surface-page p-2.5 text-size-xs leading-relaxed">
        <text>{{ exampleText }}</text>
        <view class="subtitle mx-0 mb-3 mt-1.5 text-size-xs leading-relaxed">
          每段首行填写楼栋地址，每行一套房；楼栋之间用空行分隔。单次不超过 50KB、1000 条有效房源。
        </view>
      </view>
      <view id="sync-source">
        <wd-textarea :model-value="rawText" :disabled="busy" :placeholder="exampleText" custom-style="--wot-textarea-inner-min-height: 220px; --wot-textarea-bg: var(--app-bg-page);" :maxlength="-1" @update:model-value="updateRawText" />
      </view>
      <view class="subtitle mx-0 mb-3 mt-1.5 text-size-xs leading-relaxed">
        {{ rawText.length }} 字 · 修改原文会重置楼栋选择与忽略项，请重新核对预览。
      </view>
      <wd-button block :loading="previewing" :disabled="busy || !rawText.trim()" @click="preview">
        {{ result?.applied ? '重新预览房表' : '预览同步计划' }}
      </wd-button>
    </view>
    <AppNotice v-if="requestError" class="stale-notice" tone="danger" title="操作未完成" :description="requestError" compact>
      <wd-button size="small" variant="text" :disabled="busy" @click="preview">
        重新预览
      </wd-button>
    </AppNotice>
    <view v-if="result" id="sync-result" class="result-card mt-2.5 rounded-3 bg-surface-card p-3.5">
      <view class="result-head flex items-center justify-between">
        <view class="title text-size-base font-bold">
          {{ result.applied ? '执行结果' : '预览结果' }}
        </view><wd-tag :type="result.applied || canApply ? 'success' : 'warning'" variant="light">
          {{ result.applied ? '已完成' : previewStale || requestError ? '待重新预览' : result.can_apply ? '待核对' : '需处理错误' }}
        </wd-tag>
      </view>
      <AppNotice
        v-if="previewStale"
        class="stale-notice"
        tone="warning"
        title="当前预览已失效"
        description="输入或房源数据已变化，请重新生成预览后再执行同步。"
        compact
      >
        <wd-button size="small" variant="text" :disabled="busy" @click="preview">
          重新生成预览
        </wd-button>
      </AppNotice>
      <AppNotice
        class="stale-notice"
        title="本次同步规则"
        description="清单内已有招租状态保持不变，其余有效房源设为暂不出租；清单外启用房源改为已租。仅出现在忽略行的房号保持原状；若忽略行无法识别房号，则保护该楼栋全部清单外房源。"
        compact
      />
      <view class="metric-grid grid grid-cols-3 mx-0 my-3.5 text-center">
        <view><strong>{{ result.summary.buildings }}</strong><text>楼栋</text></view>
        <view><strong>{{ result.summary.valid_lines }}</strong><text>有效行</text></view>
        <view><strong>{{ result.summary.create_houses }}</strong><text>新增房源</text></view>
        <view><strong>{{ result.summary.update_houses }}</strong><text>更新房源</text></view>
        <view><strong>{{ result.summary.mark_paused }}</strong><text>标记暂不出租</text></view>
        <view><strong>{{ result.summary.mark_rented }}</strong><text>标记已租</text></view>
        <view><strong>{{ result.summary.create_buildings }}</strong><text>新建楼栋</text></view>
        <view><strong>{{ result.summary.ignored_lines }}</strong><text>忽略行</text></view>
        <view><strong>{{ result.summary.preserve_ignored }}</strong><text>忽略保护房源</text></view>
      </view>
      <view v-if="result.errors.length" class="error-list mb-3 rounded-2 p-2.5 text-size-2xs leading-relaxed">
        <view v-for="(item, index) in result.errors" :key="`${item.code}-${index}`" class="error-item flex items-center justify-between gap-1.5">
          <text>{{ item.line_number ? `第 ${item.line_number} 行：` : '' }}{{ item.message }}</text>
          <wd-button v-if="item.block_index != null" size="mini" variant="text" :disabled="busy" @click="locateError(item.block_index, item.line_number)">
            定位
          </wd-button>
        </view>
      </view>
      <view class="toolbar filters flex flex-wrap items-center gap-1.5">
        <wd-button v-for="item in filters" :key="item.value" size="small" :variant="filter === item.value ? 'soft' : 'text'" @click="filter = item.value">
          {{ item.label }}
        </wd-button>
      </view>
      <view class="toolbar flex flex-wrap items-center gap-1.5">
        <wd-button size="mini" variant="text" @click="expandedBlocks = visibleBlocks.map(block => String(block.block_index))">
          展开全部
        </wd-button>
        <wd-button size="mini" variant="text" @click="expandedBlocks = []">
          收起全部
        </wd-button>
      </view>
      <view v-if="!visibleBlocks.length" class="subtitle mx-0 mb-3 mt-1.5 text-size-xs leading-relaxed">
        {{ filter === 'errors' ? '没有错误或忽略行' : '没有符合条件的变更' }}
      </view>
      <view class="block-list mb-3 flex flex-col gap-2.5" :class="{ 'block-list--stale': previewStale }">
        <wd-collapse v-model="expandedBlocks">
          <view v-for="block in visibleBlocks" :id="`sync-block-${block.block_index}`" :key="block.block_index" class="block-card overflow-hidden border-1 border-app-divider rounded-2.5 border-solid">
            <wd-collapse-item :name="String(block.block_index)" :title="`${block.address} · ${block.lines.length} 行${block.errors.length ? ` · ${block.errors.length} 项问题` : ''}`">
              <view class="block-head flex items-center justify-between gap-2">
                <view class="line-main min-w-0 flex-1">
                  <view class="block-title text-size-sm font-bold">
                    {{ block.building_match.name || (block.building_match.status === 'new' ? '将创建新楼栋' : '需要选择楼栋') }}
                  </view>
                  <view class="block-status mt-0.5 text-size-xs leading-relaxed">
                    {{ block.building_match.address }}
                  </view>
                </view>
                <wd-tag :type="block.building_match.status === 'ambiguous' ? 'warning' : 'success'" variant="light" size="small">
                  {{ getVacancyBuildingMatchStatusLabel(block.building_match.status) }}
                </wd-tag>
              </view>
              <view v-if="!result.applied" class="toolbar flex flex-wrap items-center gap-1.5">
                <wd-button size="small" variant="text" :disabled="previewStale || busy" @click="openBuildingPicker(block)">
                  {{ block.building_match.status === 'new' ? '选择已有楼栋' : '重新选择楼栋' }}
                </wd-button>
                <wd-button v-if="buildingOverrides[block.block_index]" size="small" variant="text" :disabled="previewStale || busy" @click="resetBuilding(block.block_index)">
                  恢复自动匹配
                </wd-button>
              </view>
              <view v-if="block.building_match.candidates.length > 1 && !result.applied" class="candidate-section mt-2.5">
                <view class="section-label mb-1.5 text-size-2xs">
                  请选择匹配楼栋
                </view>
                <wd-radio-group :model-value="buildingOverrides[block.block_index]" type="button" :disabled="previewStale || result.applied || busy" @change="updateBuildingOverride(block.block_index, $event)">
                  <wd-radio v-for="candidate in block.building_match.candidates" :key="candidate.id" :value="candidate.id">
                    {{ candidate.name }} · {{ candidate.address }}
                  </wd-radio>
                </wd-radio-group>
              </view>
              <AppNotice v-for="warning in block.warnings" :key="warning" class="stale-notice" tone="warning" title="忽略保护已启用" :description="warning" compact />
              <view v-if="filter !== 'errors'" class="change-list mt-3">
                <view v-for="group in getVacancyChangeGroups(block)" :key="group.key" class="change-group mb-2.5">
                  <view class="section-label mb-1.5 text-size-2xs" :class="{ 'danger-text': group.key === 'mark_rented' }">
                    {{ group.label }} · {{ group.items.length }} 套
                  </view>
                  <view v-for="change in group.items" :key="change.room_number" class="change-row mt-1 rounded-1.5 bg-surface-page px-2 py-1.5 text-size-xs">
                    <view class="toolbar flex flex-wrap items-center gap-1.5">
                      <text>{{ change.room_number }}</text>
                      <wd-button v-if="change.house_id" size="mini" variant="text" :disabled="busy" @click="openHouse(change.house_id)">
                        查看房源
                      </wd-button>
                    </view>
                    <view v-if="change.after_status && change.before_status !== change.after_status" class="line-meta mt-0.5 text-size-xs leading-relaxed">
                      {{ change.before_status ? statusLabels[change.before_status] || change.before_status : '新房源' }} → {{ statusLabels[change.after_status] || change.after_status }}
                    </view>
                    <view v-for="field in change.field_changes" :key="field.field" class="line-meta mt-0.5 text-size-xs leading-relaxed">
                      {{ vacancyFieldLabels[field.field] || field.field }}：{{ formatVacancyFieldValue(field.field, field.before) }} → {{ formatVacancyFieldValue(field.field, field.after) }}
                    </view>
                  </view>
                </view>
              </view>
              <view class="line-list mt-2.5">
                <view class="section-label mb-1.5 text-size-2xs">
                  {{ filter === 'errors' ? '需要核对的行' : '房表解析明细' }}
                </view>
                <view v-for="line in getVacancyVisibleLines(block, filter)" :id="`sync-line-${line.line_number}`" :key="line.line_number" class="line-row flex items-center justify-between gap-2 border-t-1 border-t-app-divider border-t-solid px-0 py-2">
                  <view class="line-main min-w-0 flex-1">
                    <view class="line-title text-size-xs">
                      第 {{ line.line_number }} 行 · {{ line.room_number || line.raw }}
                    </view>
                    <view class="line-meta raw-line mt-0.5 whitespace-pre-wrap text-size-xs leading-relaxed">
                      {{ line.raw }}
                    </view>
                    <view v-if="line.bedrooms != null" class="line-meta mt-0.5 text-size-xs leading-relaxed">
                      {{ formatHouseLayout(line.bedrooms, line.living_rooms) }} · {{ line.floor == null ? '楼层待确认' : `${line.floor}楼` }} · ¥{{ line.asking_rent }}/月
                    </view>
                    <view v-if="line.tags.length" class="line-meta mt-0.5 text-size-xs leading-relaxed">
                      {{ line.tags.join(' · ') }}
                    </view>
                    <view v-if="line.message" class="line-meta mt-0.5 text-size-xs leading-relaxed" :class="{ 'danger-text': line.status === 'error' }">
                      {{ line.message }}
                    </view>
                    <view v-if="line.status === 'ignored'" class="line-meta mt-0.5 text-size-xs leading-relaxed">
                      已跳过此行；对应房号未在其他有效行出现时保持原状。
                    </view>
                    <view v-if="!result.applied" class="toolbar flex flex-wrap items-center gap-1.5">
                      <wd-button size="mini" variant="text" :disabled="busy" @click="editLine(line.line_number)">
                        修改原文
                      </wd-button>
                      <wd-checkbox v-if="line.error_code || line.status === 'ignored'" :model-value="ignoredLines.includes(line.line_number)" :disabled="previewStale || result.applied || busy" @change="updateIgnoredLine(line.line_number, $event)">
                        {{ line.status === 'ignored' ? '取消忽略' : '忽略此行' }}
                      </wd-checkbox>
                    </view>
                  </view>
                  <wd-tag :type="line.status === 'valid' ? 'success' : (line.status === 'ignored' ? 'default' : 'danger')" variant="light" size="small">
                    {{ getVacancyLineStatusLabel(line.status) }}
                  </wd-tag>
                </view>
              </view>
            </wd-collapse-item>
          </view>
        </wd-collapse>
      </view>
    </view>
    <AppActionBar v-if="result">
      <view class="action-content w-full">
        <view class="footer-hint mb-1.5 text-size-xs" role="status">
          {{ footerHint }}
        </view>
        <view class="toolbar flex flex-wrap items-center gap-1.5">
          <template v-if="result.applied">
            <wd-button variant="plain" :disabled="busy" @click="openHouses">
              查看房源
            </wd-button>
            <wd-button :disabled="busy" @click="continueSync">
              继续同步
            </wd-button>
          </template>
          <wd-button v-else-if="previewStale || requestError" block :disabled="busy" :loading="previewing" @click="preview">
            重新预览
          </wd-button>
          <wd-button v-else block :disabled="!canApply" :loading="applying || confirming" @click="applySync">
            执行同步
          </wd-button>
        </view>
      </view>
    </AppActionBar>
    <AppBottomSheet :visible="choosingBlock !== null" title="选择已有楼栋" description="仅显示当前工作空间楼栋；选择后会重新生成同步计划。" height="tall" @update:visible="!$event && (choosingBlock = null)">
      <AppListToolbar v-model:keyword="buildingKeyword" search-placeholder="搜索楼栋名称或地址" action-text="搜索" @search="buildingList.refresh" @clear="buildingList.refresh" @action="buildingList.refresh" />
      <view v-if="selectedBlock?.building_match.candidates.length" class="candidate-section mt-2.5">
        <view class="section-label mb-1.5 text-size-2xs">
          原匹配候选
        </view>
        <AppRecordCard v-for="candidate in selectedBlock.building_match.candidates" :key="candidate.id" clickable :selected="selectedBlock.building_match.building_id === candidate.id" variant="compact" @click="chooseBuilding(candidate.id)">
          <template #title>
            {{ candidate.name }}
          </template>
          <template #description>
            {{ candidate.address }}
          </template>
        </AppRecordCard>
      </view>
      <AppPagedList :items="buildingList.items.value" :loading="buildingList.loading.value" :error="buildingList.error.value" :finished="buildingList.finished.value" empty-text="没有找到相关楼栋" @retry="buildingList.refresh">
        <template #item="{ item }">
          <AppRecordCard clickable :selected="selectedBlock?.building_match.building_id === item.id" variant="compact" @click="chooseBuilding(item.id)">
            <template #title>
              {{ item.name }}
            </template>
            <template #description>
              {{ item.address }}
            </template>
          </AppRecordCard>
        </template>
        <template #loadmore>
          <wd-button v-if="!buildingList.finished.value && buildingList.items.value.length" variant="text" block :loading="buildingList.loading.value" @click="buildingList.loadMore">
            加载更多楼栋
          </wd-button>
        </template>
      </AppPagedList>
    </AppBottomSheet>
  </view>
</template>

<style scoped lang="scss">
.sync-steps > view:not(.sync-steps__line) {
  @apply flex flex-1 items-center gap-1.5 text-content-muted text-size-xs whitespace-nowrap;
}
.sync-steps strong {
  @apply flex w-5 h-5 items-center justify-center rounded-full bg-surface-subtle;
}
.sync-steps .sync-steps__active {
  @apply text-app-brand-active font-semibold;
}
.sync-steps__active strong {
  @apply text-content-on-brand bg-app-brand;
}
.sync-steps__line {
  height: 1rpx;
}
.sync-page :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3;
}
.title {
  @apply text-content-primary;
}
.subtitle {
  @apply text-content-muted;
}
.metric-grid {
  gap: 18rpx 10rpx;
}
.metric-grid strong,
.metric-grid text {
  @apply block;
}
.metric-grid strong {
  @apply text-content-primary text-size-base;
}
.metric-grid text {
  @apply mt-0.5 text-content-muted text-size-xs;
}
.error-list {
  background: rgb(209 67 67 / 8%);
  @apply text-app-danger;
}
.stale-notice {
  @apply mt-2.5;
}
.block-list--stale {
  opacity: 0.55;
}
.block-title {
  @apply text-content-primary;
}
.block-status,
.line-meta {
  @apply text-content-muted;
  overflow-wrap: anywhere;
}
.section-label {
  @apply text-content-secondary;
}
.line-title {
  @apply text-content-secondary;
}
.toolbar {
  @apply justify-between;
}
.filters {
  @apply justify-start;
}
.example {
  @apply text-content-secondary;
}
.error-item text {
  @apply min-w-0 flex-1;
}
.change-row {
  @apply text-content-secondary;
}
.danger-text {
  @apply text-app-danger;
}
.footer-hint {
  @apply text-content-secondary;
}
</style>
