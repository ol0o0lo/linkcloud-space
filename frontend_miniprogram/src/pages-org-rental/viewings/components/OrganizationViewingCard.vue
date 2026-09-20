<script setup lang="ts">
import type { ViewingRecordOut } from '@/pages-org-rental/api/organization-rental'
import { formatOrganizationDateTime, formatOrganizationHouseTitle, getOrganizationViewingStatusTone } from '@/pages-org-rental/domain/organization-rental'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

defineProps<{
  viewing: ViewingRecordOut
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <view class="viewing-card" @click="$emit('click')">
    <view class="viewing-time">
      {{ new Date(viewing.scheduled_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) }}
    </view>
    <view class="viewing-divider" />
    <view class="viewing-main">
      <strong class="viewing-title">{{ formatOrganizationHouseTitle(viewing.house) }}</strong><text class="viewing-customer">客户 {{ viewing.customer_name }} · {{ viewing.customer_phone }}</text><text class="viewing-date">{{ formatOrganizationDateTime(viewing.scheduled_at) }}</text>
    </view>
    <AppStatusTag :text="viewing.status__mapping" :tone="getOrganizationViewingStatusTone(viewing.status)" />
  </view>
</template>

<style scoped lang="scss">
.viewing-card {
  display: flex;
  min-height: 132rpx;
  padding: 26rpx 28rpx;
  align-items: center;
  gap: 20rpx;
  border-radius: 30rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.viewing-time {
  width: 104rpx;
  flex: 0 0 104rpx;
  color: var(--app-color-brand);
  font-size: 30rpx;
  font-weight: 700;
}
.viewing-divider {
  width: 1rpx;
  height: 78rpx;
  flex: 0 0 1rpx;
  background: var(--app-divider-color);
}
.viewing-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}
.viewing-title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 26rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.viewing-customer {
  color: var(--app-text-secondary);
  font-size: 21rpx;
}
.viewing-date {
  color: var(--app-text-muted);
  font-size: 19rpx;
}
</style>
