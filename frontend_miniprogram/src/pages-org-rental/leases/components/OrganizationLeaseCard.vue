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
      {{ lease.tenant.name }}
    </template>
    <template #status>
      <AppStatusTag :text="lease.status__mapping" :tone="getOrganizationLeaseStatusTone(lease.status)" />
    </template>
    <view class="lease-house mx-0 my-2.5 flex items-start gap-1.5 text-size-xs text-content-secondary leading-relaxed">
      <view class="i-carbon-home shrink-0 text-app-brand" />
      <text>{{ formatOrganizationHouseTitle(lease.house) }}</text>
    </view>
    <view class="lease-finance flex flex-wrap justify-between border-t-hairline border-t-app-divider border-t-solid px-0 py-2.5">
      <view class="text-lg text-app-price font-bold">
        {{ formatOrganizationMoney(lease.monthly_rent) }}<text class="ml-0.5 text-xs font-normal">/月</text>
      </view>
      <text class="text-xs text-content-muted">每月 {{ lease.payment_day }} 日付款</text>
    </view>
    <template #footer>
      <text class="text-xs text-content-muted">{{ lease.start_date }} 至 {{ lease.end_date }}</text>
    </template>
    <template #actions>
      <view class="i-carbon-chevron-right text-sm text-content-muted" />
    </template>
  </AppRecordCard>
</template>

<style scoped lang="scss">
.lease-finance {
  align-items: baseline;
  gap: 8rpx 16rpx;
}
</style>
