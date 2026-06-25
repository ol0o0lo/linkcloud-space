import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Alert, Button, Card, Col, Modal, Row, Segmented, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import {
  HOUSE_PUBLISH_RULE_MODE,
  HOUSE_PUBLISH_RULE_PRESETS,
  normalizeHousePublishRules,
  resolveHousePublishRulesPreset,
  summarizeHousePublishRules,
  type HousePublishRuleKey,
  type HousePublishRuleMode,
} from '@/pages/property-rental/publish-rules';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type HouseOut, type LeaseOut, type ViewingRecordOut } from '@/services/manual/house';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import {
  canHousePublish,
  contactLabel,
  getHouseBlockingIssues,
  getHouseIssueActionHint,
  getTrackedHousePublishIssues,
  getHouseWarningIssues,
  houseLabel,
  houseMediaReadinessText,
  HOUSE_PUBLISH_STATUS_COLOR,
  HOUSE_PUBLISH_STATUS_TEXT,
  moneyText,
  STATUS_COLOR,
  STATUS_TEXT,
} from './constants';

const dashboardHref = (path: string) => `/dashboard${path}`;
const publishRulesSettingKey = 'property_rental.publish_rules';
const HOUSE_ISSUE_TASKS: Array<{ key: HousePublishRuleKey; title: string }> = [
  { key: 'landlord', title: '待补房东' },
  { key: 'rent', title: '待补租金' },
  { key: 'cover', title: '待补封面' },
  { key: 'images', title: '图片少于 3 张' },
  { key: 'floor_plan', title: '缺户型图' },
  { key: 'video', title: '待补视频' },
];

const PRIORITY_TASK_HINTS: Record<string, string> = {
  'contact-missing': '先把成交客户补成可签约主体。',
  converted: '成交后尽快建租约，避免链路停在带看阶段。',
  contract: '合同资料及时归档，避免履约阶段无据可查。',
};
const HOUSE_ISSUE_RULE_HINTS: Record<HousePublishRuleKey, Record<HousePublishRuleMode, string>> = {
  landlord: {
    required: '先补出租方主体，当前会直接阻断发布和后续签约。',
    warn: '当前不阻断发布，但建议尽快补齐出租方主体，避免后续签约和归属失真。',
    off: '当前不校验房东主体，建议尽快补齐，避免后续签约和归属失真。',
  },
  rent: {
    required: '补齐租金和押金口径，当前会直接阻断发布。',
    warn: '当前不阻断发布，但缺租金会影响报价和签约，建议优先补齐。',
    off: '当前不校验租金，建议尽快补齐，避免后续报价和签约失真。',
  },
  cover: {
    required: '封面图当前被设为阻断项，补齐后再发布。',
    warn: '封面图当前只提醒，不阻断发布；建议持续补齐，保证首屏展示。',
    off: '封面图当前不校验发布，可按展示优先级持续补齐。',
  },
  images: {
    required: '基础图片当前被设为阻断项，补齐后再发布。',
    warn: '基础图片当前只提醒，不阻断发布；建议持续补齐，减少带看前沟通成本。',
    off: '基础图片当前不校验发布，可按展示优先级持续补齐。',
  },
  floor_plan: {
    required: '户型图当前被设为阻断项，补齐后再发布。',
    warn: '户型图当前只提醒，不阻断发布；建议持续补齐，减少带看前沟通成本。',
    off: '户型图当前不校验发布，可按展示优先级持续补齐。',
  },
  video: {
    required: '视频当前被设为阻断项，补齐后再发布。',
    warn: '视频当前只提醒，不阻断发布；建议持续补齐，增强线上展示转化。',
    off: '视频当前不校验发布，可按展示优先级持续补齐。',
  },
};
const HOUSE_ISSUE_RULE_MODE_TAG: Record<Exclude<HousePublishRuleMode, 'required'>, { color?: string; text: string }> = {
  warn: { color: 'gold', text: '仅提醒' },
  off: { text: '不校验' },
};
const PRIORITY_TASK_ORDER: Record<string, number> = {
  'contact-missing': 0,
  converted: 1,
  contract: 2,
  landlord: 3,
  rent: 4,
  cover: 5,
  images: 6,
  floor_plan: 7,
  video: 8,
};
const HOUSE_ISSUE_TO_TASK: Record<string, 'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video'> = {
  缺房东: 'landlord',
  缺租金: 'rent',
  缺封面: 'cover',
  图片不足: 'images',
  缺户型图: 'floor_plan',
  视频不足: 'video',
};
const HOUSE_TASK_PRIORITY: Record<'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video', number> = {
  landlord: 0,
  rent: 1,
  cover: 2,
  images: 3,
  floor_plan: 4,
  video: 5,
};

type PriorityTask = {
  key: string;
  title: string;
  count: number;
  path: string;
  hint: string;
  ruleMode: HousePublishRuleMode | 'workflow';
};

type PublishFilterValue = 'all' | 'blocked' | 'ready';
type WorkflowFilterValue = 'all' | 'contact-missing' | 'converted' | 'contract';
const WORKBENCH_PUBLISH_FILTER_LABELS: Record<Exclude<PublishFilterValue, 'all'>, string> = {
  blocked: '阻断发布',
  ready: '待发布',
};
const WORKBENCH_WORKFLOW_FILTER_LABELS: Record<Exclude<WorkflowFilterValue, 'all'>, string> = {
  'contact-missing': '待补租客',
  converted: '待签约',
  contract: '待补合同',
};

function getWorkbenchFiltersFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const publishFilter = params.get('publish');
  const workflowFilter = params.get('workflow');

  return {
    publishFilter: publishFilter === 'blocked' || publishFilter === 'ready' ? publishFilter : 'all',
    workflowFilter:
      workflowFilter === 'contact-missing' || workflowFilter === 'converted' || workflowFilter === 'contract'
        ? workflowFilter
        : 'all',
  } satisfies { publishFilter: PublishFilterValue; workflowFilter: WorkflowFilterValue };
}

function syncWorkbenchFiltersSearch(filters: { publishFilter: PublishFilterValue; workflowFilter: WorkflowFilterValue }) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (filters.publishFilter === 'all') params.delete('publish');
  else params.set('publish', filters.publishFilter);

  if (filters.workflowFilter === 'all') params.delete('workflow');
  else params.set('workflow', filters.workflowFilter);

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (currentUrl !== nextUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function getWorkbenchSuggestion(counts: { blocked: number; ready: number; missingContact: number; readyLease: number; contractMissing: number; total: number }) {
  if (counts.missingContact > 0) return '优先处理已成交但缺租客主体的记录，先补齐联系人，再继续签约。';
  if (counts.readyLease > 0) return '已经成交且主体完整的客户应尽快转租约，避免业务停在带看阶段。';
  if (counts.contractMissing > 0) return '合同缺失的租约要优先补归档，保证履约、续签和结算资料完整。';
  if (counts.blocked > 0) return '先清当前真正阻断发布的房源；媒体类提醒项可以按优先级持续补齐，不必一刀切卡住上线。';
  if (counts.ready > 0) return '已有可发布房源，建议尽快上架，缩短库存停留在草稿阶段的时间。';
  if (counts.total > 0) return '当前主链路较顺，继续维护房源供给和签约资料完整度。';
  return '当前还没有房源库存，先完成基础项目、楼栋和房源建档。';
}

type WorkflowTaskRow =
  | { key: string; queueKey: 'contact-missing' | 'converted'; type: 'viewing'; queue: string; title: string; house: string; status: string; nextStep: string; actionLabel: string; actionPath: string }
  | { key: string; queueKey: 'contract'; type: 'lease'; queue: string; title: string; house: string; status: string; nextStep: string; actionLabel: string; actionPath: string };

type PublishWorkbenchRow = {
  key: string;
  stage: 'blocked' | 'ready';
  house: HouseOut;
  issues: string[];
  actionLabel: string;
  actionPath: string;
  actionHint: string;
};

type WorkbenchSignal = {
  key: string;
  title: string;
  status: string;
  detail: string;
  helper: string;
  tone: 'green' | 'blue' | 'orange';
  actionLabel: string;
  actionPath: string;
};

export function getHouseTaskLink(record: HouseOut) {
  const issues = getTrackedHousePublishIssues(record);
  const needsMetadata = issues.includes('缺房东') || issues.includes('缺租金');
  const needsMedia = issues.includes('缺封面') || issues.includes('图片不足') || issues.includes('缺户型图') || issues.includes('视频不足');
  const basePath = `/property-rental/houses/${record.id}`;
  const primaryTask = issues
    .map((issue) => HOUSE_ISSUE_TO_TASK[issue])
    .filter(Boolean)
    .sort((left, right) => HOUSE_TASK_PRIORITY[left] - HOUSE_TASK_PRIORITY[right])[0];
  const action = primaryTask === 'cover' || primaryTask === 'images' || primaryTask === 'floor_plan' || primaryTask === 'video' ? 'media' : primaryTask ? 'edit' : undefined;
  const nextSearch = action
    ? `?action=${action}${primaryTask ? `&task=${primaryTask}` : ''}`
    : '';
  if (needsMetadata && needsMedia) return { label: '处理发布问题', path: `${basePath}${nextSearch}` };
  if (needsMetadata) return { label: '补资料', path: `${basePath}${nextSearch}` };
  if (needsMedia) return { label: '维护相册', path: `${basePath}${nextSearch}` };
  if (!issues.length && canHousePublish(record) && record.publish_status !== 'published') return { label: '检查后发布', path: basePath };
  return { label: '详情', path: basePath };
}

function openDashboardPath(path: string, event?: React.MouseEvent<HTMLElement>) {
  event?.preventDefault();
  history.push(path);
}

function buildWorkbenchSignals(counts: {
  total: number;
  blocked: number;
  ready: number;
  missingContact: number;
  readyLease: number;
  contractMissing: number;
}): WorkbenchSignal[] {
  const publishTone: WorkbenchSignal['tone'] = counts.blocked > 0 ? 'orange' : counts.ready > 0 ? 'blue' : 'green';
  const publishStatus = counts.blocked > 0 ? '先清阻断' : counts.ready > 0 ? '可安排上架' : counts.total > 0 ? '库存稳定' : '待建首批房源';
  const publishDetail = counts.total > 0 ? `${counts.blocked} 套阻断 / ${counts.ready} 套待发布` : '当前还没有库存';
  const publishHelper =
    counts.blocked > 0
      ? '当前仍有阻断发布项没有补齐，先把会真正卡上线的房源清到可发布，再回头补提醒项。'
      : counts.ready > 0
        ? '已经具备上线条件的房源不要继续停在草稿，尽快安排发布承接带看。'
        : '当前发布链路没有积压，可以把精力转向带看转签和合同归档。';

  const workflowTone: WorkbenchSignal['tone'] = counts.missingContact > 0 ? 'orange' : counts.readyLease > 0 ? 'blue' : 'green';
  const workflowStatus = counts.missingContact > 0 ? '先补业务主体' : counts.readyLease > 0 ? '待快速签约' : '转签平稳';
  const workflowDetail = `${counts.missingContact} 条待补租客 / ${counts.readyLease} 条待签约`;
  const workflowHelper =
    counts.missingContact > 0
      ? '已成交但缺租客主体的记录会直接卡住签约，先补联系人再转租约。'
      : counts.readyLease > 0
        ? '主体已经完整的成交客户要尽快建租约，避免业务停在带看阶段。'
        : '当前待签约链路没有明显堵点，可以继续关注新增成交。';

  const contractTone: WorkbenchSignal['tone'] = counts.contractMissing > 0 ? 'orange' : 'green';
  const contractStatus = counts.contractMissing > 0 ? '合同待归档' : '归档稳定';
  const contractDetail = counts.contractMissing > 0 ? `${counts.contractMissing} 份待补合同` : '暂无合同积压';
  const contractHelper =
    counts.contractMissing > 0
      ? '租约已经生成但合同缺失，后续履约、结算和续签都会受影响。'
      : '当前合同资料没有明显缺口，可以继续保持租约归档节奏。';

  return [
    {
      key: 'publish',
      title: '发布准备',
      status: publishStatus,
      detail: publishDetail,
      helper: publishHelper,
      tone: publishTone,
      actionLabel: counts.blocked > 0 ? '查看阻断房源' : counts.ready > 0 ? '查看待发布' : '查看房源台账',
      actionPath: counts.blocked > 0 ? '/property-rental/houses?task=blocked' : counts.ready > 0 ? '/property-rental/houses?task=ready' : '/property-rental/houses',
    },
    {
      key: 'workflow',
      title: '转签衔接',
      status: workflowStatus,
      detail: workflowDetail,
      helper: workflowHelper,
      tone: workflowTone,
      actionLabel: counts.missingContact > 0 ? '查看待补租客' : counts.readyLease > 0 ? '查看待签约' : '查看带看台账',
      actionPath:
        counts.missingContact > 0
          ? '/property-rental/viewings?pending_lease=true&contact_missing=true'
          : counts.readyLease > 0
            ? '/property-rental/viewings?pending_lease=true&contact_missing=false'
            : '/property-rental/viewings',
    },
    {
      key: 'contract',
      title: '合同归档',
      status: contractStatus,
      detail: contractDetail,
      helper: contractHelper,
      tone: contractTone,
      actionLabel: counts.contractMissing > 0 ? '查看待补合同' : '查看租约台账',
      actionPath: counts.contractMissing > 0 ? '/property-rental/leases?task=contract' : '/property-rental/leases',
    },
  ];
}

function getPriorityTaskHint(taskKey: string, ruleMode: HousePublishRuleMode | 'workflow') {
  if (ruleMode === 'workflow') return PRIORITY_TASK_HINTS[taskKey] || '进入对应队列继续处理。';
  return HOUSE_ISSUE_RULE_HINTS[taskKey as HousePublishRuleKey][ruleMode];
}

const WorkbenchPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialFilters = typeof window === 'undefined' ? { publishFilter: 'all' as const, workflowFilter: 'all' as const } : getWorkbenchFiltersFromSearch(window.location.search);
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>(initialFilters.publishFilter);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilterValue>(initialFilters.workflowFilter);
  const [publishConfirmHouseId, setPublishConfirmHouseId] = useState<number | null>(null);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseOverviewQueries = useQueries({
    queries: [
      {
        queryKey: ['house', 'workbench', 'house-overview', workspace.selectedOrgSlug, 'total'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1 }),
        enabled,
      },
      {
        queryKey: ['house', 'workbench', 'house-overview', workspace.selectedOrgSlug, 'blocked'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_blocked: true }),
        enabled,
      },
      {
        queryKey: ['house', 'workbench', 'house-overview', workspace.selectedOrgSlug, 'ready'],
        queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_ready: true }),
        enabled,
      },
    ],
  });
  const houseIssueCounts = useQueries({
    queries: HOUSE_ISSUE_TASKS.map((task) => ({
      queryKey: ['house', 'workbench', 'house-issue-count', workspace.selectedOrgSlug, task.key],
      queryFn: () => houseApi.listHouses({ page: 1, page_size: 1, publish_issue: task.key }),
      enabled,
    })),
  });
  const blockedHouses = useQuery({
    queryKey: ['house', 'workbench', 'blocked-houses', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 5, publish_blocked: true }),
    enabled,
  });
  const readyHouses = useQuery({
    queryKey: ['house', 'workbench', 'ready-houses', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 5, publish_ready: true }),
    enabled,
  });
  const settingsQuery = useQuery({
    queryKey: ['house', 'workbench', 'settings', workspace.selectedOrgSlug],
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled,
  });
  const pendingLeaseMissingContacts = useQuery({
    queryKey: ['house', 'workbench', 'pending-lease-missing-contacts', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 5, pending_lease: true, contact_missing: true }),
    enabled,
  });
  const pendingLeaseReady = useQuery({
    queryKey: ['house', 'workbench', 'pending-lease-ready', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listViewingRecords({ page: 1, page_size: 5, pending_lease: true, contact_missing: false }),
    enabled,
  });
  const contractMissingLeases = useQuery({
    queryKey: ['house', 'workbench', 'contract-missing-leases', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listLeases({ page: 1, page_size: 5, contract_missing: true }),
    enabled,
  });
  const patchHouse = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Record<string, unknown> }) => houseApi.patchHouse(id, values),
    onSuccess: async () => {
      message.success('房源已发布');
      await queryClient.invalidateQueries({ queryKey: ['house', 'workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });

  const totalHouseCount = houseOverviewQueries[0]?.data?.total || 0;
  const blockedCount = houseOverviewQueries[1]?.data?.total || 0;
  const readyCount = houseOverviewQueries[2]?.data?.total || 0;
  const missingContactCount = pendingLeaseMissingContacts.data?.total || 0;
  const readyLeaseCount = pendingLeaseReady.data?.total || 0;
  const contractMissingCount = contractMissingLeases.data?.total || 0;
  const pageSuggestion = getWorkbenchSuggestion({
    blocked: blockedCount,
    ready: readyCount,
    missingContact: missingContactCount,
    readyLease: readyLeaseCount,
    contractMissing: contractMissingCount,
    total: totalHouseCount,
  });
  const workbenchSignals = buildWorkbenchSignals({
    total: totalHouseCount,
    blocked: blockedCount,
    ready: readyCount,
    missingContact: missingContactCount,
    readyLease: readyLeaseCount,
    contractMissing: contractMissingCount,
  });
  const overviewItems = [
    { key: 'total', title: '在管房源', value: totalHouseCount, suffix: `${totalHouseCount} 套房源在当前组织内管理` },
    { key: 'blocked', title: '阻断发布', value: blockedCount, suffix: `${blockedCount} 套被当前阻断规则卡住` },
    { key: 'ready', title: '可发布', value: readyCount, suffix: `${readyCount} 套已具备上架条件` },
    { key: 'contact-missing', title: '待补租客', value: missingContactCount, suffix: `${missingContactCount} 条成交待补业务主体` },
    { key: 'lease', title: '待签约', value: readyLeaseCount, suffix: `${readyLeaseCount} 条成交可直接转租约` },
    { key: 'contract', title: '待补合同', value: contractMissingCount, suffix: `${contractMissingCount} 份合同待归档` },
  ];
  const visibleOverviewItems = [
    overviewItems[0],
    ...overviewItems.slice(1).filter((item) => item.value > 0),
  ];
  const hiddenOverviewCount = overviewItems.length - visibleOverviewItems.length;
  const publishRulesSetting = settingsQuery.data?.find((setting) => setting.key === publishRulesSettingKey);
  const publishRules = normalizeHousePublishRules(publishRulesSetting?.value);
  const publishRuleSummary = summarizeHousePublishRules(publishRules);
  const publishRulePreset = resolveHousePublishRulesPreset(publishRules);
  const publishRulePresetText =
    publishRulePreset === 'custom' ? '自定义策略' : HOUSE_PUBLISH_RULE_PRESETS[publishRulePreset].title;
  const publishRuleSummaryText = `阻断 ${publishRuleSummary.blocking.join('、') || '无'} / 提醒 ${publishRuleSummary.warning.join('、') || '无'} / 不校验 ${publishRuleSummary.ignored.join('、') || '无'}`;
  const priorityTasks: PriorityTask[] = [
    ...HOUSE_ISSUE_TASKS.map((task, index) => ({
      ...task,
      count: houseIssueCounts[index]?.data?.total || 0,
      path: `/property-rental/houses?task=${task.key}`,
      hint: getPriorityTaskHint(task.key, publishRules[task.key].mode),
      ruleMode: publishRules[task.key].mode,
    })),
    {
      key: 'contact-missing',
      title: '待补租客',
      count: pendingLeaseMissingContacts.data?.total || 0,
      path: '/property-rental/viewings?pending_lease=true&contact_missing=true',
      hint: getPriorityTaskHint('contact-missing', 'workflow'),
      ruleMode: 'workflow',
    },
    {
      key: 'converted',
      title: '待签约',
      count: pendingLeaseReady.data?.total || 0,
      path: '/property-rental/viewings?pending_lease=true&contact_missing=false',
      hint: getPriorityTaskHint('converted', 'workflow'),
      ruleMode: 'workflow',
    },
    {
      key: 'contract',
      title: '合同缺失',
      count: contractMissingLeases.data?.total || 0,
      path: '/property-rental/leases?task=contract',
      hint: getPriorityTaskHint('contract', 'workflow'),
      ruleMode: 'workflow',
    },
  ];
  const publishWorkbenchRows: PublishWorkbenchRow[] = [
    ...(blockedHouses.data?.items || []).map((item: HouseOut) => {
      const action = getHouseTaskLink(item);
      return {
        key: `blocked-${item.id}`,
        stage: 'blocked' as const,
        house: item,
        issues: getTrackedHousePublishIssues(item),
        actionLabel: action.label,
        actionPath: action.path,
        actionHint: getHouseIssueActionHint(item),
      };
    }),
    ...(readyHouses.data?.items || []).map((item: HouseOut) => {
      const action = getHouseTaskLink(item);
      const warnings = getHouseWarningIssues(item);
      return {
        key: `ready-${item.id}`,
        stage: 'ready' as const,
        house: item,
        issues: warnings,
        actionLabel: action.label,
        actionPath: action.path,
        actionHint: warnings.length ? `允许先发布，当前仍有 ${warnings[0]}${warnings.length > 1 ? ` 等 ${warnings.length} 项提醒` : ' 提醒'}` : '资料已完整，可直接发布承接带看。',
      };
    }),
  ];
  const workflowTasks: WorkflowTaskRow[] = [
    ...(pendingLeaseMissingContacts.data?.items || []).map((item: ViewingRecordOut) => ({
      key: `viewing-${item.id}`,
      queueKey: 'contact-missing' as const,
      type: 'viewing' as const,
      queue: '成交待补主体',
      title: `${item.customer_name} 待补租客`,
      house: houseLabel(item),
      status: '待补租客',
      nextStep: '先绑定租客联系人，再创建租约',
      actionLabel: '补租客',
      actionPath: `/property-rental/viewings?pending_lease=true&contact_missing=true&edit=${item.id}`,
    })),
    ...(pendingLeaseReady.data?.items || []).map((item: ViewingRecordOut) => ({
      key: `viewing-${item.id}`,
      queueKey: 'converted' as const,
      type: 'viewing' as const,
      queue: '成交待签约',
      title: `${item.customer_name} 待签约`,
      house: houseLabel(item),
      status: '已成交待签约',
      nextStep: '立即创建租约并同步合同资料',
      actionLabel: '去签约',
      actionPath: `/property-rental/leases?source_viewing_record_id=${item.id}`,
    })),
    ...(contractMissingLeases.data?.items || []).map((item: LeaseOut) => ({
      key: `lease-${item.id}`,
      queueKey: 'contract' as const,
      type: 'lease' as const,
      queue: '合同待归档',
      title: `${item.tenant_name || '租客'} 待补合同`,
      house: houseLabel(item),
      status: '合同缺失',
      nextStep: '补齐合同文件，避免履约资料断档',
      actionLabel: '补合同',
      actionPath: `/property-rental/leases?house_id=${item.house_id}&task=contract&edit=${item.id}`,
    })),
  ];
  const orderedPriorityTasks = useMemo(
    () =>
      [...priorityTasks].sort((left, right) => {
        const orderGap = (PRIORITY_TASK_ORDER[left.key] ?? Number.MAX_SAFE_INTEGER) - (PRIORITY_TASK_ORDER[right.key] ?? Number.MAX_SAFE_INTEGER);
        if (orderGap !== 0) return orderGap;
        if (left.count !== right.count) return right.count - left.count;
        return left.title.localeCompare(right.title, 'zh-CN');
      }),
    [priorityTasks],
  );
  const activePriorityTasks = useMemo(
    () => orderedPriorityTasks.filter((task) => task.count > 0 && (task.ruleMode === 'workflow' || task.ruleMode === HOUSE_PUBLISH_RULE_MODE.REQUIRED)),
    [orderedPriorityTasks],
  );
  const monitoringPriorityTasks = useMemo(
    () =>
      orderedPriorityTasks
        .filter((task) => task.ruleMode !== 'workflow' && task.ruleMode !== HOUSE_PUBLISH_RULE_MODE.REQUIRED)
        .sort((left, right) => {
          if (left.count !== right.count) return right.count - left.count;
          return (PRIORITY_TASK_ORDER[left.key] ?? Number.MAX_SAFE_INTEGER) - (PRIORITY_TASK_ORDER[right.key] ?? Number.MAX_SAFE_INTEGER);
        }),
    [orderedPriorityTasks],
  );
  const monitoringPreviewTasks = useMemo(() => monitoringPriorityTasks.slice(0, 3), [monitoringPriorityTasks]);
  const hiddenMonitoringCount = Math.max(monitoringPriorityTasks.length - monitoringPreviewTasks.length, 0);
  const primaryPriorityTask = activePriorityTasks[0];
  const filteredPublishWorkbenchRows = useMemo(() => {
    if (publishFilter === 'blocked') return publishWorkbenchRows.filter((item) => item.stage === 'blocked');
    if (publishFilter === 'ready') return publishWorkbenchRows.filter((item) => item.stage === 'ready');
    return publishWorkbenchRows;
  }, [publishFilter, publishWorkbenchRows]);
  const filteredWorkflowTasks = useMemo(() => {
    if (workflowFilter === 'all') return workflowTasks;
    return workflowTasks.filter((item) => item.queueKey === workflowFilter);
  }, [workflowFilter, workflowTasks]);
  const activeFilterSummary = useMemo(() => {
    const labels: string[] = [];
    if (publishFilter !== 'all') labels.push(`发布工作区：${WORKBENCH_PUBLISH_FILTER_LABELS[publishFilter]}`);
    if (workflowFilter !== 'all') labels.push(`转签与合同：${WORKBENCH_WORKFLOW_FILTER_LABELS[workflowFilter]}`);
    return labels;
  }, [publishFilter, workflowFilter]);
  const sectionStyle = {
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 8,
    background: 'var(--ant-color-bg-container)',
    padding: 16,
  } as const;
  const overviewTileStyle = {
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 8,
    background: 'var(--ant-color-fill-quaternary)',
    height: '100%',
    padding: 16,
  } as const;

  useEffect(() => {
    syncWorkbenchFiltersSearch({ publishFilter, workflowFilter });
  }, [publishFilter, workflowFilter]);

  return (
    <TenantSelectionGuard title="房源工作台" subtitle="优先处理会阻断发布、带看和签约的事项。">
      <div style={sectionStyle}>
        <Typography.Text strong>经营总览</Typography.Text>
        <Row gutter={[16, 16]}>
          {visibleOverviewItems.map((item) => (
            <Col key={item.key} xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title={item.title} value={item.value} />
                <Typography.Text type="secondary">{item.suffix}</Typography.Text>
              </div>
            </Col>
          ))}
        </Row>
        {hiddenOverviewCount > 0 ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            已收起 {hiddenOverviewCount} 个 0 项，避免把空指标和关键待办放在同一层级。
          </Typography.Text>
        ) : null}
      </div>

      <div style={sectionStyle}>
        <Typography.Text strong>当前建议</Typography.Text>
        <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
          <Typography.Text>{pageSuggestion}</Typography.Text>
          {primaryPriorityTask ? (
            <Space wrap size={[8, 8]}>
              <Tag color="red">最高优先级</Tag>
              <a
                href={dashboardHref(primaryPriorityTask.path)}
                onClick={(event) => openDashboardPath(primaryPriorityTask.path, event)}
              >
                {`优先处理${primaryPriorityTask.title}`}
              </a>
              <Typography.Text type="secondary">{`${primaryPriorityTask.count} 条待办`}</Typography.Text>
            </Space>
          ) : null}
        </Space>
      </div>

      <Alert
        showIcon
        type="info"
        style={{ marginTop: 16 }}
        message={`当前发布策略：${publishRulePresetText}`}
        description={(
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text>{publishRuleSummaryText}</Typography.Text>
            <Typography.Text type="secondary">缺提醒项的房源可以先发布再持续补齐；只有当前被定义成阻断发布的字段，才会真正卡住上线。</Typography.Text>
            <a
              href="/dashboard/settings-management/organization#setting-property_rental-publish_rules"
              onClick={(event) => openDashboardPath('/settings-management/organization#setting-property_rental-publish_rules', event)}
            >
              去空间设置调整发布规则
            </a>
          </Space>
        )}
      />

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>闭环信号</Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          {workbenchSignals.map((signal) => (
            <Col key={signal.key} xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>{signal.title}</Typography.Text>
                    <Tag color={signal.tone}>{signal.status}</Tag>
                  </Space>
                  <Typography.Text>{signal.detail}</Typography.Text>
                  <Typography.Text type="secondary">{signal.helper}</Typography.Text>
                  <a
                    href={dashboardHref(signal.actionPath)}
                    onClick={(event) => openDashboardPath(signal.actionPath, event)}
                  >
                    {signal.actionLabel}
                  </a>
                </Space>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {activeFilterSummary.length ? (
        <Alert
          showIcon
          type="info"
          style={{ marginTop: 16 }}
          title={(
            <Space wrap size={[8, 8]}>
              <Typography.Text>{`当前只看：${activeFilterSummary.join(' / ')}`}</Typography.Text>
              <a
                href={dashboardHref('/property-rental/workbench')}
                onClick={(event) => {
                  event.preventDefault();
                  setPublishFilter('all');
                  setWorkflowFilter('all');
                }}
              >
                查看全部
              </a>
            </Space>
          )}
        />
      ) : null}

      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <Typography.Text strong>优先处理</Typography.Text>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Typography.Text strong>正在阻塞</Typography.Text>
            <Space orientation="vertical" size={0} style={{ width: '100%', marginTop: 12 }}>
              {activePriorityTasks.length ? activePriorityTasks.map((task, index) => (
                <div
                  key={task.key}
                  style={{
                    padding: '12px 0',
                    borderBottom: index === activePriorityTasks.length - 1 ? 'none' : '1px solid rgba(5, 5, 5, 0.06)',
                  }}
                >
                  <Row gutter={[12, 8]} align="middle" justify="space-between">
                    <Col flex="auto">
                      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                        <Space wrap size={[8, 8]}>
                          <Typography.Text strong>{task.title}</Typography.Text>
                          <Tag color="red">{task.count}</Tag>
                        </Space>
                        <Typography.Text type="secondary">{task.hint}</Typography.Text>
                      </Space>
                    </Col>
                    <Col>
                      <a
                        href={dashboardHref(task.path)}
                        aria-label={`进入${task.title}`}
                        onClick={(event) => openDashboardPath(task.path, event)}
                      >
                        进入队列
                      </a>
                    </Col>
                  </Row>
                </div>
              )) : (
                <Typography.Text type="secondary" style={{ marginTop: 12 }}>
                  当前没有需要立即处理的阻塞事项
                </Typography.Text>
              )}
            </Space>
          </Col>
          <Col xs={24} xl={10}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space align="center" size={8} wrap>
                <Typography.Text strong>持续监控</Typography.Text>
                <Tag>{`${monitoringPriorityTasks.length} 项`}</Tag>
              </Space>
              <Typography.Text type="secondary">这些缺口会继续统计，但除非空间规则把它们设成“阻断发布”，否则不会直接卡住房源上线。</Typography.Text>
              {monitoringPreviewTasks.length ? (
                <Space orientation="vertical" size={0} style={{ width: '100%' }}>
                  {monitoringPreviewTasks.map((task, index) => (
                    (() => {
                      const modeTag = task.ruleMode === HOUSE_PUBLISH_RULE_MODE.WARNING
                        ? HOUSE_ISSUE_RULE_MODE_TAG.warn
                        : task.ruleMode === HOUSE_PUBLISH_RULE_MODE.OFF
                          ? HOUSE_ISSUE_RULE_MODE_TAG.off
                          : null;

                      return (
                    <div
                      key={task.key}
                      style={{
                        padding: '12px 0',
                        borderBottom: index === monitoringPreviewTasks.length - 1 ? 'none' : '1px solid rgba(5, 5, 5, 0.06)',
                      }}
                    >
                      <Row gutter={[12, 8]} align="middle" justify="space-between">
                        <Col flex="auto">
                          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                            <Space wrap size={[8, 8]}>
                              <Typography.Text strong>{task.title}</Typography.Text>
                              <Tag>{task.count}</Tag>
                              {modeTag ? <Tag color={modeTag.color}>{modeTag.text}</Tag> : null}
                            </Space>
                            <Typography.Text type="secondary">{task.hint}</Typography.Text>
                          </Space>
                        </Col>
                        <Col>
                          <a
                            href={dashboardHref(task.path)}
                            aria-label={`进入${task.title}`}
                            onClick={(event) => openDashboardPath(task.path, event)}
                          >
                            进入队列
                          </a>
                        </Col>
                      </Row>
                    </div>
                      );
                    })()
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">当前没有可继续跟踪的监控项</Typography.Text>
              )}
              {hiddenMonitoringCount > 0 ? (
                <Alert
                  type="info"
                  showIcon
                  title={`还有 ${hiddenMonitoringCount} 个低优先级监控项已收起`}
                  description={monitoringPriorityTasks
                    .slice(3)
                    .map((task) => `${task.title} · ${task.hint}`)
                    .join('；')}
                />
              ) : null}
            </Space>
          </Col>
        </Row>
      </div>

      <Card
        title="发布工作区"
        style={{ marginTop: 16 }}
        extra={(
          <Space wrap size={[8, 8]}>
            <Typography.Text type="secondary">{`显示 ${filteredPublishWorkbenchRows.length} / ${publishWorkbenchRows.length}`}</Typography.Text>
            <Segmented
              options={[
                { label: `全部 ${publishWorkbenchRows.length}`, value: 'all' },
                { label: `阻断发布 ${blockedCount}`, value: 'blocked' },
                { label: `待发布 ${readyCount}`, value: 'ready' },
              ]}
              value={publishFilter}
              onChange={(value) => setPublishFilter(value as PublishFilterValue)}
            />
          </Space>
        )}
      >
        <Table<PublishWorkbenchRow>
          rowKey="key"
          loading={blockedHouses.isLoading || readyHouses.isLoading}
          columns={[
            { title: '房源', dataIndex: 'house', render: (_value, record) => houseLabel(record.house) },
            {
              title: '当前阶段',
              dataIndex: 'stage',
              render: (_value, record) => (
                <Space size={4} wrap>
                  <Tag color={record.stage === 'blocked' ? 'orange' : 'blue'}>{record.stage === 'blocked' ? '阻断发布' : '待发布'}</Tag>
                  {record.stage === 'ready' && record.issues.length ? <Tag color="cyan">仅提醒</Tag> : null}
                  <Tag color={STATUS_COLOR[record.house.status] || 'default'}>{STATUS_TEXT[record.house.status] || record.house.status}</Tag>
                  <Tag color={HOUSE_PUBLISH_STATUS_COLOR[record.house.publish_status] || 'default'}>{HOUSE_PUBLISH_STATUS_TEXT[record.house.publish_status] || record.house.publish_status}</Tag>
                </Space>
              ),
            },
            {
              title: '关键问题',
              dataIndex: 'issues',
              render: (_value, record) => {
                const blockingIssues = getHouseBlockingIssues(record.house);
                const warningIssues = record.stage === 'ready' ? record.issues : getHouseWarningIssues(record.house);
                if (blockingIssues.length || warningIssues.length) {
                  return (
                    <Space size={[4, 4]} wrap>
                      {blockingIssues.map((item) => <Tag color="orange" key={`blocking-${item}`}>{item}</Tag>)}
                      {warningIssues.map((item) => <Tag color="blue" key={`warning-${item}`}>{item}</Tag>)}
                    </Space>
                  );
                }
                return <Typography.Text type="success">资料完整，可直接上架</Typography.Text>;
              },
            },
            {
              title: '建议动作',
              dataIndex: 'action_hint',
              render: (_value, record) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text>{record.actionHint}</Typography.Text>
                  <Typography.Text type="secondary">
                    {record.stage === 'blocked'
                      ? `${record.house.landlord_id ? contactLabel({ id: record.house.landlord_id || undefined, landlord_name: record.house.landlord_name, landlord_phone: record.house.landlord_phone }) : '待补房东'} / ${moneyText(record.house.asking_rent)} / ${houseMediaReadinessText(record.house)}`
                      : `${contactLabel({ id: record.house.landlord_id || undefined, landlord_name: record.house.landlord_name, landlord_phone: record.house.landlord_phone })} / ${moneyText(record.house.asking_rent)} / ${houseMediaReadinessText(record.house)}`}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '操作',
              dataIndex: 'actions',
              render: (_value, record) => {
                const actionHref = dashboardHref(record.actionPath);
                return (
                  <Space size={8} wrap>
                    <a
                      href={actionHref}
                      onClick={(event) => openDashboardPath(record.actionPath, event)}
                    >
                      {record.actionLabel}
                    </a>
                    {record.stage === 'ready' ? (
                      <Button
                        type="link"
                        size="small"
                        loading={patchHouse.isPending}
                        onClick={() => setPublishConfirmHouseId(record.house.id)}
                      >
                        发布
                      </Button>
                    ) : null}
                  </Space>
                );
              },
            },
          ]}
          dataSource={filteredPublishWorkbenchRows}
          pagination={false}
          locale={{ emptyText: publishFilter === 'all' ? '暂无发布相关房源' : '当前筛选下暂无房源' }}
          scroll={adminTableScroll}
        />
      </Card>

      <Modal
        open={publishConfirmHouseId !== null}
        title="确认发布房源"
        okText="确认发布"
        cancelText="先取消"
        transitionName=""
        maskTransitionName=""
        onCancel={() => setPublishConfirmHouseId(null)}
        onOk={async () => {
          const nextId = publishConfirmHouseId;
          if (nextId === null) return;
          setPublishConfirmHouseId(null);
          await patchHouse.mutateAsync({ id: nextId, values: { publish_status: 'published' } });
        }}
      >
        <Typography.Text>这套房源已经具备发布条件，确认后会直接切换为已发布状态。</Typography.Text>
      </Modal>

      <Card
        title="成交转签与合同"
        style={{ marginTop: 16 }}
        extra={(
          <Space wrap size={[8, 8]}>
            <Typography.Text type="secondary">{`显示 ${filteredWorkflowTasks.length} / ${workflowTasks.length}`}</Typography.Text>
            <Segmented
              options={[
                { label: `全部 ${workflowTasks.length}`, value: 'all' },
                { label: `待补租客 ${missingContactCount}`, value: 'contact-missing' },
                { label: `待签约 ${readyLeaseCount}`, value: 'converted' },
                { label: `待补合同 ${contractMissingCount}`, value: 'contract' },
              ]}
              value={workflowFilter}
              onChange={(value) => setWorkflowFilter(value as WorkflowFilterValue)}
            />
          </Space>
        )}
      >
        <Table<WorkflowTaskRow>
          rowKey="key"
          columns={[
            { title: '任务队列', dataIndex: 'queue' },
            { title: '任务', dataIndex: 'title' },
            { title: '房源', dataIndex: 'house' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value) => <Tag color={value === '合同缺失' ? 'orange' : value === '待补租客' ? 'gold' : 'purple'}>{value}</Tag>,
            },
            { title: '下一步', dataIndex: 'nextStep', render: (value) => <Typography.Text type="secondary">{value}</Typography.Text> },
            {
              title: '操作',
              dataIndex: 'actions',
              render: (_value, record) => (
                <Space size={8} wrap>
                  <a
                    href={dashboardHref(record.actionPath)}
                    onClick={(event) => openDashboardPath(record.actionPath, event)}
                  >
                    {record.actionLabel}
                  </a>
                </Space>
              ),
            },
          ]}
          dataSource={filteredWorkflowTasks}
          pagination={false}
          locale={{ emptyText: workflowFilter === 'all' ? '暂无成交转签或合同待办' : '当前筛选下暂无待办' }}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default WorkbenchPage;
