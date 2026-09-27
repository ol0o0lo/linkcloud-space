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
    <view v-if="house.effective_tags.length" class="tag-group">
      <text v-for="tag in house.effective_tags" :key="tag" class="tag-item" :class="{ 'tag-item--inherited': !house.tags.includes(tag) }">{{ tag }}</text>
    </view>
    <view class="description">
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
    <view v-if="section === 'facts' && publicFacts.length" class="data-grid">
      <view v-for="item in publicFacts" :key="item.label" class="datum">
        <text class="datum-label">{{ item.label }}</text><text class="detail-value">{{ item.value }}</text>
      </view>
    </view>
    <view v-else-if="section === 'facts'" class="facts-empty">
      更多房屋配置待完善
    </view>
    <view v-else class="data-grid">
      <view class="datum">
        <text class="datum-label">装修 / 朝向</text><text class="detail-value">{{ house.decoration__mapping || '未登记' }} / {{ house.orientation__mapping || '未登记' }}</text>
      </view>
      <view class="datum">
        <text class="datum-label">楼栋电梯</text><text class="detail-value">{{ house.has_elevator_access ? '有电梯' : '无电梯' }}</text>
      </view>
      <view class="datum">
        <text class="datum-label">项目 / 楼栋</text><text class="detail-value">{{ house.building.estate?.display_name || house.building.estate?.name || '未登记' }} / {{ house.building.name }}</text>
      </view>
      <view class="datum">
        <text class="datum-label">房间号</text><text class="detail-value">{{ house.room_number || '未登记' }}</text>
      </view>
      <view class="datum">
        <text class="datum-label">挂牌租金</text><text class="detail-value">{{ house.asking_rent == null ? '面议' : `${money(house.asking_rent)} / 月` }}</text>
      </view>
      <view class="datum">
        <text class="datum-label">押金</text><text class="detail-value">{{ money(house.deposit_amount) }}</text>
      </view>
    </view>
    <button v-if="section !== 'facts'" class="accordion" :aria-expanded="expanded" @click="expanded = !expanded">
      <text>更多公开资料</text><text class="accordion-count">{{ additional.length }} 项</text><text class="accordion-chevron" :class="expanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
    </button>
    <view v-if="section !== 'facts' && expanded" class="data-grid">
      <view v-for="item in additional" :key="item.label" class="datum">
        <text class="datum-label">{{ item.label }}</text><text class="detail-value">{{ item.value }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.tag-item {
  padding: 4px 7px;
  border-radius: 5px;
  color: #596d83;
  font-size: 11px;
  line-height: 16px;
  background: #f1f5fa;
}
.tag-item--inherited {
  padding: 3px 6px;
  border: 1px solid #dfe6ef;
  background: #fff;
}
.description {
  margin-top: 8px;
  color: #526177;
  font-size: 12px;
  line-height: 22px;
  white-space: pre-wrap;
}
.details .detail-heading {
  margin-bottom: 10px;
}
.data-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 20px;
}
.datum {
  padding: 9px 0;
  border-bottom: 1px solid #edf1f5;
}
.datum:nth-last-child(-n + 2) {
  border: 0;
}
.datum-label {
  display: block;
  color: #78869a;
  font-size: 10px;
  line-height: 17px;
}
.datum > .detail-value {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 550;
  line-height: 19px;
  overflow-wrap: anywhere;
}
.facts-empty {
  padding: 10px 0 2px;
  color: #78869a;
  font-size: 12px;
}
.accordion {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  margin: 4px 0 -2px;
  padding: 0;
  border: 0;
  color: #182538;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  background: transparent;
}
.accordion::after {
  border: 0;
}
.accordion-count {
  margin-right: 8px;
  margin-left: auto;
  color: #78869a;
  font-size: 10px;
  font-weight: 400;
}
.accordion-chevron {
  color: #78869a;
  font-size: 16px;
}
</style>
