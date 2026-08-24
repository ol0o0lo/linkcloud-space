import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button, Space, Tag, Typography } from 'antd';
import type { TaskAssignment } from '@/services/manual/teamOperations';
import { assignmentStatusColor, priorityColor } from '../../../shared';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useMineWorkbenchData } from '../../data/MineWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import {
  formatDueTimeDisplay,
  groupUndatedTasksLast,
} from '../../priorityTimeline';
import { useStyles } from '../../styles';

function PriorityTaskRow({ assignment }: { assignment: TaskAssignment }) {
  const { styles } = useStyles();
  const { acceptingId, completingId, accept, complete } =
    useMineWorkbenchData();
  const due = formatDueTimeDisplay(assignment);
  const taskPath = `/rental/workbench/tasks?assignment_id=${assignment.id}`;

  return (
    <div className={styles.priorityTaskRow} data-tone={due.tone}>
      <div className={styles.priorityTaskDue}>
        <strong>{due.label}</strong>
        <span>{due.detail}</span>
      </div>
      <div className={styles.priorityTaskMain}>
        <button
          type="button"
          className={styles.priorityTaskTitle}
          onClick={() => history.push(taskPath)}
        >
          {assignment.task_title}
        </button>
        <Space size={[4, 4]} wrap>
          <Tag color={priorityColor(assignment.priority)}>
            {assignment.priority__mapping}
          </Tag>
          <Tag color={assignmentStatusColor(assignment.status)}>
            {assignment.status__mapping}
          </Tag>
          <Typography.Text type="secondary">
            {assignment.team_name || '组织级任务'}
          </Typography.Text>
        </Space>
      </div>
      <Space className={styles.priorityTaskActions}>
        {assignment.status === 'pending' ? (
          <Button
            type="primary"
            size="small"
            loading={acceptingId === assignment.id}
            onClick={() => void accept(assignment.id)}
          >
            接受
          </Button>
        ) : null}
        {assignment.status === 'in_progress' ? (
          <Button
            type="primary"
            size="small"
            loading={completingId === assignment.id}
            onClick={() => void complete(assignment.id)}
          >
            完成
          </Button>
        ) : null}
        <Button size="small" type="link" onClick={() => history.push(taskPath)}>
          查看
        </Button>
      </Space>
    </div>
  );
}

export function PriorityTasksWidget({
  width: _width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const { dashboard, dashboardLoading, dashboardError, retryDashboard } =
    useMineWorkbenchData();
  const assignments = groupUndatedTasksLast(dashboard?.urgent_items || []);

  return (
    <WorkbenchWidgetFrame
      variant="priority"
      title="优先处理"
      subtitle="按截止时间与优先级展示最需要处理的任务"
      extra={
        <Button
          type="link"
          onClick={() => history.push('/rental/workbench/tasks')}
        >
          查看全部
        </Button>
      }
      loading={dashboardLoading}
      error={dashboardError}
      onRetry={retryDashboard}
    >
      {assignments.length ? (
        <div className={styles.priorityTaskContent}>
          <div
            className={styles.priorityTaskList}
            data-testid="mine-priority-queue"
          >
            {assignments.map((assignment) => (
              <PriorityTaskRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
          <div className={styles.priorityTaskGuide}>
            <span className={styles.priorityTaskGuideIcon} aria-hidden="true">
              <ClockCircleOutlined />
            </span>
            <span className={styles.priorityTaskGuideCopy}>
              <strong>队列排序规则</strong>
              <small>帮助你先处理最接近截止时间的任务</small>
            </span>
            <span className={styles.priorityTaskGuideRule}>
              <CalendarOutlined aria-hidden="true" />
              截止时间优先
            </span>
            <span className={styles.priorityTaskGuideRule}>
              <InboxOutlined aria-hidden="true" />
              未设截止时间排在最后
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.widgetCompactEmpty}>
          <span
            className={styles.widgetCompactEmptyIcon}
            data-tone="success"
            aria-hidden="true"
          >
            <CheckCircleOutlined />
          </span>
          <span className={styles.widgetCompactEmptyCopy}>
            <strong>暂无优先待办</strong>
            <small>当前没有需要立即处理的任务</small>
          </span>
        </div>
      )}
    </WorkbenchWidgetFrame>
  );
}
