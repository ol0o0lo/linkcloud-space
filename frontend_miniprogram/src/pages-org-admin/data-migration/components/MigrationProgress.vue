<script setup lang="ts">
import type { MigrationBatch } from '@/services/manual/data-migration'
import { computed } from 'vue'
import { migrationMediaLabel, migrationMediaPercentage, migrationStateLabel } from '@/domain/data-migration'

const props = defineProps<{ batch: MigrationBatch }>()
const businessPercentage = computed(() => {
  const summary = props.batch.summary || {}
  const processed = ['created', 'updated', 'reused', 'skipped', 'archived', 'failed'].reduce((total, key) => total + (summary[key] || 0), 0)
  return summary.total ? Math.min(100, Math.round(processed / summary.total * 100)) : props.batch.status === 'completed' ? 100 : 0
})
</script>

<template>
  <view class="progress-block flex flex-col gap-2">
    <view class="progress-heading flex justify-between gap-2 text-size-xs text-content-primary">
      <text>业务数据</text><text>{{ migrationStateLabel(batch.status) }}</text>
    </view>
    <wd-progress :percentage="businessPercentage" :duration="0" />
    <view class="progress-heading flex justify-between gap-2 text-size-xs text-content-primary">
      <text>图片与视频</text><text>{{ migrationMediaLabel(batch.media_status) }}</text>
    </view>
    <wd-progress :percentage="migrationMediaPercentage(batch.media_summary, batch.media_status)" :duration="0" />
    <text class="progress-caption text-size-2xs text-content-muted leading-relaxed">成功 {{ batch.media_summary.succeeded || 0 }} / {{ batch.media_summary.total || 0 }} · 失败 {{ batch.media_summary.failed || 0 }} · 缺失 {{ batch.media_summary.missing || 0 }} · 待确认关联 {{ batch.media_summary.detached || 0 }}</text>
  </view>
</template>
