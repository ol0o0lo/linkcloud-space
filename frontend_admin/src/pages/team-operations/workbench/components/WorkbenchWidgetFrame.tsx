import {
  AppstoreOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CameraOutlined,
  CloudUploadOutlined,
  FlagOutlined,
  NotificationOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Card, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useStyles } from '../styles';

export type WorkbenchWidgetVariant =
  | 'summary'
  | 'priority'
  | 'progress'
  | 'announcement'
  | 'quick-actions'
  | 'inspection'
  | 'overview'
  | 'publish'
  | 'risks'
  | 'workflow';

type WorkbenchWidgetFrameProps = {
  variant?: WorkbenchWidgetVariant;
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: ReactNode;
};

const widgetIcons: Record<WorkbenchWidgetVariant, ReactNode> = {
  summary: <UnorderedListOutlined />,
  priority: <FlagOutlined />,
  progress: <PieChartOutlined />,
  announcement: <NotificationOutlined />,
  'quick-actions': <AppstoreOutlined />,
  inspection: <CameraOutlined />,
  overview: <BarChartOutlined />,
  publish: <CloudUploadOutlined />,
  risks: <WarningOutlined />,
  workflow: <BranchesOutlined />,
};

export function WorkbenchWidgetFrame({
  variant,
  title,
  subtitle,
  extra,
  loading,
  error,
  onRetry,
  children,
}: WorkbenchWidgetFrameProps) {
  const { cx, styles } = useStyles();

  const heading = (
    <div className={styles.widgetFrameHeading}>
      <span
        className={styles.widgetFrameIcon}
        data-testid="workbench-widget-icon"
        aria-hidden="true"
      >
        {variant ? widgetIcons[variant] : <AppstoreOutlined />}
      </span>
      <span className={styles.widgetFrameTitle}>{title}</span>
    </div>
  );

  if (loading) {
    return (
      <section
        className={styles.widgetFrame}
        data-testid="workbench-widget-frame"
        data-variant={variant}
      >
        <Card className={styles.widgetCard} title={heading}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className={styles.widgetFrame}
        data-testid="workbench-widget-frame"
        data-variant={variant}
      >
        <Card
          className={cx(styles.widgetCard, styles.widgetCardError)}
          title={heading}
        >
          <Result
            status="error"
            title="组件数据加载失败"
            extra={
              onRetry ? <Button onClick={onRetry}>重新加载</Button> : undefined
            }
          />
        </Card>
      </section>
    );
  }

  return (
    <section
      className={styles.widgetFrame}
      data-testid="workbench-widget-frame"
      data-variant={variant}
    >
      <Card
        className={styles.widgetCard}
        title={heading}
        extra={extra}
        styles={{ body: { minWidth: 0 } }}
      >
        {subtitle ? (
          <div className={styles.widgetSubtitle} data-role="widget-subtitle">
            {subtitle}
          </div>
        ) : null}
        {children}
      </Card>
    </section>
  );
}
