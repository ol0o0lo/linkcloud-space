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
    <template #leading>
      <view class="archive-icon h-9 w-9 flex flex-none basis-9 items-center justify-center rounded-2.5 bg-surface-brand-soft text-size-base text-app-brand-active">
        <view class="i-carbon-location" />
      </view>
    </template>
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
      <view class="archive-counts grid grid-cols-3 gap-2 border-t-hairline border-t-app-divider border-t-solid pt-2.5">
        <view><strong>{{ estate.counts.total }}</strong><text>全部房源</text></view>
        <view><strong class="archive-counts__listed">{{ estate.counts.listed }}</strong><text>招租中</text></view>
        <view><strong>{{ estate.counts.paused }}</strong><text>暂不出租</text></view>
      </view>
    </template>
  </AppRecordCard>
</template>

<style scoped lang="scss">
.archive-counts > view {
  @apply flex flex-col gap-1;
}
.archive-counts strong {
  @apply text-content-primary text-size-base;
}
.archive-counts text {
  @apply text-content-muted text-size-2xs;
}
.archive-counts .archive-counts__listed {
  @apply text-app-brand-active;
}
</style>
