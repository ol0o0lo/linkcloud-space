import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_PUBLISH_RULES,
  buildHousePublishRulesPreset,
  normalizeHousePublishRules,
  summarizeHousePublishRules,
} from '../publish-rules';

describe('house publish rules', () => {
  it('fills invalid rule values with defaults and clamps minimum counts', () => {
    const rules = normalizeHousePublishRules({
      images: { mode: 'warn', min_count: -3 },
      video: { mode: 'required', min_count: 'bad' },
      landlord: { mode: 'off' },
    });

    expect(rules).toEqual({
      ...DEFAULT_HOUSE_PUBLISH_RULES,
      images: { mode: 'warn', min_count: 0 },
      video: { mode: 'required', min_count: 1 },
      landlord: { mode: 'off' },
    });
  });

  it('summarizes blocking, warning, and ignored rules by label', () => {
    const summary = summarizeHousePublishRules({
      landlord: { mode: 'required' },
      rent: { mode: 'required' },
      cover: { mode: 'warn' },
      images: { mode: 'warn', min_count: 3 },
      floor_plan: { mode: 'off' },
      video: { mode: 'off', min_count: 1 },
    });

    expect(summary.blocking).toEqual(['房东主体', '租金']);
    expect(summary.warning).toEqual(['封面图', '房源图片']);
    expect(summary.ignored).toEqual(['户型图', '视频']);
  });

  it('builds a relaxed preset that keeps only the core publish blockers', () => {
    expect(buildHousePublishRulesPreset('relaxed')).toEqual({
      landlord: { mode: 'required' },
      rent: { mode: 'required' },
      cover: { mode: 'off' },
      images: { mode: 'off', min_count: 3 },
      floor_plan: { mode: 'off' },
      video: { mode: 'off', min_count: 1 },
    });
  });
});
