<script setup lang="ts">
import type { MigrationRecord } from '@/services/manual/data-migration'
import { computed } from 'vue'
import { migrationEntityLabel, migrationFieldLabel, migrationStateLabel } from '@/domain/data-migration'
import { APP_ROUTES } from '@/modules/routes'

const props = defineProps<{ record: MigrationRecord }>()
const fields = computed(() => Object.entries(props.record.data || {}).map(([key, value]) => ({ key, value: format(value) })))
const attachments = computed(() => (props.record.media || []).slice().sort((left, right) => left.field.localeCompare(right.field) || left.position - right.position))
function previewAttachment(url: string) {
  uni.previewImage({ current: url, urls: attachments.value.filter(item => item.media_type === 'image' && item.url).map(item => String(item.url)) })
}
function copyAttachment(url: string) {
  void uni.setClipboardData({ data: url })
}
function format(value: unknown): string {
  if (value === null || value === undefined)
    return '—'
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  if (typeof value === 'object')
    return JSON.stringify(value, null, 2)
  return String(value)
}
function openTarget() {
  if (props.record.target_id)
    uni.navigateTo({ url: `${APP_ROUTES.organizationHouseDetail}?id=${props.record.target_id}` })
}
</script>

<template>
  <view class="record-detail flex flex-col gap-3 text-size-xs text-content-primary">
    <strong>{{ migrationEntityLabel(record.entity_type) }} · {{ record.source_id }}</strong>
    <text>{{ migrationStateLabel(record.state) }}{{ record.source_deleted ? ' · 来源已删除，仅保留档案' : '' }}</text>
    <text v-if="record.error_message" class="record-error leading-relaxed">{{ record.error_message }}</text>
    <text v-if="record.target_id">对应新版{{ record.target_type }} #{{ record.target_id }}</text>
    <wd-button v-if="record.target_id && ['house', 'houses', 'house.House'].includes(record.target_type)" variant="plain" size="small" @click="openTarget">
      查看新版房源
    </wd-button>
    <text class="record-hint text-size-xs text-content-muted leading-relaxed">以下为本批次保留的旧版业务原始资料，旧版时间与新版导入时间分别保存。</text>
    <template v-if="attachments.length">
      <strong>关联历史附件</strong>
      <view v-for="item in attachments" :key="`${item.id}:${item.field}:${item.position}`" class="record-attachment flex flex-col gap-1.5">
        <image v-if="item.url && item.media_type === 'image'" class="attachment-image h-20 w-28 rounded-1.5" :src="item.url" mode="aspectFill" @click="previewAttachment(item.url)" />
        <video v-else-if="item.url && item.media_type === 'video'" class="attachment-video h-40 w-full rounded-1.5" :src="item.url" controls />
        <wd-button v-else-if="item.url" variant="plain" size="small" @click="copyAttachment(item.url)">
          复制附件访问地址
        </wd-button>
        <text v-else class="record-hint text-size-xs text-content-muted leading-relaxed">资源暂不可访问，可到迁移任务中修正来源或补传。</text>
        <text class="record-hint text-size-xs text-content-muted leading-relaxed">{{ item.source_meta?.field_path || item.field }}{{ item.source_meta?.related_field ? ` · 关联 ${item.source_meta.related_field}` : '' }} · {{ migrationStateLabel(item.status) }}{{ item.binding_state === 'detached' ? ' · 待确认关联' : '' }}</text>
      </view>
    </template>
    <view v-for="field in fields" :key="field.key" class="record-field flex flex-col gap-1.5 border-t-hairline border-t-app-card border-t-solid pt-2.5">
      <text class="record-label text-size-xs text-content-muted leading-relaxed">{{ migrationFieldLabel(field.key) }}</text>
      <text selectable class="record-value whitespace-pre-wrap leading-relaxed">{{ field.value }}</text>
    </view>
  </view>
</template>

<style scoped>
.record-value {
  overflow-wrap: anywhere;
}
.record-error {
  color: var(--app-color-danger, #d94a4a);
}
</style>
