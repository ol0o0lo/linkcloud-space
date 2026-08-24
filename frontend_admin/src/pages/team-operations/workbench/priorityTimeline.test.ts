import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { TaskAssignment } from '@/services/manual/teamOperations';
import {
  formatDueTimeDisplay,
  groupUndatedTasksLast,
} from './priorityTimeline';

const assignment = (overrides: Partial<TaskAssignment>): TaskAssignment =>
  ({
    id: 1,
    task_title: '测试任务',
    due_at: null,
    is_overdue: false,
    ...overrides,
  }) as TaskAssignment;

describe('priority timeline', () => {
  it('moves undated tasks to the end without changing relative order', () => {
    const items = [
      assignment({ id: 1, due_at: null }),
      assignment({ id: 2, due_at: '2026-08-18T12:00:00+08:00' }),
      assignment({ id: 3, due_at: null }),
      assignment({ id: 4, due_at: '2026-08-19T12:00:00+08:00' }),
    ];

    expect(groupUndatedTasksLast(items).map((item) => item.id)).toEqual([
      2, 4, 1, 3,
    ]);
  });

  it('formats today and tomorrow as concise timeline labels', () => {
    const now = dayjs('2026-08-17T10:00:00+08:00');

    expect(
      formatDueTimeDisplay(
        assignment({ due_at: '2026-08-17T18:30:00+08:00' }),
        now,
      ),
    ).toEqual({ label: '今天', detail: '18:30', tone: 'warning' });
    expect(
      formatDueTimeDisplay(
        assignment({ due_at: '2026-08-18T09:15:00+08:00' }),
        now,
      ),
    ).toEqual({ label: '明天', detail: '09:15', tone: 'default' });
  });

  it('emphasizes overdue tasks and labels tasks without a due time', () => {
    const now = dayjs('2026-08-17T10:00:00+08:00');

    expect(
      formatDueTimeDisplay(
        assignment({
          due_at: '2026-08-16T18:30:00+08:00',
          is_overdue: true,
        }),
        now,
      ),
    ).toEqual({
      label: '已逾期',
      detail: '8月16日 18:30',
      tone: 'danger',
    });
    expect(formatDueTimeDisplay(assignment({ due_at: null }), now)).toEqual({
      label: '未设置',
      detail: '无截止时间',
      tone: 'muted',
    });
  });
});
