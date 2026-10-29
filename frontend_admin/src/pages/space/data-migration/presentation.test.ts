import { describe, expect, it } from 'vitest';
import type {
  MigrationBatch,
  MigrationIssue,
} from '@/services/manual/dataMigration';
import {
  batchResult,
  businessProgress,
  emptyDecisions,
  setIssueDecision,
} from './presentation';

const issue: MigrationIssue = {
  entity_type: 'buildings',
  source_id: '17',
  field: 'floors',
  code: 'required',
  message: '缺少总楼层',
};

describe('迁移预检与进度', () => {
  it('将数值补全、复用目标和历史员工映射分别提交', () => {
    let decisions = setIssueDecision(emptyDecisions(), issue, '5');
    decisions = setIssueDecision(
      decisions,
      { ...issue, field: 'target_id' },
      24,
    );
    decisions = setIssueDecision(
      decisions,
      { ...issue, entity_type: 'staff', field: 'user_id' },
      32,
    );
    expect(decisions).toEqual({
      overrides: [
        { entity_type: 'buildings', source_id: '17', fields: { floors: 5 } },
      ],
      mappings: [{ entity_type: 'buildings', source_id: '17', target_id: 24 }],
      member_mappings: { '17': 32 },
    });
    expect(setIssueDecision(decisions, issue, null).overrides).toEqual([]);
    expect(
      setIssueDecision(decisions, { ...issue, field: 'landlord_id' }, null)
        .overrides[0].fields.landlord_id,
    ).toBeNull();
  });

  it('相同旧编号的不同实体补全不会互相覆盖，零值不会丢失', () => {
    let decisions = setIssueDecision(emptyDecisions(), issue, 5);
    decisions = setIssueDecision(
      decisions,
      { ...issue, entity_type: 'houses', field: 'living_rooms' },
      0,
    );
    expect(decisions.overrides).toHaveLength(2);
    expect(decisions.overrides[1].fields.living_rooms).toBe(0);
  });

  it('业务导入成功、资源失败或缺失时不能显示全部完成', () => {
    const batch: MigrationBatch = {
      id: 'batch-1',
      source_team_name: '测试团队',
      source_team_id: '1',
      created_at: '2026-10-25T00:00:00Z',
      updated_at: '2026-10-25T00:00:00Z',
      error_message: '',
      status: 'completed',
      media_status: 'completed',
      media_summary: {
        total: 1,
        failed: 0,
        missing: 1,
        succeeded: 0,
        pending: 0,
        processing: 0,
      },
      summary: { total: 10, created: 4, archived: 3, failed: 1, pending: 2 },
    };
    expect(batchResult(batch)).toBe('业务记录需要处理');
    expect(
      batchResult({ ...batch, summary: { total: 10, archived: 10 } }),
    ).toBe('业务已导入，资源需要处理');
    expect(businessProgress(batch)).toEqual({
      total: 10,
      finished: 7,
      percent: 70,
    });
    expect(businessProgress({ ...batch, summary: {} }).percent).toBeUndefined();
  });
});
