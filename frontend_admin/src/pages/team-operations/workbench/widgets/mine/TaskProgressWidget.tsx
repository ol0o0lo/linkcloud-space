import { Progress, Statistic } from 'antd';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useMineWorkbenchData } from '../../data/MineWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

export function TaskProgressWidget({
  width: _width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const { dashboard, dashboardLoading, dashboardError, retryDashboard } =
    useMineWorkbenchData();
  const active =
    (dashboard?.pending_acceptance || 0) + (dashboard?.in_progress || 0);
  const completed = dashboard?.completed_today || 0;
  const total = active + completed;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return (
    <WorkbenchWidgetFrame
      variant="progress"
      title="任务进展"
      subtitle="今天的任务处理节奏"
      loading={dashboardLoading}
      error={dashboardError}
      onRetry={retryDashboard}
    >
      <div
        className={styles.taskProgressBody}
        data-testid="mine-progress-ring"
      >
        <Progress
          type="circle"
          percent={percent}
          size={112}
          strokeColor="#4f7cff"
          railColor="#e9edf4"
          format={(value) => `${value || 0}%`}
        />
        <div className={styles.taskProgressCaption}>
          <span>今日完成率</span>
          <strong>
            {completed} / {total}
          </strong>
        </div>
        <div className={styles.taskProgressStats}>
          <Statistic title="进行中" value={dashboard?.in_progress || 0} />
          <Statistic title="今日完成" value={completed} />
        </div>
      </div>
    </WorkbenchWidgetFrame>
  );
}
