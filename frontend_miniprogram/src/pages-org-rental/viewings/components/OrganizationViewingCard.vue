<script setup lang="ts">
import type { ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { formatOrganizationHouseTitle, getOrganizationViewingStatusTone } from '@/pages-org-rental/domain/organization-rental'
import { formatMerchantTime } from '@/domain/merchant-presentation'
import { formatPhoneDisplay } from '@/domain/phone'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

defineProps<{
  viewing: ViewingRecordOut
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <AppRecordCard clickable @click="$emit('click')">
    <template #header>
      <view class="viewing-header flex items-center justify-between gap-2">
        <view class="viewing-time min-w-0 flex items-center gap-1.5 text-size-2xs text-content-muted leading-4">
          <view class="i-carbon-calendar shrink-0" />
          <text>{{ formatMerchantTime(viewing.scheduled_at) }}</text>
        </view>
        <view class="shrink-0">
          <AppStatusTag :text="viewing.status__mapping" :tone="getOrganizationViewingStatusTone(viewing.status)" />
        </view>
      </view>
    </template>
    <view class="viewing-property flex items-start gap-1.5 border-b-hairline border-b-app-divider border-b-solid px-0 pb-2.5 pt-1.5">
      <view class="viewing-property__icon i-carbon-home mt-0.5 shrink-0" />
      <text class="viewing-title overflow-hidden text-size-sm text-content-primary font-semibold leading-5">{{ formatOrganizationHouseTitle(viewing.house) }}</text>
    </view>
    <template #footer>
      <view class="viewing-customer min-w-0 flex items-center gap-2">
        <view class="viewing-customer__avatar h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-surface-page text-size-sm text-content-secondary">
          <view class="i-carbon-user" />
        </view>
        <view class="viewing-customer__info min-w-0 flex flex-1 flex-col gap-1">
          <view class="viewing-customer__heading min-w-0 flex gap-1.5">
            <text class="viewing-customer__label shrink-0 text-size-2xs text-content-muted">客户</text>
            <text class="viewing-customer__name overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-medium leading-4.5">{{ viewing.customer_name }}</text>
          </view>
          <text class="viewing-customer__phone text-size-2xs text-content-secondary leading-4">{{ formatPhoneDisplay(viewing.customer_phone) }}</text>
        </view>
        <view class="viewing-customer__arrow i-carbon-chevron-right shrink-0 text-size-sm" />
      </view>
    </template>
  </AppRecordCard>
</template>

<style scoped lang="scss">
.viewing-property__icon {
  @apply w-4 h-4 text-app-brand;
}
.viewing-title {
  display: -webkit-box;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.viewing-customer__heading {
  align-items: baseline;
}
.viewing-customer__phone {
  overflow-wrap: anywhere;
}
.viewing-customer__arrow {
  @apply text-content-muted;
}
</style>
