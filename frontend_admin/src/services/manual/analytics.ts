import { request } from '@umijs/max';

export type AnalyticsEventInput = {
  event_name: string;
  target_type: string;
  target_id: string | number;
  source?: string;
  anonymous_id?: string;
  session_id?: string;
  occurred_at?: string;
  properties?: Record<string, unknown>;
  idempotency_key?: string;
};

export type AnalyticsCollectResult = {
  accepted: number;
  duplicates: number;
  event_ids: number[];
  errors: { index: number; event_name: string; message: string }[];
};

export type AnalyticsSourceOption = {
  value: string;
  label: string;
};

export type AnalyticsMetric = {
  event_name: string;
  label: string;
  count: number;
  unique_visitors: number | null;
};

export type AnalyticsOverview = {
  start_date: string;
  end_date: string;
  total_events: number;
  unique_visitors: number | null;
  metrics: AnalyticsMetric[];
};

export type AnalyticsTrendPoint = {
  date: string;
  event_name: string;
  count: number;
  unique_visitors: number;
};

export type AnalyticsTargetMetric = {
  target_id: string;
  label: string;
  display_items: AnalyticsTargetDisplayItem[];
  total: number;
  unique_visitors: number | null;
  metrics: Record<string, number>;
};

export type AnalyticsTargetDisplayItem = {
  target_type: string;
  target_id: string;
  label: string;
};

export type AnalyticsQuery = {
  start_date: string;
  end_date: string;
  source?: string;
};

export type AnalyticsPagedTargets = {
  items: AnalyticsTargetMetric[];
  total: number;
  page: number;
  page_size: number;
};

function storageId(storage: Storage | undefined, key: string) {
  if (!storage) return '';
  const saved = storage.getItem(key);
  if (saved) return saved;
  const value =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(key, value);
  return value;
}

export function browserAnalyticsIdentity() {
  if (typeof window === 'undefined') {
    return { anonymous_id: '', session_id: '' };
  }
  return {
    anonymous_id: storageId(window.localStorage, 'analytics.anonymous_id'),
    session_id: storageId(window.sessionStorage, 'analytics.session_id'),
  };
}

export function collectAnalyticsEvents(events: AnalyticsEventInput[]) {
  return request<AnalyticsCollectResult>(
    '/api/analytics/events/',
    {
      method: 'POST',
      data: { events },
      skipErrorHandler: true,
    },
  );
}

export function trackAnalyticsEvent(input: AnalyticsEventInput) {
  const identity = browserAnalyticsIdentity();
  return collectAnalyticsEvents(
    [
      {
        ...identity,
        source: 'public',
        occurred_at: new Date().toISOString(),
        ...input,
      },
    ],
  );
}

export function trackAnalyticsEventSafely(input: AnalyticsEventInput) {
  try {
    void trackAnalyticsEvent(input).catch(() => undefined);
  } catch {
    // 行为分析不能阻断页面主流程。
  }
}

export function getAnalyticsOverview(params: AnalyticsQuery) {
  return request<AnalyticsOverview>('/api/analytics/overview/', {
    method: 'GET',
    params,
  });
}

export function getAnalyticsSources() {
  return request<AnalyticsSourceOption[]>('/api/analytics/sources/', {
    method: 'GET',
  });
}

export function getAnalyticsTrends(
  params: AnalyticsQuery & { event_names?: string },
) {
  return request<AnalyticsTrendPoint[]>('/api/analytics/trends/', {
    method: 'GET',
    params,
  });
}

export function getAnalyticsTargets(
  params: AnalyticsQuery & {
    target_type: string;
    event_names?: string;
    page?: number;
    page_size?: number;
  },
) {
  return request<AnalyticsPagedTargets>('/api/analytics/targets/', {
    method: 'GET',
    params,
  });
}
