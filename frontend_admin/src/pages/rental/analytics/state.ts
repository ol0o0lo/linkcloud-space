import dayjs, { type Dayjs } from 'dayjs';

export const ANALYTICS_DEFAULT_PAGE_SIZE = 20;
export const ANALYTICS_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const ANALYTICS_MAX_RANGE_DAYS = 366;

export type AnalyticsSearchState = {
  startDate: string;
  endDate: string;
  source?: string;
  page: number;
  pageSize: number;
};

export function getDefaultAnalyticsSearchState(
  today: Dayjs = dayjs(),
): AnalyticsSearchState {
  const endDate = today.startOf('day');
  return {
    startDate: endDate.subtract(29, 'day').format('YYYY-MM-DD'),
    endDate: endDate.format('YYYY-MM-DD'),
    page: 1,
    pageSize: ANALYTICS_DEFAULT_PAGE_SIZE,
  };
}

function parseSearchDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = dayjs(value);
  if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== value) {
    return undefined;
  }
  return parsed.startOf('day');
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null) {
  const parsed = Number(value);
  return ANALYTICS_PAGE_SIZE_OPTIONS.includes(
    parsed as (typeof ANALYTICS_PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : ANALYTICS_DEFAULT_PAGE_SIZE;
}

export function getAnalyticsSearchState(
  search: string,
  today: Dayjs = dayjs(),
): AnalyticsSearchState {
  const defaults = getDefaultAnalyticsSearchState(today);
  const params = new URLSearchParams(search);
  const startDate = parseSearchDate(params.get('start_date'));
  const endDate = parseSearchDate(params.get('end_date'));
  const normalizedToday = today.startOf('day');
  const validRange = Boolean(
    startDate &&
      endDate &&
      !startDate.isAfter(endDate, 'day') &&
      !endDate.isAfter(normalizedToday, 'day') &&
      endDate.diff(startDate, 'day') + 1 <= ANALYTICS_MAX_RANGE_DAYS,
  );
  const source = params.get('source')?.trim() || undefined;
  const resolvedStartDate =
    validRange && startDate
      ? startDate.format('YYYY-MM-DD')
      : defaults.startDate;
  const resolvedEndDate =
    validRange && endDate ? endDate.format('YYYY-MM-DD') : defaults.endDate;

  return {
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    source,
    page: parsePositiveInteger(params.get('page'), 1),
    pageSize: parsePageSize(params.get('page_size')),
  };
}

export function buildAnalyticsSearch(
  currentSearch: string,
  state: AnalyticsSearchState,
  today: Dayjs = dayjs(),
) {
  const defaults = getDefaultAnalyticsSearchState(today);
  const params = new URLSearchParams(currentSearch);
  params.delete('start_date');
  params.delete('end_date');
  params.delete('source');
  params.delete('page');
  params.delete('page_size');

  if (
    state.startDate !== defaults.startDate ||
    state.endDate !== defaults.endDate
  ) {
    params.set('start_date', state.startDate);
    params.set('end_date', state.endDate);
  }
  if (state.source) params.set('source', state.source);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.pageSize !== ANALYTICS_DEFAULT_PAGE_SIZE) {
    params.set('page_size', String(state.pageSize));
  }

  return params.toString();
}
