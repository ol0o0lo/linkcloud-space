<script setup lang="ts">
import type { LeaseOut } from '@/pages-org-rental/api/organization-rental'
import { formatOrganizationHouseTitle, formatOrganizationMoney, getOrganizationLeaseStatusTone } from '@/pages-org-rental/domain/organization-rental'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

defineProps<{
  lease: LeaseOut
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <AppRecordCard clickable @click="$emit('click')">
    <template #title>
      {{ formatOrganizationHouseTitle(lease.house) }}
    </template>
    <template #status>
      <AppStatusTag :text="lease.status__mapping" :tone="getOrganizationLeaseStatusTone(lease.status)" />
    </template>
    <template #description>
      {{ lease.tenant.name }} · {{ lease.tenant.phone }}
    </template>
    <view class="text-lg text-app-price font-bold">
      {{ formatOrganizationMoney(lease.monthly_rent) }}<text class="ml-0.5 text-xs font-normal">/月</text>
    </view>
    <template #footer>
      <view class="app-row-between text-xs text-content-muted">
        <text>{{ lease.start_date }} 至 {{ lease.end_date }}</text>
        <text class="text-primary">查看详情</text>
      </view>
    </template>
  </AppRecordCard>
</template>
