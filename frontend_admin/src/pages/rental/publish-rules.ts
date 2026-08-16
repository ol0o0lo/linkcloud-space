export const HOUSE_PUBLISH_RULE_MODE = {
  REQUIRED: 'required',
  WARNING: 'warn',
  OFF: 'off',
} as const;

export type HousePublishRuleMode = (typeof HOUSE_PUBLISH_RULE_MODE)[keyof typeof HOUSE_PUBLISH_RULE_MODE];
export type HousePublishRuleKey = 'landlord' | 'rent' | 'cover' | 'images' | 'floor_plan' | 'video';

export type HousePublishRuleSnapshot = Record<HousePublishRuleKey, { mode: HousePublishRuleMode; label?: string; min_count?: number }>;
export type HousePublishRulePreset = 'strict' | 'standard' | 'relaxed';

export const HOUSE_PUBLISH_RULE_LABELS: Record<HousePublishRuleKey, string> = {
  landlord: '房东主体',
  rent: '租金',
  cover: '封面图',
  images: '房源图片',
  floor_plan: '户型图',
  video: '视频',
};

export const HOUSE_PUBLISH_ISSUE_LABELS: Record<HousePublishRuleKey, string> = {
  landlord: '缺房东',
  rent: '缺租金',
  cover: '缺封面',
  images: '图片不足',
  floor_plan: '缺户型图',
  video: '视频不足',
};

export const HOUSE_PUBLISH_RULE_ROWS: Array<{ key: HousePublishRuleKey; label: string; description: string; countLabel?: string }> = [
  { key: 'landlord', label: HOUSE_PUBLISH_RULE_LABELS.landlord, description: '房东主体不完整时，发布和后续签约都会失去核心归属。' },
  { key: 'rent', label: HOUSE_PUBLISH_RULE_LABELS.rent, description: '租金缺失会影响挂牌、报价和转签约，建议始终保留为核心阻断项。' },
  { key: 'cover', label: HOUSE_PUBLISH_RULE_LABELS.cover, description: '封面图决定第一屏展示，通常建议至少保留提醒。' },
  { key: 'images', label: HOUSE_PUBLISH_RULE_LABELS.images, description: '基础图片更适合做成数量校验，避免房源还没法完整呈现。', countLabel: '最少图片数' },
  { key: 'floor_plan', label: HOUSE_PUBLISH_RULE_LABELS.floor_plan, description: '户型图能显著降低沟通成本，适合按业务阶段调整。' },
  { key: 'video', label: HOUSE_PUBLISH_RULE_LABELS.video, description: '视频适合做加分项，不适合硬性阻断全部房源。', countLabel: '最少视频数' },
];

const strictPreset: HousePublishRuleSnapshot = {
  landlord: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  rent: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  cover: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  images: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED, min_count: 3 },
  floor_plan: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  video: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED, min_count: 1 },
};

const standardPreset: HousePublishRuleSnapshot = {
  landlord: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  rent: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  cover: { mode: HOUSE_PUBLISH_RULE_MODE.WARNING },
  images: { mode: HOUSE_PUBLISH_RULE_MODE.WARNING, min_count: 3 },
  floor_plan: { mode: HOUSE_PUBLISH_RULE_MODE.WARNING },
  video: { mode: HOUSE_PUBLISH_RULE_MODE.OFF, min_count: 1 },
};

const relaxedPreset: HousePublishRuleSnapshot = {
  landlord: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  rent: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED },
  cover: { mode: HOUSE_PUBLISH_RULE_MODE.OFF },
  images: { mode: HOUSE_PUBLISH_RULE_MODE.OFF, min_count: 3 },
  floor_plan: { mode: HOUSE_PUBLISH_RULE_MODE.OFF },
  video: { mode: HOUSE_PUBLISH_RULE_MODE.OFF, min_count: 1 },
};

export const DEFAULT_HOUSE_PUBLISH_RULES: HousePublishRuleSnapshot = structuredClone(standardPreset);

export const HOUSE_PUBLISH_RULE_PRESETS: Record<HousePublishRulePreset, { title: string; description: string; value: HousePublishRuleSnapshot }> = {
  strict: {
    title: '严格发布',
    description: '适合新项目或强管控阶段，媒体资料不足也会阻断发布。',
    value: strictPreset,
  },
  standard: {
    title: '标准发布',
    description: '默认推荐。房东和租金阻断，媒体问题主要做提醒。',
    value: standardPreset,
  },
  relaxed: {
    title: '宽松发布',
    description: '只保留核心业务字段阻断，媒体资料先允许上线。',
    value: relaxedPreset,
  },
};

function serializeRules(rules: HousePublishRuleSnapshot) {
  return JSON.stringify(rules);
}

function cloneRules(rules: HousePublishRuleSnapshot) {
  return structuredClone(rules) as HousePublishRuleSnapshot;
}

export function buildHousePublishRulesPreset(preset: HousePublishRulePreset) {
  return cloneRules(HOUSE_PUBLISH_RULE_PRESETS[preset].value);
}

export function resolveHousePublishRulesPreset(rules: HousePublishRuleSnapshot): HousePublishRulePreset | 'custom' {
  const current = serializeRules(rules);
  const matched = (Object.keys(HOUSE_PUBLISH_RULE_PRESETS) as HousePublishRulePreset[]).find(
    (preset) => serializeRules(HOUSE_PUBLISH_RULE_PRESETS[preset].value) === current,
  );
  return matched || 'custom';
}

export function summarizeHousePublishRules(rules: HousePublishRuleSnapshot) {
  const blocking: string[] = [];
  const warning: string[] = [];
  const ignored: string[] = [];

  (Object.keys(rules) as HousePublishRuleKey[]).forEach((key) => {
    const rule = rules[key];
    if (rule.mode === HOUSE_PUBLISH_RULE_MODE.REQUIRED) {
      blocking.push(HOUSE_PUBLISH_RULE_LABELS[key]);
      return;
    }
    if (rule.mode === HOUSE_PUBLISH_RULE_MODE.WARNING) {
      warning.push(HOUSE_PUBLISH_RULE_LABELS[key]);
      return;
    }
    ignored.push(HOUSE_PUBLISH_RULE_LABELS[key]);
  });

  return { blocking, warning, ignored };
}

export function normalizeHousePublishRules(value?: unknown): HousePublishRuleSnapshot {
  const rules = cloneRules(DEFAULT_HOUSE_PUBLISH_RULES);
  if (!value || typeof value !== 'object') return rules;

  (Object.keys(DEFAULT_HOUSE_PUBLISH_RULES) as HousePublishRuleKey[]).forEach((key) => {
    const rawRule = (value as Record<string, { mode?: string; min_count?: unknown }>)[key];
    if (!rawRule || typeof rawRule !== 'object') return;
    if (([HOUSE_PUBLISH_RULE_MODE.REQUIRED, HOUSE_PUBLISH_RULE_MODE.WARNING, HOUSE_PUBLISH_RULE_MODE.OFF] as string[]).includes(rawRule.mode || '')) {
      rules[key].mode = rawRule.mode as HousePublishRuleMode;
    }
    if (typeof rules[key].min_count === 'number') {
      const rawCount = Number(rawRule.min_count ?? rules[key].min_count);
      rules[key].min_count = Number.isFinite(rawCount) ? Math.max(rawCount, 0) : rules[key].min_count;
    }
  });

  return rules;
}

export function evaluateHousePublishState(
  house: {
    images?: Record<string, unknown>[];
    videos?: Record<string, unknown>[];
    landlord_id?: number | null;
    asking_rent?: string | number | null;
  },
  rules?: unknown,
) {
  const ruleSnapshot = normalizeHousePublishRules(rules);
  const images = house.images || [];
  const imageRoles = new Set(images.map((item) => item.image_role).filter(Boolean));
  const imageCount = images.length;
  const videoCount = house.videos?.length || 0;
  const issueFlags: Record<HousePublishRuleKey, boolean> = {
    landlord: !house.landlord_id,
    rent: !house.asking_rent,
    cover: !imageRoles.has('cover'),
    images: imageCount < (ruleSnapshot.images.min_count || 0),
    floor_plan: !imageRoles.has('floor_plan'),
    video: videoCount < (ruleSnapshot.video.min_count || 0),
  };
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];

  (Object.keys(issueFlags) as HousePublishRuleKey[]).forEach((key) => {
    if (!issueFlags[key]) return;
    const rule = ruleSnapshot[key];
    if (rule.mode === HOUSE_PUBLISH_RULE_MODE.OFF) return;
    const target = rule.mode === HOUSE_PUBLISH_RULE_MODE.REQUIRED ? blockingIssues : warningIssues;
    target.push(HOUSE_PUBLISH_ISSUE_LABELS[key]);
  });

  return {
    canPublish: blockingIssues.length === 0,
    blockingIssues,
    warningIssues,
    ruleSnapshot,
  };
}

export function getHousePublishIssues(house: { images?: Record<string, unknown>[]; videos?: Record<string, unknown>[]; landlord_id?: number | null; asking_rent?: string | number | null }) {
  const issues: string[] = [];
  const images = house.images || [];
  const imageRoles = new Set(images.map((item) => item.image_role).filter(Boolean));
  if (!house.landlord_id) issues.push(HOUSE_PUBLISH_ISSUE_LABELS.landlord);
  if (!house.asking_rent) issues.push(HOUSE_PUBLISH_ISSUE_LABELS.rent);
  if (!imageRoles.has('cover')) issues.push(HOUSE_PUBLISH_ISSUE_LABELS.cover);
  if (images.length < 3) issues.push(HOUSE_PUBLISH_ISSUE_LABELS.images);
  if (!imageRoles.has('floor_plan')) issues.push(HOUSE_PUBLISH_ISSUE_LABELS.floor_plan);
  if ((house.videos || []).length < 1) issues.push(HOUSE_PUBLISH_ISSUE_LABELS.video);
  return issues;
}

export function getHouseBlockingIssues(house: {
  images?: Record<string, unknown>[];
  videos?: Record<string, unknown>[];
  landlord_id?: number | null;
  asking_rent?: string | number | null;
}, rules?: unknown) {
  return evaluateHousePublishState(house, rules).blockingIssues;
}

export function getHouseWarningIssues(house: {
  images?: Record<string, unknown>[];
  videos?: Record<string, unknown>[];
  landlord_id?: number | null;
  asking_rent?: string | number | null;
}, rules?: unknown) {
  return evaluateHousePublishState(house, rules).warningIssues;
}

export function canHousePublish(house: {
  images?: Record<string, unknown>[];
  videos?: Record<string, unknown>[];
  landlord_id?: number | null;
  asking_rent?: string | number | null;
}, rules?: unknown) {
  return evaluateHousePublishState(house, rules).canPublish;
}

export function getTrackedHousePublishIssues(house: {
  images?: Record<string, unknown>[];
  videos?: Record<string, unknown>[];
  landlord_id?: number | null;
  asking_rent?: string | number | null;
}, rules?: unknown) {
  const blocking = getHouseBlockingIssues(house, rules);
  const warnings = getHouseWarningIssues(house, rules);
  return [...blocking, ...warnings];
}

export function houseMediaReadinessText(house: { images?: Record<string, unknown>[]; videos?: Record<string, unknown>[] }) {
  const images = house.images?.length || 0;
  const videos = house.videos?.length || 0;
  return `${images} 图 / ${videos} 视频`;
}

export function getHouseIssueActionHint(
  house: {
    images?: Record<string, unknown>[];
    videos?: Record<string, unknown>[];
    landlord_id?: number | null;
    asking_rent?: string | number | null;
  },
  rules?: unknown,
) {
  const blocking = getHouseBlockingIssues(house, rules);
  const warnings = getHouseWarningIssues(house, rules);
  const issues = getTrackedHousePublishIssues(house, rules);
  if (!blocking.length && !warnings.length) return '资料已满足发布条件，可直接发布；展示素材可按优先级持续补齐。';
  if (!issues.length) return '资料完整，可安排发布或带看';
  if (!blocking.length && warnings.length) {
    if (warnings.length === 1) return `可直接发布，建议补齐${warnings[0]}`;
    return `可直接发布，建议继续补齐 ${warnings[0]} 等 ${warnings.length} 项提醒`;
  }
  if (blocking.includes('缺房东') && (warnings.includes('缺封面') || warnings.includes('图片不足') || warnings.includes('缺户型图'))) {
    return '先补房东主体，其他媒体问题可作为发布提醒继续处理';
  }
  if (blocking.includes('缺房东') || blocking.includes('缺租金')) {
    return '先补基础资料，再回到详情执行发布检查';
  }
  if (blocking.includes('缺封面') || blocking.includes('图片不足') || blocking.includes('缺户型图') || blocking.includes('视频不足')) {
    return '当前仍有阻断项，先维护媒体后再发布';
  }
  return '按阻断项优先补齐后再发布';
}
