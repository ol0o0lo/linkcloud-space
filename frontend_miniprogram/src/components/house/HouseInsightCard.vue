<script setup lang="ts">
import type { HouseAIInsightOut } from '@/features/houses/service'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  insight?: HouseAIInsightOut | null
  loading?: boolean
  generating?: boolean
  error?: string
  canGenerate?: boolean
}>(), { insight: null, loading: false, generating: false, error: '', canGenerate: false })
defineEmits<{ generate: [], retry: [] }>()
const expanded = ref(false)
const generatedLabel = computed(() => {
  if (!props.insight?.generated_at)
    return ''
  const date = new Date(props.insight.generated_at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}–${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
})
</script>

<template>
  <view class="detail-card insight-card">
    <view class="detail-heading">
      <view class="insight-heading">
        <text class="i-carbon-ai insight-heading-icon" /><text>AI 房源速览</text>
      </view>
      <text class="detail-meta">{{ generatedLabel || '暂无速览' }}</text>
    </view>
    <view v-if="loading" class="insight-copy">
      正在读取房源速览…
    </view>
    <view v-else-if="error" class="insight-copy">
      {{ error }}<button class="detail-text-button" @click="$emit('retry')">
        重新加载
      </button>
    </view>
    <template v-else-if="insight?.insight">
      <view class="insight-copy">
        {{ insight.insight.conclusion.text }}
      </view>
      <view class="signals">
        <view v-for="signal in insight.insight.signals" :key="`${signal.label}-${signal.value}`" class="signal">
          <text class="signal-icon" :class="signal.tone === 'positive' ? 'i-carbon-checkmark' : 'i-carbon-information'" /><text>{{ signal.label }}{{ signal.value ? ` · ${signal.value}` : '' }}</text>
        </view>
      </view>
      <view class="insight-foot">
        <text>{{ insight.source_changed ? '资料已变化 · 建议重新生成' : insight.state === 'expired' ? '速览已过期 · 请核实最新资料' : '依据房源资料 · AI 生成' }}</text>
        <button class="detail-text-button" :aria-expanded="expanded" @click="expanded = !expanded">
          {{ expanded ? '收起速览' : '展开速览' }}<text :class="expanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-right'" />
        </button>
      </view>
      <view v-if="expanded" class="insight-expanded">
        <text class="insight-label">房源亮点</text>
        <view v-for="point in insight.insight.appeal_points" :key="point.text">
          {{ point.text }}
        </view>
        <text class="insight-label">看房前问题</text>
        <view v-for="(question, index) in insight.insight.viewing_questions" :key="question.text">
          {{ index + 1 }}. {{ question.text }}
        </view>
        <text class="insight-label">内容依据</text>
        <view class="insight-source">
          <text v-for="fact in insight.insight.facts" :key="fact.id">{{ fact.label }}：{{ fact.value }}；</text>
        </view>
        <wd-button v-if="canGenerate" variant="text" size="small" :loading="generating" @click="$emit('generate')">
          <text class="i-carbon-renew" /> 重新生成
        </wd-button>
      </view>
      <wd-button v-else-if="canGenerate && (insight.source_changed || insight.state === 'expired')" variant="text" size="small" :loading="generating" @click="$emit('generate')">
        重新生成
      </wd-button>
    </template>
    <template v-else>
      <view class="insight-copy">
        {{ canGenerate ? '生成房源速览，快速了解房源亮点和看房前需要确认的问题。' : '当前房源暂无公开速览，可先查看下方房源介绍与资料。' }}
      </view>
      <view class="signals">
        <text class="signal">综合结论</text><text class="signal">房源亮点</text><text class="signal">看房问题</text>
      </view>
      <view class="insight-foot">
        <text>仅依据公开房源资料</text><wd-button v-if="canGenerate" variant="text" size="small" :loading="generating" @click="$emit('generate')">
          生成速览
        </wd-button><text v-else>待更新</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.insight-card {
  border-color: #dcebf9;
  background: linear-gradient(110deg, #f4f9ff, #fff);
}
.insight-heading {
  display: flex;
  align-items: center;
  gap: 6px;
}
.insight-heading-icon {
  color: #006bcc;
  font-size: 20px;
}
.insight-copy {
  margin: 3px 0 7px;
  color: #3e5167;
  font-size: 12px;
  line-height: 21px;
}
.signals {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.signal {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  border-radius: 4px;
  color: #55718e;
  font-size: 10px;
  line-height: 15px;
  background: #edf4fc;
}
.signal-icon {
  flex: none;
  font-size: 12px;
}
.insight-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  margin-top: 6px;
  color: #778a9f;
  font-size: 10px;
}
.insight-expanded {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid #e0ebf6;
  color: #526177;
  font-size: 12px;
  line-height: 21px;
}
.insight-label {
  display: block;
  margin: 8px 0 3px;
  color: #182538;
  font-size: 12px;
  font-weight: 600;
}
.insight-source {
  color: #78869a;
  font-size: 10px;
  line-height: 18px;
}
</style>
