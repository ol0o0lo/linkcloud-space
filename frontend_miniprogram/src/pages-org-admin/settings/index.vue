<script setup lang="ts">
import type { BuildingInventoryOut, OrganizationAdminNavigationCapabilities, SettingOut, TeamOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { resolveOrganizationSettingsTeamId } from '@/domain/organization-admin'
import {
  getOrganizationAdminNavigationCapabilities,
  listAllOrganizationAdminTeams,
  listAllOrganizationBuildings,
  listOrganizationSettings,
  listOrganizationTeamSettings,
  resetOrganizationAdminSetting,
  resetOrganizationTeamSetting,
  updateOrganizationAdminSetting,
  updateOrganizationTeamSetting,
} from '@/features/organization-admin/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { createLatestRequestGuard } from '@/shared/composables/useAsyncTask'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '组织设置' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const capabilities = ref<OrganizationAdminNavigationCapabilities | null>(null)
const teams = ref<TeamOut[]>([])
const buildings = ref<BuildingInventoryOut[]>([])
const teamId = ref(0)
const settings = ref<SettingOut[]>([])
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const editorVisible = ref(false)
const editingSetting = ref<SettingOut | null>(null)
const editingTextValue = ref('')
const editingNumberValue = ref(0)
const editingSwitchValue = ref(false)
const editingSelectValue = ref<Array<string | number | boolean>>([])
const selectPickerVisible = ref(false)
const locationValue = ref<{ address: string, lat: number, lng: number } | null>(null)
const publishRulesDraft = ref<Record<string, { mode: string, min_count?: number }>>({})
const leaseAllocationMethod = ref<'percentage' | 'fixed'>('percentage')
const leaseAllocationAmount = ref(90)
const requestGuard = createLatestRequestGuard()
const publishRuleRows = [
  { key: 'landlord', label: '房东信息' },
  { key: 'rent', label: '租金' },
  { key: 'cover', label: '封面图' },
  { key: 'images', label: '房源图片', count: true },
  { key: 'floor_plan', label: '户型图' },
  { key: 'video', label: '视频', count: true },
]
const isTeamScope = computed(() => teamId.value > 0)
const currentTeam = computed(() => teams.value.find(item => item.id === teamId.value) || null)
const visibleTeams = computed(() => teams.value.filter(team => capabilities.value?.team_settings_view_ids.includes(team.id)))
const canManage = computed(() => isTeamScope.value ? capabilities.value?.team_settings_manage_ids.includes(teamId.value) === true : capabilities.value?.organization_settings_manage === true)
const settingOptions = computed(() => {
  if (editingSetting.value?.ui?.options_source === 'house.buildings') {
    return buildings.value.map((building) => {
      const estateName = building.estate?.display_name || building.estate?.name
      return { label: estateName ? `${estateName} · ${building.name}` : building.name, value: building.id }
    })
  }
  const options = editingSetting.value?.ui?.options
  if (!Array.isArray(options))
    return []
  return options.map((option) => {
    if (option && typeof option === 'object' && 'value' in option) {
      const typed = option as { label?: unknown, value: string | number | boolean }
      return { label: String(typed.label ?? typed.value), value: typed.value }
    }
    return { label: String(option), value: option as string | number | boolean }
  })
})
const selectedOptionLabel = computed(() => settingOptions.value.find(option => option.value === editingSelectValue.value[0])?.label || '请选择')
const numberUi = computed(() => editingSetting.value ? editingSetting.value.ui as { min?: number, max?: number, step?: number, unit?: string } : undefined)

function publishRuleModeLabel(mode?: string) {
  return ({ required: '不允许发布', warn: '仅提醒', off: '不检查' } as Record<string, string>)[mode || ''] || '未设置'
}

function formatSettingDescription(setting: SettingOut) {
  if (setting.key === 'property_rental.publish_rules')
    return '设置房源资料不完整时，是不允许发布、仅提醒，还是不检查。'
  if (setting.key === 'property_rental.lease_allocation_rule')
    return '团队未单独设置时使用组织规则；系统默认按成交房源月租的 90% 计算。'
  return setting.description
}

function formatSettingValue(setting: SettingOut) {
  const value = setting.value
  if (setting.key === 'property_rental.publish_rules' && value && typeof value === 'object') {
    const rules = value as Record<string, { mode?: string, min_count?: number }>
    return publishRuleRows.map((row) => {
      const count = row.count && rules[row.key]?.min_count ? `（至少 ${rules[row.key].min_count} 张）` : ''
      return `${row.label}：${publishRuleModeLabel(rules[row.key]?.mode)}${count}`
    }).join('；')
  }
  if (setting.key === 'property_rental.lease_allocation_rule' && value && typeof value === 'object') {
    const rule = value as { method?: string, rate_bp?: number, fixed_amount?: string | number }
    return rule.method === 'fixed' ? `每笔固定 ¥${Number(rule.fixed_amount || 0).toFixed(2)}` : `按月租 ${Number(rule.rate_bp || 0) / 100}%`
  }
  if (setting.widget === 'switch' || setting.value_type === 'boolean')
    return value ? '已开启' : '已关闭'
  if (setting.widget === 'location_picker' && value && typeof value === 'object')
    return String((value as { address?: unknown }).address || '已选择位置')
  if (setting.widget === 'select') {
    const options = Array.isArray(setting.ui?.options) ? setting.ui.options : []
    const selected = options.find((option) => {
      if (option && typeof option === 'object' && 'value' in option)
        return (option as { value: unknown }).value === value
      return option === value
    })
    if (selected && typeof selected === 'object' && 'label' in selected)
      return String((selected as { label?: unknown }).label ?? value)
    return selected == null ? '已选择' : String(selected)
  }
  if (setting.widget === 'tags' && Array.isArray(value))
    return value.length ? value.map(item => String(item)).join('、') : '未设置'
  if (Array.isArray(value))
    return value.length ? `${value.length} 项已配置` : '未设置'
  if (typeof value === 'object' && value !== null)
    return '已配置'
  return String(value ?? '')
}

function initializeEditor(setting: SettingOut) {
  editingSwitchValue.value = Boolean(setting.value)
  editingNumberValue.value = typeof setting.value === 'number' ? setting.value : Number(setting.value || 0)
  editingTextValue.value = setting.widget === 'tags' && Array.isArray(setting.value)
    ? setting.value.map(item => String(item)).join('、')
    : typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value ?? '', null, 2)
  editingSelectValue.value = [setting.value as string | number | boolean]
  locationValue.value = setting.value && typeof setting.value === 'object' ? setting.value as { address: string, lat: number, lng: number } : null
  if (setting.key === 'property_rental.publish_rules') {
    const source = setting.value && typeof setting.value === 'object' ? setting.value as Record<string, { mode?: string, min_count?: number }> : {}
    publishRulesDraft.value = Object.fromEntries(publishRuleRows.map(row => [row.key, { mode: source[row.key]?.mode || 'off', ...(row.count ? { min_count: Number(source[row.key]?.min_count || 0) } : {}) }]))
  }
  if (setting.key === 'property_rental.lease_allocation_rule') {
    const source = setting.value && typeof setting.value === 'object' ? setting.value as { method?: string, rate_bp?: number, fixed_amount?: string | number } : {}
    leaseAllocationMethod.value = source.method === 'fixed' ? 'fixed' : 'percentage'
    leaseAllocationAmount.value = leaseAllocationMethod.value === 'fixed' ? Number(source.fixed_amount || 0) : Number(source.rate_bp || 9000) / 100
  }
}

function buildEditingValue(setting: SettingOut): unknown {
  if (setting.key === 'property_rental.publish_rules')
    return publishRulesDraft.value
  if (setting.key === 'property_rental.lease_allocation_rule') {
    return leaseAllocationMethod.value === 'percentage'
      ? { method: 'percentage', rate_bp: Math.round(leaseAllocationAmount.value * 100), fixed_amount: null }
      : { method: 'fixed', rate_bp: null, fixed_amount: leaseAllocationAmount.value.toFixed(2) }
  }
  if (setting.widget === 'switch')
    return editingSwitchValue.value
  if (setting.widget === 'input_number')
    return editingNumberValue.value
  if (setting.widget === 'select')
    return editingSelectValue.value[0]
  if (setting.widget === 'location_picker')
    return locationValue.value
  if (setting.widget === 'tags')
    return Array.from(new Set(editingTextValue.value.split(/[,，;；、\n]/).map(item => item.trim()).filter(Boolean)))
  if (setting.value_type === 'json')
    return JSON.parse(editingTextValue.value)
  if (setting.value_type === 'boolean')
    return editingTextValue.value === 'true'
  if (setting.value_type === 'integer' || setting.value_type === 'number')
    return Number(editingTextValue.value)
  return editingTextValue.value
}

async function loadSettings() {
  const teamIdSnapshot = teamId.value
  const organizationSlugSnapshot = appContextStore.organizationSlug
  const requestGeneration = requestGuard.begin()
  loading.value = true
  loadError.value = ''
  try {
    const [nextTeams, nextCapabilities, nextSettings] = await Promise.all([
      listAllOrganizationAdminTeams(organizationSlugSnapshot),
      getOrganizationAdminNavigationCapabilities(organizationSlugSnapshot),
      teamIdSnapshot > 0 ? listOrganizationTeamSettings(organizationSlugSnapshot, teamIdSnapshot) : listOrganizationSettings(organizationSlugSnapshot),
    ])
    if (!requestGuard.isCurrent(requestGeneration) || teamId.value !== teamIdSnapshot)
      return
    if (appContextStore.organizationSlug !== organizationSlugSnapshot)
      return
    teams.value = nextTeams
    capabilities.value = nextCapabilities
    settings.value = nextSettings
  }
  catch (error) {
    if (requestGuard.isCurrent(requestGeneration) && teamId.value === teamIdSnapshot && appContextStore.organizationSlug === organizationSlugSnapshot)
      loadError.value = error instanceof Error ? error.message : '设置加载失败'
  }
  finally {
    if (requestGuard.isCurrent(requestGeneration) && teamId.value === teamIdSnapshot && appContextStore.organizationSlug === organizationSlugSnapshot)
      loading.value = false
  }
}

function switchScope(nextTeamId: number) {
  teamId.value = nextTeamId
  void loadSettings()
}

async function editSetting(setting: SettingOut) {
  if (!canManage.value)
    return
  try {
    buildings.value = setting.ui?.options_source === 'house.buildings' ? await listAllOrganizationBuildings(appContextStore.organizationSlug) : []
    editingSetting.value = setting
    initializeEditor(setting)
    editorVisible.value = true
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '设置选项加载失败') }
}

async function saveSetting() {
  if (saving.value || !editingSetting.value || !canManage.value)
    return
  saving.value = true
  try {
    const value = buildEditingValue(editingSetting.value)
    if (isTeamScope.value)
      await updateOrganizationTeamSetting(appContextStore.organizationSlug, teamId.value, editingSetting.value.key, { value })
    else
      await updateOrganizationAdminSetting(appContextStore.organizationSlug, editingSetting.value.key, { value })
    toast.success('设置已保存')
    editorVisible.value = false
    await loadSettings()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '设置保存失败') }
  finally { saving.value = false }
}

async function chooseLocation() {
  if (!canManage.value)
    return
  try {
    const result = await uni.chooseLocation({})
    locationValue.value = { address: result.address || result.name, lat: result.latitude, lng: result.longitude }
  }
  catch { /* 用户取消选择时保持原值 */ }
}

async function resetSetting(setting: SettingOut) {
  if (saving.value || !setting.is_customized || !canManage.value)
    return
  const confirmation = await uni.showModal({ title: '恢复默认设置', content: '恢复后将使用上级或系统默认值。', confirmText: '确认恢复' })
  if (!confirmation.confirm)
    return
  saving.value = true
  try {
    if (isTeamScope.value)
      await resetOrganizationTeamSetting(appContextStore.organizationSlug, teamId.value, setting.key)
    else
      await resetOrganizationAdminSetting(appContextStore.organizationSlug, setting.key)
    toast.success('已恢复默认设置')
    await loadSettings()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '恢复默认设置失败') }
  finally { saving.value = false }
}

onLoad((options) => {
  teamId.value = resolveOrganizationSettingsTeamId(appContextStore.capabilities, Number(options?.teamId || 0))
  void loadSettings()
})
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载设置…" />
    <AppErrorView v-else-if="loadError" title="设置加载失败" :message="loadError" @retry="loadSettings" />
    <template v-else>
      <scroll-view v-if="capabilities" scroll-x class="scope-strip">
        <view class="scope-row">
          <view v-if="capabilities?.organization_settings" class="scope-pill" :class="[{ active: !teamId }]" @click="switchScope(0)">
            组织设置
          </view>
          <view v-for="team in visibleTeams" :key="team.id" class="scope-pill" :class="[{ active: teamId === team.id }]" @click="switchScope(team.id)">
            {{ team.name }}
          </view>
        </view>
      </scroll-view>
      <view class="scope-title">
        {{ currentTeam?.name || appContextStore.currentOrganization?.name || '当前组织' }} · {{ isTeamScope ? '团队设置' : '组织设置' }}
      </view>
      <view class="card-list">
        <view v-for="setting in settings" :key="setting.key" class="setting-card" @click="editSetting(setting)">
          <view class="setting-main">
            <view class="title-line">
              <strong>{{ setting.label }}</strong><wd-tag v-if="setting.is_customized" type="primary" variant="light" size="small">
                已单独设置
              </wd-tag>
            </view><text>{{ formatSettingDescription(setting) }}</text><view class="setting-value">
              {{ formatSettingValue(setting) || '未设置' }}
            </view>
          </view>
          <wd-button v-if="setting.is_customized && canManage" size="small" type="danger" variant="plain" :disabled="saving" @click.stop="resetSetting(setting)">
            恢复默认
          </wd-button>
        </view>
      </view>
      <view v-if="!settings.length" class="empty-card">
        当前范围没有可见设置项
      </view>
    </template>
    <wd-popup v-model="editorVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;">
      <view class="popup-title">
        {{ editingSetting?.label }}
      </view>
      <template v-if="editingSetting?.key === 'property_rental.publish_rules'">
        <view v-for="row in publishRuleRows" :key="row.key" class="special-row">
          <text>{{ row.label }}</text>
          <wd-radio-group v-model="publishRulesDraft[row.key].mode" type="button" direction="horizontal">
            <wd-radio value="required">
              不允许发布
            </wd-radio><wd-radio value="warn">
              仅提醒
            </wd-radio><wd-radio value="off">
              不检查
            </wd-radio>
          </wd-radio-group>
          <wd-input-number v-if="row.count" v-model="publishRulesDraft[row.key].min_count" :min="0" />
        </view>
      </template>
      <template v-else-if="editingSetting?.key === 'property_rental.lease_allocation_rule'">
        <wd-radio-group v-model="leaseAllocationMethod" type="button" direction="horizontal">
          <wd-radio value="percentage">
            按月租比例
          </wd-radio><wd-radio value="fixed">
            固定金额
          </wd-radio>
        </wd-radio-group>
        <view class="special-row">
          <text>{{ leaseAllocationMethod === 'percentage' ? '员工收益比例（%）' : '每笔固定收益（元）' }}</text>
          <wd-input-number v-model="leaseAllocationAmount" :min="0.01" :max="leaseAllocationMethod === 'percentage' ? 100 : Number.MAX_SAFE_INTEGER" :step="0.01" :precision="2" />
        </view>
      </template>
      <template v-else-if="editingSetting?.widget === 'switch'">
        <wd-switch v-model="editingSwitchValue" />
      </template>
      <template v-else-if="editingSetting?.widget === 'input_number'">
        <wd-input-number v-model="editingNumberValue" :min="numberUi?.min ?? 0" :max="numberUi?.max ?? Number.MAX_SAFE_INTEGER" :step="numberUi?.step ?? 1" />
        <text v-if="numberUi?.unit" class="value-tip">
          单位：{{ numberUi.unit }}
        </text>
      </template>
      <template v-else-if="editingSetting?.widget === 'select'">
        <wd-cell :title="editingSetting.label" :value="selectedOptionLabel" is-link @click="selectPickerVisible = true" />
      </template>
      <template v-else-if="editingSetting?.widget === 'location_picker'">
        <view class="location-card">
          <text>{{ locationValue?.address || '尚未选择位置' }}</text>
          <text v-if="locationValue">{{ locationValue.lat }}, {{ locationValue.lng }}</text>
        </view>
        <wd-button variant="plain" block @click="chooseLocation">
          选择地图位置
        </wd-button>
      </template>
      <wd-input v-else-if="editingSetting?.widget === 'input' || editingSetting?.widget === 'password'" v-model="editingTextValue" :label="editingSetting.label" :show-password="editingSetting.widget === 'password'" />
      <wd-textarea v-else-if="editingSetting?.widget === 'tags'" v-model="editingTextValue" placeholder="请输入常用标签，多个标签用逗号分隔" :maxlength="1000" />
      <wd-textarea v-else v-model="editingTextValue" placeholder="请输入设置值" :maxlength="5000" />
      <wd-button block :loading="saving" :disabled="saving" @click="saveSetting">
        保存设置
      </wd-button>
    </wd-popup>
    <wd-picker v-model="editingSelectValue" v-model:visible="selectPickerVisible" :columns="settingOptions" title="选择设置值" />
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 20rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.scope-strip {
  width: 100%;
  white-space: nowrap;
}
.scope-row {
  display: inline-flex;
  gap: 12rpx;
  padding-bottom: 8rpx;
}
.scope-pill {
  padding: 13rpx 20rpx;
  border-radius: 999rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  background: var(--app-bg-card);
}
.scope-pill.active {
  color: var(--app-text-on-brand);
  background: var(--app-color-primary);
}
.scope-title {
  margin: 22rpx 6rpx 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.setting-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.setting-main {
  min-width: 0;
  flex: 1;
}
.title-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.setting-main strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.setting-main text,
.value-tip {
  display: block;
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.setting-value {
  margin-top: 12rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  overflow-wrap: anywhere;
}
.empty-card {
  padding: 36rpx;
  border-radius: 22rpx;
  color: var(--app-text-muted);
  text-align: center;
  background: var(--app-bg-card);
}
.popup-title {
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.value-tip {
  margin-bottom: 18rpx;
  line-height: 1.6;
}
.special-row,
.location-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 18rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background: var(--app-bg-page);
}
.special-row > text,
.location-card text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
</style>
