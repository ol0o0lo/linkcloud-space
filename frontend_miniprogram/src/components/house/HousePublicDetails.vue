<script setup lang="ts">
import type { HouseOut, PublicHouseDetailOut } from '@/features/houses/service'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{ house: HouseOut | PublicHouseDetailOut, editable?: boolean, section?: 'all' | 'intro' | 'facts' }>(), { section: 'all' })
defineEmits<{ edit: [] }>()
const expanded = ref(false)
const additional = computed(() => [
  { label: '卫生间', value: props.house.bathrooms == null ? '未登记' : `${props.house.bathrooms} 个` },
  { label: '厨房', value: props.house.kitchens == null ? '未登记' : `${props.house.kitchens} 个` },
  { label: '阳台', value: props.house.balconies == null ? '未登记' : `${props.house.balconies} 个` },
  { label: '套内面积', value: props.house.interior_area ? `${Number(props.house.interior_area)}㎡` : '未登记' },
])
const publicFacts = computed(() => [
  { label: '装修', value: props.house.decoration__mapping || '' },
  { label: '朝向', value: props.house.orientation__mapping || '' },
  { label: '卫生间', value: props.house.bathrooms == null ? '' : `${props.house.bathrooms} 个` },
  { label: '厨房', value: props.house.kitchens == null ? '' : `${props.house.kitchens} 个` },
  { label: '阳台', value: props.house.balconies == null ? '' : `${props.house.balconies} 个` },
  { label: '套内面积', value: props.house.interior_area ? `${Number(props.house.interior_area)}㎡` : '' },
].filter(item => item.value))
function money(value: string | null) {
  return value == null ? '待确认' : `¥${Number(value).toLocaleString('zh-CN')}`
}
</script>

<template>
  <view v-if="section !== 'facts'" class="detail-card intro">
    <view class="detail-heading">
      <text>房源介绍</text><text class="detail-meta">公开介绍</text>
    </view>
    <view v-if="house.effective_tags.length" class="tag-group mt-2 flex flex-wrap gap-1.5">
      <text v-for="tag in house.effective_tags" :key="tag" class="tag-item rounded-1.5 bg-hex-f1f5fa px-2 py-1 text-size-2xs text-hex-596d83 leading-4" :class="{ 'tag-item--inherited': !house.tags.includes(tag) }">{{ tag }}</text>
    </view>
    <view class="description mt-2 whitespace-pre-wrap text-size-xs text-hex-526177 leading-5.5">
      {{ house.public_description || '暂无公开介绍' }}
    </view>
  </view>
  <view v-if="section !== 'intro'" class="detail-card details">
    <view class="detail-heading">
      <text>{{ section === 'facts' ? '房屋配置' : '房源资料' }}</text>
      <button v-if="editable" class="detail-text-button" @click="$emit('edit')">
        编辑 <text class="i-carbon-edit" />
      </button>
    </view>
    <view v-if="section === 'facts' && publicFacts.length" class="data-grid grid grid-cols-2 gap-x-5">
      <view v-for="item in publicFacts" :key="item.label" class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">{{ item.label }}</text><text class="detail-value">{{ item.value }}</text>
      </view>
    </view>
    <view v-else-if="section === 'facts'" class="facts-empty px-0 pb-0.5 pt-2.5 text-size-xs text-hex-78869a">
      更多房屋配置待完善
    </view>
    <view v-else class="data-grid grid grid-cols-2 gap-x-5">
      <view class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">装修 / 朝向</text><text class="detail-value">{{ house.decoration__mapping || '未登记' }} / {{ house.orientation__mapping || '未登记' }}</text>
      </view>
      <view class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">楼栋电梯</text><text class="detail-value">{{ house.has_elevator_access ? '有电梯' : '无电梯' }}</text>
      </view>
      <view class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">项目 / 楼栋</text><text class="detail-value">{{ house.building.estate?.display_name || house.building.estate?.name || '未登记' }} / {{ house.building.name }}</text>
      </view>
      <view class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">房间号</text><text class="detail-value">{{ house.room_number || '未登记' }}</text>
      </view>
      <view class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">挂牌租金</text><text class="detail-value">{{ house.asking_rent == null ? '面议' : `${money(house.asking_rent)} / 月` }}</text>
      </view>
      <view class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">押金</text><text class="detail-value">{{ money(house.deposit_amount) }}</text>
      </view>
    </view>
    <button v-if="section !== 'facts'" class="accordion mx-0 mt-1 min-h-12 w-full flex items-center border-0 bg-transparent p-0 text-size-xs text-hex-182538 font-semibold leading-5 -mb-0.5" :aria-expanded="expanded" @click="expanded = !expanded">
      <text>更多公开资料</text><text class="accordion-count text-size-2xs text-hex-78869a font-normal">{{ additional.length }} 项</text><text class="accordion-chevron text-size-base text-hex-78869a" :class="expanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
    </button>
    <view v-if="section !== 'facts' && expanded" class="data-grid grid grid-cols-2 gap-x-5">
      <view v-for="item in additional" :key="item.label" class="datum border-b-1 border-b-hex-edf1f5 border-b-solid px-0 py-2.5">
        <text class="datum-label block text-size-2xs text-hex-78869a leading-4.5">{{ item.label }}</text><text class="detail-value">{{ item.value }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.tag-item--inherited {
  @apply py-1 px-1.5;
  @apply border-1 border-solid border-hex-dfe6ef;
  @apply bg-hex-fff;
}
.details .detail-heading {
  @apply mb-2.5;
}
.datum:nth-last-child(-n + 2) {
  @apply border-0;
}
.datum > .detail-value {
  @apply block;
  @apply mt-0.5;
  @apply text-size-xs;
  @apply font-semibold;
  @apply leading-5;
  @apply break-anywhere;
}
.accordion::after {
  @apply border-0;
}
.accordion-count {
  @apply mr-2;
  @apply ml-auto;
}
</style>
