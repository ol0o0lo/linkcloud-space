<script setup lang="ts">
import type { VacancySyncIn, VacancySyncOut } from '@/features/organization-rental/service'
import { computed, ref } from 'vue'
import { getVacancyBuildingMatchStatusLabel, getVacancyLineStatusLabel, isVacancySyncPreviewStale } from '@/domain/organization-rental'
import { applyVacancySync, previewVacancySync } from '@/features/organization-rental/service'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房表同步' } })

const appContextStore = useAppContextStore()
const rawText = ref('')
const result = ref<VacancySyncOut | null>(null)
const previewInput = ref<VacancySyncIn | null>(null)
const buildingOverrides = ref<Record<number, number>>({})
const ignoredLines = ref<number[]>([])
const previewing = ref(false)
const applying = ref(false)
const previewStale = computed(() => Boolean(result.value && !result.value.applied && isVacancySyncPreviewStale(previewInput.value, buildPayload('preview'))))
const canApply = computed(() => Boolean(result.value?.can_apply && result.value.plan_hash && !result.value.applied && !previewStale.value && !previewing.value && !applying.value))

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
}

function updateRawText(value: string) {
  rawText.value = value
  invalidatePreview()
}

async function preview() {
  if (!rawText.value.trim()) {
    uni.showToast({ title: '请先粘贴房表文本', icon: 'none' })
    return
  }
  previewing.value = true
  try {
    const payload = buildPayload('preview')
    result.value = await previewVacancySync(appContextStore.organizationSlug, payload)
    previewInput.value = payload
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '房表预览失败', icon: 'none' })
  }
  finally {
    previewing.value = false
  }
}

async function applySync() {
  if (!canApply.value || !result.value?.plan_hash)
    return
  const confirmation = await uni.showModal({ title: '执行房表同步', content: '将按当前预览更新组织房源状态，确定继续吗？', confirmText: '执行同步' })
  if (!confirmation.confirm)
    return
  applying.value = true
  try {
    const payload = buildPayload('apply', result.value.plan_hash)
    result.value = await applyVacancySync(appContextStore.organizationSlug, payload)
    previewInput.value = payload
    uni.showToast({ title: '房表同步完成', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '房表同步失败', icon: 'none' })
  }
  finally {
    applying.value = false
  }
}

function updateBuildingOverride(blockIndex: number, event: { value: string | number | boolean }) {
  buildingOverrides.value = { ...buildingOverrides.value, [blockIndex]: Number(event.value) }
  void preview()
}

function updateIgnoredLine(lineNumber: number, event: { value: string | number | boolean }) {
  const next = new Set(ignoredLines.value)
  if (event.value)
    next.add(lineNumber)
  else
    next.delete(lineNumber)
  ignoredLines.value = Array.from(next)
  void preview()
}
</script>

<template>
  <view class="sync-page">
    <view class="intro-card">
      <view class="title">
        粘贴空置房表
      </view>
      <view class="subtitle">
        系统会先解析楼栋与房号，预览无误后才会执行同步。
      </view>
      <wd-textarea :model-value="rawText" placeholder="粘贴包含楼栋、房号、租金与户型的房表文本" :maxlength="-1" :rows="10" show-word-limit @update:model-value="updateRawText" />
      <wd-button block :loading="previewing" @click="preview">
        预览同步计划
      </wd-button>
    </view>
    <view v-if="result" class="result-card">
      <view class="result-head">
        <view class="title">
          {{ result.applied ? '执行结果' : '预览结果' }}
        </view><wd-tag :type="result.can_apply ? 'success' : 'warning'" variant="light">
          {{ result.can_apply ? '可执行' : '需处理错误' }}
        </wd-tag>
      </view>
      <view v-if="previewStale" class="stale-tip">
        房表文本已修改，当前预览已失效，请重新预览。
      </view>
      <view class="metric-grid">
        <view><strong>{{ result.summary.buildings }}</strong><text>楼栋</text></view>
        <view><strong>{{ result.summary.valid_lines }}</strong><text>有效行</text></view>
        <view><strong>{{ result.summary.create_houses }}</strong><text>新增房源</text></view>
        <view><strong>{{ result.summary.update_houses }}</strong><text>更新房源</text></view>
        <view><strong>{{ result.summary.mark_vacant }}</strong><text>标记空置</text></view>
        <view><strong>{{ result.summary.mark_rented }}</strong><text>标记已租</text></view>
      </view>
      <view v-if="result.errors.length" class="error-list">
        <view v-for="(item, index) in result.errors" :key="`${item.code}-${index}`">
          第 {{ item.line_number || '-' }} 行：{{ item.message }}
        </view>
      </view>
      <view class="block-list" :class="{ 'block-list--stale': previewStale }">
        <view v-for="block in result.blocks" :key="block.block_index" class="block-card">
          <view class="block-head">
            <view>
              <view class="block-title">
                {{ block.address }}
              </view><view class="block-status">
                {{ block.building_match.name || (block.building_match.status === 'new' ? '将创建新楼栋' : '需要选择楼栋') }}
              </view>
            </view>
            <wd-tag :type="block.building_match.status === 'ambiguous' ? 'warning' : 'success'" variant="light" size="small">
              {{ getVacancyBuildingMatchStatusLabel(block.building_match.status) }}
            </wd-tag>
          </view>
          <view v-if="block.building_match.candidates.length > 1" class="candidate-section">
            <view class="section-label">
              请选择匹配楼栋
            </view>
            <wd-radio-group :model-value="buildingOverrides[block.block_index]" type="button" :disabled="previewStale || result.applied || previewing" @change="updateBuildingOverride(block.block_index, $event)">
              <wd-radio v-for="candidate in block.building_match.candidates" :key="candidate.id" :value="candidate.id">
                {{ candidate.name }} · {{ candidate.address }}
              </wd-radio>
            </wd-radio-group>
          </view>
          <view class="line-list">
            <view v-for="line in block.lines" :key="line.line_number" class="line-row">
              <view class="line-main">
                <view class="line-title">
                  第 {{ line.line_number }} 行 · {{ line.room_number || line.raw }}
                </view>
                <view class="line-meta">
                  {{ line.message || (line.asking_rent ? `租金 ${line.asking_rent}` : '已解析') }}
                </view>
              </view>
              <wd-tag :type="line.status === 'valid' ? 'success' : (line.status === 'ignored' ? 'default' : 'danger')" variant="light" size="small">
                {{ getVacancyLineStatusLabel(line.status) }}
              </wd-tag>
              <wd-checkbox v-if="line.error_code" :model-value="ignoredLines.includes(line.line_number)" :disabled="previewStale || result.applied || previewing" @change="updateIgnoredLine(line.line_number, $event)">
                忽略
              </wd-checkbox>
            </view>
          </view>
        </view>
      </view>
      <wd-button v-if="!result.applied" block :disabled="!canApply" :loading="applying" @click="applySync">
        执行同步
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.sync-page {
  min-height: 100vh;
  padding: 24rpx;
  background: var(--app-bg-page);
}
.intro-card,
.result-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.result-card {
  margin-top: 20rpx;
}
.title {
  color: var(--app-text-primary);
  font-size: 31rpx;
  font-weight: 700;
}
.subtitle {
  margin: 10rpx 0 22rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.6;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx 10rpx;
  margin: 26rpx 0;
  text-align: center;
}
.metric-grid strong,
.metric-grid text {
  display: block;
}
.metric-grid strong {
  color: var(--app-text-primary);
  font-size: 32rpx;
}
.metric-grid text {
  margin-top: 4rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.error-list {
  margin-bottom: 22rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgb(209 67 67 / 8%);
  color: var(--app-color-danger);
  font-size: 22rpx;
  line-height: 1.7;
}
.stale-tip {
  margin-top: 20rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  background: var(--app-bg-warm-soft);
  color: var(--app-color-warning);
  font-size: 22rpx;
}
.block-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-bottom: 24rpx;
}
.block-list--stale {
  opacity: 0.55;
}
.block-card {
  padding: 22rpx;
  border: 1px solid var(--app-divider-color);
  border-radius: 18rpx;
}
.block-head,
.line-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}
.block-title {
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 650;
}
.block-status,
.line-meta {
  margin-top: 5rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.candidate-section {
  margin-top: 20rpx;
}
.section-label {
  margin-bottom: 12rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
.line-list {
  margin-top: 18rpx;
}
.line-row {
  padding: 16rpx 0;
  border-top: 1px solid var(--app-divider-color);
}
.line-main {
  min-width: 0;
  flex: 1;
}
.line-title {
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
</style>
