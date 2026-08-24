import dayjs from 'dayjs';
import type { TaskAssignment } from '@/services/manual/teamOperations';

export type DueTimeTone = 'danger' | 'warning' | 'default' | 'muted';

export type DueTimeDisplay = {
  label: string;
  detail: string;
  tone: DueTimeTone;
};

export const groupUndatedTasksLast = (
  items: TaskAssignment[],
): TaskAssignment[] => {
  const dated: TaskAssignment[] = [];
  const undated: TaskAssignment[] = [];

  items.forEach((item) => {
    (item.due_at ? dated : undated).push(item);
  });

  return [...dated, ...undated];
};

export const formatDueTimeDisplay = (
  assignment: TaskAssignment,
  now = dayjs(),
): DueTimeDisplay => {
  if (!assignment.due_at) {
    return {
      label: '未设置',
      detail: '无截止时间',
      tone: 'muted',
    };
  }

  const dueAt = dayjs(assignment.due_at);
  if (!dueAt.isValid()) {
    return {
      label: '未设置',
      detail: '时间格式异常',
      tone: 'muted',
    };
  }

  if (assignment.is_overdue) {
    return {
      label: '已逾期',
      detail: dueAt.isSame(now, 'year')
        ? dueAt.format('M月D日 HH:mm')
        : dueAt.format('YYYY年M月D日 HH:mm'),
      tone: 'danger',
    };
  }

  if (dueAt.isSame(now, 'day')) {
    return {
      label: '今天',
      detail: dueAt.format('HH:mm'),
      tone: 'warning',
    };
  }

  if (dueAt.isSame(now.add(1, 'day'), 'day')) {
    return {
      label: '明天',
      detail: dueAt.format('HH:mm'),
      tone: 'default',
    };
  }

  return {
    label: dueAt.isSame(now, 'year')
      ? dueAt.format('M月D日')
      : dueAt.format('YYYY年M月D日'),
    detail: dueAt.format('HH:mm'),
    tone: 'default',
  };
};
