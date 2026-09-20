<script setup lang="ts">
import type { EstateDetailOut } from '@/pages-org-rental/api/organization-rental'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

defineProps<{
  estate: EstateDetailOut
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <AppRecordCard clickable @click="$emit('click')">
    <template #title>
      {{ estate.display_name || estate.name }}
    </template>
    <template #status>
      <AppStatusTag :text="estate.property_type__mapping" />
    </template>
    <template #description>
      {{ [estate.city, estate.district, estate.address].filter(Boolean).join(' ') || '地址未登记' }}
    </template>
    <template #footer>
      <view class="app-row-between text-xs text-content-secondary">
        <text>{{ estate.building_count }} 栋</text>
        <text>{{ estate.counts.total }} 套</text>
        <text class="text-app-warm">{{ estate.counts.vacant }} 套空置</text>
      </view>
    </template>
  </AppRecordCard>
</template>
