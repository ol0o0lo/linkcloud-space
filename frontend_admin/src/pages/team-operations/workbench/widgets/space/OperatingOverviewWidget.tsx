import {
  CheckCircleOutlined,
  FileDoneOutlined,
  StopOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Statistic } from 'antd';
import { AppIcon } from '@/components/AppIcon';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useSpaceWorkbenchData } from '../../data/SpaceWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

export function OperatingOverviewWidget({
  width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { cx, styles } = useStyles();
  const data = useSpaceWorkbenchData();
  const items = [
    {
      key: 'total',
      label: '在管房源',
      value: data.totalHouseCount,
      hint: '当前空间全部在管资产',
      icon: <AppIcon name="house" />,
      className: styles.spaceOverviewMetricPrimary,
    },
    {
      key: 'blocked',
      label: '阻断发布',
      value: data.blockedHouseItems.length,
      hint: '需要补充基础资料',
      icon: <StopOutlined />,
      className: styles.spaceOverviewMetricDanger,
    },
    {
      key: 'ready',
      label: '可发布',
      value: data.readyHouseItems.length,
      hint: '检查通过，可立即发布',
      icon: <CheckCircleOutlined />,
      className: styles.spaceOverviewMetricSuccess,
    },
    {
      key: 'contact-missing',
      label: '待补租客',
      value: data.missingContactCount,
      hint: '成交后资料未完整',
      icon: <UserAddOutlined />,
      className: styles.spaceOverviewMetricWarning,
    },
    {
      key: 'lease',
      label: '待签约',
      value: data.readyLeaseCount,
      hint: '等待创建租约',
      icon: <FileDoneOutlined />,
      className: styles.spaceOverviewMetricPurple,
    },
  ];

  return (
    <WorkbenchWidgetFrame
      variant="overview"
      title="经营总览"
      subtitle="汇总房源发布与成交转签的关键运营指标"
      extra="每 60 秒自动更新"
      loading={data.overviewLoading}
      error={data.overviewError}
      onRetry={data.retryOverview}
    >
      <div
        className={cx(
          styles.spaceOverviewGrid,
          width === 2 && styles.spaceOverviewGridCompact,
        )}
        data-testid="space-metric-deck"
      >
        {items.map((item) => (
          <div
            className={cx(styles.spaceOverviewMetric, item.className)}
            key={item.key}
          >
            <span className={styles.spaceOverviewMetricHeader}>
              <span>{item.label}</span>
              <span
                className={styles.spaceOverviewMetricIcon}
                aria-hidden="true"
              >
                {item.icon}
              </span>
            </span>
            <Statistic value={item.value} />
            <small>{item.hint}</small>
          </div>
        ))}
      </div>
    </WorkbenchWidgetFrame>
  );
}
