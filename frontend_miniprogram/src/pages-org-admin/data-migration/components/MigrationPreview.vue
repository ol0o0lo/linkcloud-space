<script setup lang="ts">
import type { MigrationBatch, MigrationDecisions, MigrationIssue, MigrationOptions, MigrationRecord } from '@/services/manual/data-migration'
import { computed, ref, watch } from 'vue'
import { migrationEntityLabel, migrationFieldLabel, migrationFieldOptions, migrationOverrideValue, migrationSummaryLabel } from '@/domain/data-migration'

const props = defineProps<{ batch: MigrationBatch, options: MigrationOptions, staff: MigrationRecord[], buildings: Array<{ value: number, label: string }>, landlords: Array<{ value: number, label: string }>, loading: boolean }>()
const emit = defineEmits<{ submit: [decisions: MigrationDecisions], dirty: [value: boolean] }>()
const overrideTexts = ref<Record<string, string>>({})
const mappings = ref<MigrationDecisions['mappings']>([])
const members = ref<Record<string, number>>({})
const applyTeamName = ref(false)
const applyTeamLogo = ref(false)
const locations = ref<Record<string, { longitude: string, latitude: string, coordinate_system: string }>>({})
const error = ref('')
const pickerVisible = ref(false)
const pickerValue = ref<Array<string | number>>([])
const pickerColumns = ref<Array<{ value: number | string, label: string }>>([])
let onSelected: (value: number | string) => void = () => undefined
const issues = computed(() => props.batch.preview?.issues || [])
const editableTextFields = ['name', 'phone', 'address', 'floors', 'room_number', 'asking_rent', 'area', 'bedrooms', 'living_rooms', 'bathrooms', 'floor']
const memberColumns = computed(() => [{ value: 0, label: '暂不绑定，保留历史身份' }, ...props.options.members.map(member => ({ value: member.id, label: member.name }))])
const summary = computed(() => Object.entries(props.batch.preview?.summary || {}))
const baseline = ref('')
const signature = computed(() => JSON.stringify([overrideTexts.value, mappings.value, members.value, locations.value, applyTeamName.value, applyTeamLogo.value]))
watch([signature, baseline], ([current, original]) => emit('dirty', current !== original))

function issueKey(issue: MigrationIssue) {
  return `${issue.entity_type}:${issue.source_id}:${issue.field}`
}

watch(() => `${props.batch.id}:${props.batch.preview?.version}`, () => {
  const decisions = props.batch.preview?.decisions
  mappings.value = (decisions?.mappings || []).map(item => ({ ...item }))
  members.value = { ...decisions?.member_mappings }
  const teamFields = decisions?.overrides.find(item => item.entity_type === 'team' && item.source_id === props.batch.source_team_id)?.fields
  applyTeamName.value = teamFields?.apply_name === true
  applyTeamLogo.value = teamFields?.apply_logo === true
  overrideTexts.value = {}
  locations.value = {}
  for (const override of decisions?.overrides || []) {
    for (const [field, value] of Object.entries(override.fields))
      overrideTexts.value[`${override.entity_type}:${override.source_id}:${field}`] = typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
  for (const issue of issues.value) {
    if (issue.field === 'location') {
      const value = decisions?.overrides?.find(item => item.entity_type === issue.entity_type && item.source_id === issue.source_id)?.fields.location as { longitude?: unknown, latitude?: unknown, coordinate_system?: unknown } | undefined
      locations.value[issueKey(issue)] = { longitude: value?.longitude ? String(value.longitude) : '', latitude: value?.latitude ? String(value.latitude) : '', coordinate_system: String(value?.coordinate_system || 'gcj02') }
    }
  }
  baseline.value = signature.value
}, { immediate: true })

function choose(columns: Array<{ value: string | number, label: string }>, current: string | number, callback: (value: string | number) => void) {
  if (props.loading)
    return
  pickerColumns.value = columns
  pickerValue.value = [current]
  onSelected = callback
  pickerVisible.value = true
}
function confirmPicker(event: { value: Array<string | number> }) {
  if (event.value[0] !== undefined)
    onSelected(event.value[0])
}
function chooseMember(sourceId: string) {
  choose(memberColumns.value, members.value[sourceId] || 0, (value) => {
    const next = { ...members.value }
    if (Number(value))
      next[sourceId] = Number(value)
    else
      delete next[sourceId]
    members.value = next
  })
}
function memberName(sourceId: string) {
  return props.options.members.find(member => member.id === members.value[sourceId])?.name || '暂不绑定'
}
function chooseIssue(issue: MigrationIssue) {
  if (issue.field === 'user_id') {
    chooseMember(issue.source_id)
    return
  }
  if (migrationFieldOptions[issue.field]) {
    choose(migrationFieldOptions[issue.field], overrideTexts.value[issueKey(issue)] || migrationFieldOptions[issue.field][0].value, value => overrideTexts.value[issueKey(issue)] = String(value))
    return
  }
  if (['building_id', 'landlord_id'].includes(issue.field)) {
    const columns: Array<{ value: string | number, label: string }> = issue.field === 'building_id' ? props.buildings : [{ value: 'null', label: '取消原房东关联，保留来源档案' }, ...props.landlords]
    choose(columns, overrideTexts.value[issueKey(issue)] || '', value => overrideTexts.value[issueKey(issue)] = String(value))
    return
  }
  const current = mappings.value.find(item => item.entity_type === issue.entity_type && item.source_id === issue.source_id)
  choose((issue.candidates || []).map(item => ({ value: item.id, label: item.label })), current?.target_id ?? '', (value) => {
    if (issue.field === 'target_id') {
      mappings.value = mappings.value.filter(item => item.entity_type !== issue.entity_type || item.source_id !== issue.source_id)
      mappings.value.push({ entity_type: issue.entity_type, source_id: issue.source_id, target_id: Number(value) })
    }
    else { overrideTexts.value[issueKey(issue)] = String(value) }
  })
}
function fieldOptionLabel(issue: MigrationIssue) {
  const value = overrideTexts.value[issueKey(issue)]
  if (value === 'null')
    return '已取消原房东关联'
  const columns = issue.field === 'building_id' ? props.buildings : issue.field === 'landlord_id' ? props.landlords : migrationFieldOptions[issue.field] || []
  return columns.find(option => String(option.value) === value)?.label || `选择${migrationFieldLabel(issue.field)}`
}
function chooseCoordinates(issue: MigrationIssue) {
  const location = locations.value[issueKey(issue)]
  choose([{ value: 'gcj02', label: 'GCJ-02（高德、腾讯坐标）' }, { value: 'wgs84', label: 'WGS84（GPS 坐标）' }], location.coordinate_system, value => location.coordinate_system = String(value))
}
function mappingLabel(issue: MigrationIssue) {
  if (issue.field === 'user_id')
    return memberName(issue.source_id)
  const selected = mappings.value.find(item => item.entity_type === issue.entity_type && item.source_id === issue.source_id)
  return issue.candidates?.find(item => item.id === selected?.target_id)?.label || '选择目标记录'
}
function submit() {
  error.value = ''
  try {
    const overrides = new Map<string, MigrationDecisions['overrides'][number]>()
    for (const previous of props.batch.preview?.decisions?.overrides || [])
      overrides.set(`${previous.entity_type}:${previous.source_id}`, { ...previous, fields: { ...previous.fields } })
    const teamKey = `team:${props.batch.source_team_id}`
    const teamOverride = overrides.get(teamKey) || { entity_type: 'team', source_id: props.batch.source_team_id, fields: {} }
    teamOverride.fields.apply_name = applyTeamName.value
    teamOverride.fields.apply_logo = applyTeamLogo.value
    overrides.set(teamKey, teamOverride)
    for (const issue of issues.value) {
      let text = overrideTexts.value[issueKey(issue)]
      if (issue.field === 'location' && text !== 'null') {
        const location = locations.value[issueKey(issue)]
        if (location?.longitude || location?.latitude) {
          const longitude = Number(location.longitude)
          const latitude = Number(location.latitude)
          if (!location.longitude || !location.latitude || !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)
            throw new Error('请填写有效经纬度，或明确清空旧坐标')
          text = JSON.stringify({ longitude, latitude, coordinate_system: location.coordinate_system })
        }
      }
      if (text === undefined || text === '')
        continue
      const key = `${issue.entity_type}:${issue.source_id}`
      const item = overrides.get(key) || { entity_type: issue.entity_type, source_id: issue.source_id, fields: {} }
      item.fields[issue.field] = migrationOverrideValue(issue.field, text)
      overrides.set(key, item)
    }
    emit('submit', { overrides: Array.from(overrides.values()), mappings: mappings.value, member_mappings: members.value })
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '请检查补全资料' }
}
</script>

<template>
  <view class="preview-stack flex flex-col gap-3">
    <strong>预检结果</strong>
    <view class="summary-grid grid grid-cols-3 gap-2">
      <view v-for="[key, value] in summary" :key="key">
        <strong>{{ value }}</strong><text>{{ migrationSummaryLabel(key) }}</text>
      </view>
    </view>
    <text class="hint">预检版本 {{ batch.preview?.version.slice(0, 12) }}。修改资料或成员绑定后，请重新预检；业务阻断项全部解决后才可确认导入。</text>
    <template v-if="options.can_manage">
      <strong>组织资料</strong>
      <text class="hint">旧团队资料默认保留为历史档案。仅在明确开启以下选项后，才应用到 {{ options.organization.name }}。</text>
      <view class="member-row flex items-center justify-between gap-2">
        <text>应用旧团队名称</text><wd-switch v-model="applyTeamName" :disabled="loading" />
      </view>
      <view class="member-row flex items-center justify-between gap-2">
        <text>应用旧团队标志</text><wd-switch v-model="applyTeamLogo" :disabled="loading" />
      </view>
    </template>
    <view v-for="issue in issues" :key="issueKey(issue)" class="issue-card flex flex-col gap-2.5 border-hairline border-app-card rounded-2 border-solid p-3">
      <strong>{{ migrationEntityLabel(issue.entity_type) }} · 旧标识 {{ issue.source_id }}</strong>
      <text class="issue-message text-size-xs leading-relaxed">{{ issue.message }}</text>
      <template v-if="options.can_manage">
        <wd-button v-if="issue.field === 'user_id' || issue.field === 'target_id' && issue.candidates?.length" variant="plain" size="small" @click="chooseIssue(issue)">
          {{ mappingLabel(issue) }}
        </wd-button>
        <wd-button v-else-if="migrationFieldOptions[issue.field] || ['building_id', 'landlord_id'].includes(issue.field)" variant="plain" size="small" @click="chooseIssue(issue)">
          {{ fieldOptionLabel(issue) }}
        </wd-button>
        <template v-else-if="issue.field === 'location'">
          <text v-if="overrideTexts[issueKey(issue)] === 'null'" class="hint">已选择清空旧坐标，来源档案仍保留原值。</text>
          <template v-else-if="locations[issueKey(issue)]">
            <wd-input v-model="locations[issueKey(issue)].longitude" :disabled="loading" placeholder="经度，例如 113.324" />
            <wd-input v-model="locations[issueKey(issue)].latitude" :disabled="loading" placeholder="纬度，例如 23.106" />
            <wd-button variant="plain" size="small" @click="chooseCoordinates(issue)">
              {{ locations[issueKey(issue)].coordinate_system === 'gcj02' ? 'GCJ-02 坐标' : 'WGS84 坐标' }}
            </wd-button>
          </template>
          <wd-button variant="text" size="small" @click="overrideTexts[issueKey(issue)] = overrideTexts[issueKey(issue)] === 'null' ? '' : 'null'">
            {{ overrideTexts[issueKey(issue)] === 'null' ? '重新填写坐标' : '清空旧坐标' }}
          </wd-button>
        </template>
        <template v-else-if="editableTextFields.includes(issue.field)">
          <text class="hint">{{ migrationFieldLabel(issue.field) }}</text>
          <wd-input v-model="overrideTexts[issueKey(issue)]" :disabled="loading" :placeholder="`补全${migrationFieldLabel(issue.field)}`" clearable />
          <wd-button v-if="issue.candidates?.length" variant="text" size="small" @click="chooseIssue(issue)">
            查看可复用的目标资料
          </wd-button>
        </template>
      </template>
    </view>
    <template v-if="staff.length && options.can_manage">
      <strong>员工与组织成员绑定</strong>
      <text class="hint">只绑定现有组织成员。暂不绑定的员工保留历史身份，不会创建账号或授予权限。</text>
      <view v-for="record in staff" :key="record.id" class="member-row flex items-center justify-between gap-2">
        <view><text>{{ record.data.name || record.data.staff_name || record.source_id }}</text><text class="hint">旧员工 {{ record.source_id }}</text></view>
        <wd-button size="small" variant="plain" @click="chooseMember(record.source_id)">
          {{ memberName(record.source_id) }}
        </wd-button>
      </view>
    </template>
    <text v-if="error" class="issue-message text-size-xs leading-relaxed">{{ error }}</text>
    <wd-button v-if="options.can_manage" block :loading="loading" @click="submit">
      保存决定并重新预检
    </wd-button>
    <wd-picker v-model="pickerValue" v-model:visible="pickerVisible" :columns="pickerColumns" title="选择对应资料" @confirm="confirmPicker" />
  </view>
</template>

<style scoped>
.summary-grid view {
  @apply flex flex-col gap-1 p-2.5 rounded-2 bg-surface-page;
}
.summary-grid strong {
  @apply text-size-base;
}
.summary-grid text,
.hint {
  @apply text-size-2xs leading-relaxed text-content-muted;
}
.issue-card strong {
  @apply text-size-xs;
}
.issue-message {
  color: var(--app-color-danger, #d94a4a);
}
.member-row view {
  @apply flex flex-col min-w-0 gap-1;
}
</style>
