import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { buildAnalyticsSearch, getAnalyticsSearchState } from './state';

const TODAY = dayjs('2026-08-30');

describe('经营分析 URL 状态', () => {
  it('恢复合法的筛选和分页状态', () => {
    expect(
      getAnalyticsSearchState(
        '?start_date=2026-07-01&end_date=2026-08-01&source=h5&page=2&page_size=50',
        TODAY,
      ),
    ).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-08-01',
      source: 'h5',
      page: 2,
      pageSize: 50,
    });
  });

  it.each([
    '?start_date=2026-02-30&end_date=2026-08-01',
    '?start_date=2026-08-02&end_date=2026-08-01',
    '?start_date=2026-08-01&end_date=2026-08-31',
    '?start_date=2025-08-29&end_date=2026-08-30',
  ])('非法日期范围回退近 30 天：%s', (search) => {
    expect(getAnalyticsSearchState(search, TODAY)).toMatchObject({
      startDate: '2026-08-01',
      endDate: '2026-08-30',
    });
  });

  it('包含首尾 366 天仍为合法范围', () => {
    expect(
      getAnalyticsSearchState(
        '?start_date=2025-08-30&end_date=2026-08-29',
        TODAY,
      ),
    ).toMatchObject({
      startDate: '2025-08-30',
      endDate: '2026-08-29',
    });
  });

  it('同步时省略默认值并保留页面其他参数', () => {
    expect(
      buildAnalyticsSearch(
        '?tab=houses&start_date=2020-01-01&page=9&page_size=100',
        {
          startDate: '2026-08-01',
          endDate: '2026-08-30',
          page: 1,
          pageSize: 20,
        },
        TODAY,
      ),
    ).toBe('tab=houses');
  });

  it('同步非默认筛选和分页状态', () => {
    expect(
      buildAnalyticsSearch(
        '?tab=houses',
        {
          startDate: '2026-07-01',
          endDate: '2026-08-01',
          source: 'miniprogram',
          page: 3,
          pageSize: 50,
        },
        TODAY,
      ),
    ).toBe(
      'tab=houses&start_date=2026-07-01&end_date=2026-08-01&source=miniprogram&page=3&page_size=50',
    );
  });
});
