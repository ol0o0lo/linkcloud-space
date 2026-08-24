import {
  BellOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { Statistic } from 'antd';
import { useMineWorkbenchData } from '../../data/MineWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';

export function TaskSummaryWidget({ width }: { width: WorkbenchWidgetWidth }) {
  const { cx, styles } = useStyles();
  const { dashboard, dashboardLoading, dashboardError, retryDashboard } =
    useMineWorkbenchData();
  const items = [
    {
      key: 'overdue',
      label: '已逾期',
      value: dashboard?.overdue || 0,
      hint: '需要优先处理',
      className: styles.summaryMetricDanger,
      icon: <ExclamationCircleOutlined />,
      path: '/rental/workbench/tasks?overdue=true',
    },
    {
      key: 'due-today',
      label: '今日到期',
      value: dashboard?.due_today || 0,
      hint: '今天截止的任务',
      className: styles.summaryMetricWarning,
      icon: <ClockCircleOutlined />,
      path: '/rental/workbench/tasks',
    },
    {
      key: 'pending',
      label: '待接受',
      value: dashboard?.pending_acceptance || 0,
      hint: '等待确认领取',
      className: styles.summaryMetricInfo,
      icon: <UserAddOutlined />,
      path: '/rental/workbench/tasks?status=pending',
    },
    {
      key: 'announcements',
      label: '公告待确认',
      value: dashboard?.unacknowledged_announcements || 0,
      hint: '需要阅读确认',
      className: styles.summaryMetricPrimary,
      icon: <BellOutlined />,
      path: '/rental/workbench/announcements',
    },
  ];

  return (
    <WorkbenchWidgetFrame
      variant="summary"
      title="待办概览"
      subtitle="当前空间内与我有关的任务与公告"
      loading={dashboardLoading}
      error={dashboardError}
      onRetry={retryDashboard}
    >
      <div
        className={cx(
          styles.summaryMetricGrid,
          width === 2 && styles.summaryMetricGridCompact,
        )}
        data-testid="mine-summary-rail"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx(styles.summaryMetric, item.className)}
            onClick={() => history.push(item.path)}
          >
            <span className={styles.summaryMetricHeader}>
              <span>{item.label}</span>
              <span className={styles.summaryMetricIcon} aria-hidden="true">
                {item.icon}
              </span>
            </span>
            <Statistic value={item.value} />
            <small className={styles.summaryMetricHint}>{item.hint}</small>
          </button>
        ))}
      </div>
    </WorkbenchWidgetFrame>
  );
}
