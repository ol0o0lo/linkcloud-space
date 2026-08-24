import {
  canHousePublish,
  getHouseIssueActionHint,
  getHouseWarningIssues,
  getTrackedHousePublishIssues,
  HOUSE_STATUS,
  houseLabel,
} from '@/pages/rental/constants';
import type {
  HouseOut,
  ViewingRecordOut,
} from '@/services/manual/house';

const HOUSE_ISSUE_TO_TASK: Record<
  string,
  'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video'
> = {
  缺房东: 'landlord',
  缺租金: 'rent',
  缺封面: 'cover',
  图片不足: 'images',
  缺户型图: 'floor_plan',
  视频不足: 'video',
};

const HOUSE_TASK_PRIORITY = {
  landlord: 0,
  rent: 1,
  cover: 2,
  images: 3,
  floor_plan: 4,
  video: 5,
} as const;

export type PublishFilterValue = 'all' | 'blocked' | 'ready';
export type WorkflowFilterValue = 'all' | 'contact-missing' | 'converted';

export const WORKBENCH_PUBLISH_FILTER_LABELS: Record<
  Exclude<PublishFilterValue, 'all'>,
  string
> = {
  blocked: '阻断发布',
  ready: '待发布',
};

export const WORKBENCH_WORKFLOW_FILTER_LABELS: Record<
  Exclude<WorkflowFilterValue, 'all'>,
  string
> = {
  'contact-missing': '待补租客',
  converted: '待签约',
};

export type WorkflowTaskRow = {
  key: string;
  queueKey: 'contact-missing' | 'converted';
  queue: string;
  title: string;
  house: { id: number; label: string };
  status: string;
  nextStep: string;
  actionLabel: string;
  actionPath: string;
};

export type PublishWorkbenchRow = {
  key: string;
  stage: 'blocked' | 'ready';
  house: HouseOut;
  issues: string[];
  actionLabel: string;
  actionPath: string;
  actionHint: string;
};

export type SpaceRisk = {
  key: string;
  level: 'danger' | 'warning' | 'info';
  count: number;
  label: string;
};

export function getWorkbenchFiltersFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const publishFilter = params.get('publish');
  const workflowFilter = params.get('workflow');
  return {
    publishFilter:
      publishFilter === 'blocked' || publishFilter === 'ready'
        ? publishFilter
        : 'all',
    workflowFilter:
      workflowFilter === 'contact-missing' || workflowFilter === 'converted'
        ? workflowFilter
        : 'all',
  } satisfies {
    publishFilter: PublishFilterValue;
    workflowFilter: WorkflowFilterValue;
  };
}

export function syncWorkbenchFiltersSearch(filters: {
  publishFilter: PublishFilterValue;
  workflowFilter: WorkflowFilterValue;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (filters.publishFilter === 'all') params.delete('publish');
  else params.set('publish', filters.publishFilter);
  if (filters.workflowFilter === 'all') params.delete('workflow');
  else params.set('workflow', filters.workflowFilter);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

export function getHouseTaskLink(record: HouseOut, rules?: unknown) {
  const issues = getTrackedHousePublishIssues(record, rules);
  const needsMetadata = issues.includes('缺房东') || issues.includes('缺租金');
  const needsMedia =
    issues.includes('缺封面') ||
    issues.includes('图片不足') ||
    issues.includes('缺户型图') ||
    issues.includes('视频不足');
  const basePath = `/rental/properties/${record.id}`;
  const primaryTask = issues
    .map((issue) => HOUSE_ISSUE_TO_TASK[issue])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort(
      (left, right) => HOUSE_TASK_PRIORITY[left] - HOUSE_TASK_PRIORITY[right],
    )[0];
  const action =
    primaryTask === 'cover' ||
    primaryTask === 'images' ||
    primaryTask === 'floor_plan' ||
    primaryTask === 'video'
      ? 'media'
      : primaryTask
        ? 'edit'
        : undefined;
  const nextSearch = action
    ? `?action=${action}${primaryTask ? `&task=${primaryTask}` : ''}`
    : '';
  if (needsMetadata && needsMedia) {
    return { label: '处理发布问题', path: `${basePath}${nextSearch}` };
  }
  if (needsMetadata) {
    return { label: '补资料', path: `${basePath}${nextSearch}` };
  }
  if (needsMedia) {
    return { label: '维护相册', path: `${basePath}${nextSearch}` };
  }
  if (
    !issues.length &&
    canHousePublish(record, rules) &&
    record.status === HOUSE_STATUS.VACANT
  ) {
    return { label: '检查后发布', path: basePath };
  }
  return { label: '详情', path: basePath };
}

export function buildPublishWorkbenchRows(
  blockedHouses: HouseOut[],
  readyHouses: HouseOut[],
  rules?: unknown,
): PublishWorkbenchRow[] {
  return [
    ...blockedHouses.map((house) => {
      const action = getHouseTaskLink(house, rules);
      return {
        key: `blocked-${house.id}`,
        stage: 'blocked' as const,
        house,
        issues: getTrackedHousePublishIssues(house, rules),
        actionLabel: action.label,
        actionPath: action.path,
        actionHint: getHouseIssueActionHint(house, rules),
      };
    }),
    ...readyHouses.map((house) => {
      const action = getHouseTaskLink(house, rules);
      const warnings = getHouseWarningIssues(house, rules);
      return {
        key: `ready-${house.id}`,
        stage: 'ready' as const,
        house,
        issues: warnings,
        actionLabel: action.label,
        actionPath: action.path,
        actionHint: warnings.length
          ? `允许先发布，当前仍有 ${warnings[0]}${warnings.length > 1 ? ` 等 ${warnings.length} 项提醒` : ' 提醒'}`
          : '资料已完整，可直接发布承接带看。',
      };
    }),
  ];
}

export function buildWorkflowTasks(
  pendingLeaseMissingContacts: ViewingRecordOut[],
  pendingLeaseReady: ViewingRecordOut[],
): WorkflowTaskRow[] {
  return [
    ...pendingLeaseMissingContacts.map((item) => ({
      key: `viewing-${item.id}`,
      queueKey: 'contact-missing' as const,
      queue: '成交待补主体',
      title: `${item.customer_name} 待补租客`,
      house: { id: item.house?.id || item.house_id, label: houseLabel(item) },
      status: '待补租客',
      nextStep: '先绑定租客联系人，再创建租约',
      actionLabel: '补租客',
      actionPath: `/rental/viewings?pending_lease=true&contact_missing=true&edit=${item.id}`,
    })),
    ...pendingLeaseReady.map((item) => ({
      key: `viewing-${item.id}`,
      queueKey: 'converted' as const,
      queue: '成交待签约',
      title: `${item.customer_name} 待签约`,
      house: { id: item.house?.id || item.house_id, label: houseLabel(item) },
      status: '已成交待签约',
      nextStep: '立即创建租约并同步合同资料',
      actionLabel: '去签约',
      actionPath: `/rental/leases?source_viewing_record_id=${item.id}`,
    })),
  ];
}

export function buildSpaceRisks(input: {
  blockedCount: number;
  missingContactCount: number;
  readyLeaseCount: number;
}): SpaceRisk[] {
  return [
    {
      key: 'blocked-publish',
      level: 'danger' as const,
      count: input.blockedCount,
      label: '套房源阻断发布',
    },
    {
      key: 'missing-contact',
      level: 'warning' as const,
      count: input.missingContactCount,
      label: '条记录待补租客',
    },
    {
      key: 'ready-lease',
      level: 'info' as const,
      count: input.readyLeaseCount,
      label: '条记录待签约',
    },
  ]
    .filter((item) => item.count > 0)
    .slice(0, 3);
}
