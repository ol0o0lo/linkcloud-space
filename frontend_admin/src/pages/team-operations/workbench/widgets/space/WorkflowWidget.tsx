import {
  AuditOutlined,
  CheckCircleOutlined,
  FileAddOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { Segmented, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useSpaceWorkbenchData } from '../../data/SpaceWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';
import {
  getWorkbenchFiltersFromSearch,
  syncWorkbenchFiltersSearch,
  type WorkflowFilterValue,
  type WorkflowTaskRow,
} from './model';

const dashboardHref = (path: string) => `/dashboard${path}`;

const workflowStages = [
  { label: '确认成交', icon: <AuditOutlined /> },
  { label: '补全租客资料', icon: <UserAddOutlined /> },
  { label: '创建租约', icon: <FileAddOutlined /> },
  { label: '完成签约', icon: <CheckCircleOutlined /> },
];

export function WorkflowWidget({ width }: { width: WorkbenchWidgetWidth }) {
  const { styles } = useStyles();
  const data = useSpaceWorkbenchData();
  const [filter, setFilter] = useState<WorkflowFilterValue>(() =>
    typeof window === 'undefined'
      ? 'all'
      : getWorkbenchFiltersFromSearch(window.location.search).workflowFilter,
  );
  const rows = useMemo(() => {
    if (filter === 'all') return data.workflowTasks;
    return data.workflowTasks.filter((item) => item.queueKey === filter);
  }, [data.workflowTasks, filter]);

  useEffect(() => {
    const current = getWorkbenchFiltersFromSearch(window.location.search);
    syncWorkbenchFiltersSearch({ ...current, workflowFilter: filter });
  }, [filter]);

  const openPath = (record: WorkflowTaskRow, event: React.MouseEvent) => {
    event.preventDefault();
    history.push(record.actionPath);
  };

  return (
    <WorkbenchWidgetFrame
      variant="workflow"
      title="成交转签"
      subtitle={`显示 ${rows.length} / ${data.workflowTasks.length} 条待办`}
      loading={data.workflowLoading}
      error={data.workflowError}
      onRetry={data.retryWorkflow}
      extra={
        <Segmented
          size="small"
          value={filter}
          options={[
            { label: `全部 ${data.workflowTasks.length}`, value: 'all' },
            {
              label: `待补租客 ${data.missingContactCount}`,
              value: 'contact-missing',
            },
            {
              label: `待签约 ${data.readyLeaseCount}`,
              value: 'converted',
            },
          ]}
          onChange={(value) => setFilter(value as WorkflowFilterValue)}
        />
      }
    >
      <ol className={styles.spaceWorkflowRail} aria-label="成交转签流程">
        {workflowStages.map((stage, index) => (
          <li
            key={stage.label}
            className={styles.spaceWorkflowStage}
            data-active={index === 1 || index === 2 || undefined}
          >
            <span aria-hidden="true">{stage.icon}</span>
            <strong>{stage.label}</strong>
          </li>
        ))}
      </ol>
      <div
        className={styles.spaceWorkList}
        data-testid="space-workflow-rail"
        data-wide={width === 3 || undefined}
      >
        {rows.length ? (
          rows.map((record) => (
            <div className={styles.spaceWorkRow} key={record.key}>
              <div className={styles.spaceWorkMain}>
                <Space size={6} wrap>
                  <Tag
                    color={
                      record.queueKey === 'contact-missing' ? 'gold' : 'purple'
                    }
                  >
                    {record.queue}
                  </Tag>
                  <strong>{record.title}</strong>
                </Space>
                <span>{record.house.label}</span>
                <Typography.Text type="secondary">
                  {record.nextStep}
                </Typography.Text>
              </div>
              <a
                href={dashboardHref(record.actionPath)}
                onClick={(event) => openPath(record, event)}
              >
                {record.actionLabel}
              </a>
            </div>
          ))
        ) : (
          <Typography.Text type="secondary">
            {filter === 'all' ? '暂无成交转签待办' : '当前筛选下暂无待办'}
          </Typography.Text>
        )}
      </div>
    </WorkbenchWidgetFrame>
  );
}
