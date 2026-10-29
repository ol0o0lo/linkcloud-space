import { registerAppIconDefinitions } from '@/components/AppIcon';
import { registerAppStatusDefinitions } from '@/components/AppStatus';
import type {
  MigrationBatch,
  MigrationDecisions,
  MigrationIssue,
} from '@/services/manual/dataMigration';
import { RENTAL_PATHS } from '@/utils/adminRouting';

registerAppIconDefinitions('data-migration', {
  'data-migration.task': { icon: 'solar:database-outline' },
});
registerAppStatusDefinitions('data-migration', {
  'data-migration.task': {
    states: {
      uploaded: { icon: 'organization-invite.pending', tone: 'info' },
      validating: { icon: 'invoice-request.processing', tone: 'info' },
      blocked: { icon: 'invoice-request.rejected', tone: 'warning' },
      awaiting_confirmation: {
        icon: 'organization-invite.pending',
        tone: 'warning',
      },
      importing: { icon: 'invoice-request.processing', tone: 'info' },
      completed: { icon: 'invoice-request.issued', tone: 'success' },
      partial_failed: { icon: 'invoice-request.rejected', tone: 'error' },
      failed: { icon: 'invoice-request.rejected', tone: 'error' },
      pending: { icon: 'organization-invite.pending', tone: 'warning' },
      processing: { icon: 'invoice-request.processing', tone: 'info' },
      succeeded: { icon: 'invoice-request.issued', tone: 'success' },
      missing: { icon: 'invoice-request.rejected', tone: 'error' },
      detached: { icon: 'organization-invite.pending', tone: 'warning' },
      created: { icon: 'invoice-request.issued', tone: 'success' },
      updated: { icon: 'invoice-request.issued', tone: 'success' },
      reused: { icon: 'invoice-request.issued', tone: 'default' },
      skipped: { icon: 'subscription.refund.none', tone: 'secondary' },
      archived: { icon: 'platform-content.item.expired', tone: 'secondary' },
    },
  },
});

export const statusLabels: Record<string, string> = {
  uploaded: '已上传',
  validating: '预检中',
  blocked: '待补全或处理冲突',
  awaiting_confirmation: '待确认导入',
  importing: '业务导入中',
  completed: '已完成',
  partial_failed: '部分失败',
  failed: '失败',
  pending: '待处理',
  processing: '处理中',
  succeeded: '成功',
  missing: '资源缺失',
  detached: '待确认关联',
  created: '新增',
  updated: '已确认更新',
  reused: '已确认复用',
  skipped: '相同来源跳过',
  archived: '历史归档',
};
export const entityLabels: Record<string, string> = {
  team: '团队资料',
  settings: '业务设置',
  staff: '历史员工',
  identities: '历史身份',
  staff_team_relations: '团队员工关系',
  landlords: '房东',
  buildings: '楼栋',
  houses: '房源',
  staff_landlord_relations: '房东分配',
  house_team_relations: '团队房源关系',
  bill_team_relations: '团队账单关系',
  bills: '历史账单',
  salaries: '历史薪资',
  surveys: '历史勘察',
  house_stats: '旧版统计',
  auth_applications: '入职申请',
  package: '迁移包',
};
export const fieldLabels: Record<string, string> = {
  name: '名称',
  address: '地址',
  floors: '楼栋总层数',
  phone: '联系电话',
  building_id: '目标楼栋',
  landlord_id: '目标房东',
  room_number: '房号',
  status: '房源状态',
  asking_rent: '月租金（元）',
  area: '面积（平方米）',
  bedrooms: '卧室数',
  living_rooms: '客厅数',
  bathrooms: '卫生间数',
  floor: '所在楼层',
  user_id: '组织成员',
  target_id: '复用目标',
  migration_action: '现有记录处理方式',
  location: '真实坐标',
  listing_type: '出租类型',
  complete: '导出完整性',
};
export const summaryLabels: Record<string, string> = {
  total: '包内记录',
  created: '新增',
  updated: '已确认更新',
  reused: '已确认复用',
  skipped: '相同来源跳过',
  archived: '历史归档',
  failed: '失败',
  pending: '未完成',
  conflicts: '冲突',
  errors: '错误',
};
export const numericFields = new Set([
  'floors',
  'building_id',
  'landlord_id',
  'asking_rent',
  'area',
  'bedrooms',
  'living_rooms',
  'bathrooms',
  'floor',
]);
export const emptyDecisions = (): MigrationDecisions => ({
  overrides: [],
  mappings: [],
  member_mappings: {},
});
export const issueKey = (issue: MigrationIssue) =>
  `${issue.entity_type}:${issue.source_id}:${issue.field}`;

export function setIssueDecision(
  decisions: MigrationDecisions,
  issue: MigrationIssue,
  value: unknown,
): MigrationDecisions {
  if (issue.field === 'user_id') {
    const member_mappings = { ...decisions.member_mappings };
    if (value == null || value === '') delete member_mappings[issue.source_id];
    else member_mappings[issue.source_id] = Number(value);
    return { ...decisions, member_mappings };
  }
  if (issue.field === 'target_id') {
    const mappings = decisions.mappings.filter(
      (item) =>
        item.entity_type !== issue.entity_type ||
        item.source_id !== issue.source_id,
    );
    if (value != null && value !== '')
      mappings.push({
        entity_type: issue.entity_type,
        source_id: issue.source_id,
        target_id: Number(value),
      });
    return { ...decisions, mappings };
  }
  const existing = decisions.overrides.find(
    (item) =>
      item.entity_type === issue.entity_type &&
      item.source_id === issue.source_id,
  );
  const fields = { ...existing?.fields };
  if (value === null && ['location', 'landlord_id'].includes(issue.field))
    fields[issue.field] = null;
  else if (value == null || value === '') delete fields[issue.field];
  else
    fields[issue.field] = numericFields.has(issue.field)
      ? Number(value)
      : value;
  const overrides = decisions.overrides.filter((item) => item !== existing);
  if (Object.keys(fields).length)
    overrides.push({
      entity_type: issue.entity_type,
      source_id: issue.source_id,
      fields,
    });
  return { ...decisions, overrides };
}

export function issueValue(
  decisions: MigrationDecisions,
  issue: MigrationIssue,
) {
  if (issue.field === 'user_id')
    return decisions.member_mappings[issue.source_id];
  if (issue.field === 'target_id')
    return decisions.mappings.find(
      (item) =>
        item.entity_type === issue.entity_type &&
        item.source_id === issue.source_id,
    )?.target_id;
  return decisions.overrides.find(
    (item) =>
      item.entity_type === issue.entity_type &&
      item.source_id === issue.source_id,
  )?.fields[issue.field];
}

export function batchResult(batch: MigrationBatch) {
  if (batch.status !== 'completed')
    return statusLabels[batch.status] || batch.status;
  if (batch.summary.failed || batch.summary.pending) return '业务记录需要处理';
  if (batch.media_summary.detached) return '需要确认资源关联';
  if (
    batch.media_summary.failed ||
    batch.media_summary.missing ||
    batch.media_status === 'failed'
  )
    return '业务已导入，资源需要处理';
  return batch.media_status === 'completed' &&
    !batch.media_summary.pending &&
    !batch.media_summary.processing &&
    batch.media_summary.succeeded === batch.media_summary.total
    ? '全部迁移完成'
    : '业务已导入，媒体迁移中';
}

export function businessProgress(batch: MigrationBatch) {
  const summary = batch.summary;
  const total = summary.total || 0;
  const finished = [
    'created',
    'updated',
    'reused',
    'skipped',
    'archived',
  ].reduce((sum, key) => sum + (summary[key] || 0), 0);
  return {
    finished,
    total,
    percent: total
      ? Math.min(100, Math.round((finished / total) * 100))
      : undefined,
  };
}

export function targetPath(type: string, id: number | null) {
  if (id == null) return undefined;
  if (['house', 'houses'].includes(type))
    return `${RENTAL_PATHS.properties}/${id}`;
  if (['building', 'buildings'].includes(type))
    return `${RENTAL_PATHS.buildings}/${id}`;
  if (['contact', 'contacts', 'landlords'].includes(type))
    return `${RENTAL_PATHS.customers}?preview=${id}`;
  return undefined;
}

export function errorMessage(error: unknown, fallback = '请求失败，请重试') {
  const value = error as
    | {
        info?: { message?: string };
        response?: { data?: { message?: string; detail?: string } };
        message?: string;
      }
    | undefined;
  return (
    value?.info?.message ||
    value?.response?.data?.message ||
    value?.response?.data?.detail ||
    value?.message ||
    fallback
  );
}
