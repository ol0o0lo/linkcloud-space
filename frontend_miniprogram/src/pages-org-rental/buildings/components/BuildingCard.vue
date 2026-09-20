<script setup lang="ts">
import type { BuildingInventoryOut } from '@/pages-org-rental/api/organization-rental'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

defineProps<{
  building: BuildingInventoryOut
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <AppRecordCard clickable @click="$emit('click')">
    <template #title>
      <view>{{ building.name }}</view>
      <view class="mt-1 text-xs text-content-muted font-normal">
        {{ building.estate?.display_name || building.estate?.name || '独立楼栋' }}
      </view>
    </template>
    <template #status>
      <AppStatusTag :text="building.elevator ? '有电梯' : '无电梯'" :tone="building.elevator ? 'success' : 'default'" />
    </template>
    <template #description>
      {{ building.address || '地址未登记' }}
    </template>
    <template #footer>
      <view class="app-row-between text-xs text-content-secondary">
        <text>{{ building.floors }} 层</text>
        <text>{{ building.counts.total }} 套</text>
        <text class="text-app-warm">{{ building.counts.vacant }} 套空置</text>
      </view>
    </template>
  </AppRecordCard>
</template>
