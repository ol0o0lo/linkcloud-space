import { ArrowRightOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Modal,
  message,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { houseLabel } from '@/pages/rental/constants';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useSpaceWorkbenchData } from '../../data/SpaceWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';
import {
  getWorkbenchFiltersFromSearch,
  type PublishFilterValue,
  type PublishWorkbenchRow,
  syncWorkbenchFiltersSearch,
} from './model';

const dashboardHref = (path: string) => `/dashboard${path}`;

export function PublishWorkspaceWidget({
  width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const data = useSpaceWorkbenchData();
  const [filter, setFilter] = useState<PublishFilterValue>(() =>
    typeof window === 'undefined'
      ? 'all'
      : getWorkbenchFiltersFromSearch(window.location.search).publishFilter,
  );
  const [confirmHouseId, setConfirmHouseId] = useState<number | null>(null);
  const rows = useMemo(() => {
    if (filter === 'all') return data.publishRows;
    return data.publishRows.filter((item) => item.stage === filter);
  }, [data.publishRows, filter]);
  const visibleLimit = width === 3 ? 8 : 6;
  const visibleRows = rows.slice(0, visibleLimit);
  const remainingCount = Math.max(rows.length - visibleRows.length, 0);

  useEffect(() => {
    const current = getWorkbenchFiltersFromSearch(window.location.search);
    syncWorkbenchFiltersSearch({ ...current, publishFilter: filter });
  }, [filter]);

  const openPath = (path: string, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    history.push(path);
  };

  const actions = (record: PublishWorkbenchRow) => (
    <Space size={6} wrap={false}>
      <a
        href={dashboardHref(record.actionPath)}
        onClick={(event) => openPath(record.actionPath, event)}
      >
        {record.actionLabel}
      </a>
      {record.stage === 'ready' ? (
        <Button
          type="link"
          size="small"
          loading={data.publishing}
          onClick={() => setConfirmHouseId(record.house.id)}
        >
          发布
        </Button>
      ) : null}
    </Space>
  );

  return (
    <>
      <WorkbenchWidgetFrame
        variant="publish"
        title="发布工作区"
        subtitle={
          remainingCount
            ? `共 ${rows.length} 套 · 当前展开 ${visibleRows.length} 套`
            : `显示 ${rows.length} / ${data.publishRows.length} 套房源`
        }
        loading={data.publishLoading}
        error={data.publishError}
        onRetry={data.retryPublish}
        extra={
          <Segmented
            size="small"
            value={filter}
            options={[
              { label: `全部 ${data.publishRows.length}`, value: 'all' },
              {
                label: `阻断发布 ${data.blockedHouseItems.length}`,
                value: 'blocked',
              },
              {
                label: `待发布 ${data.readyHouseItems.length}`,
                value: 'ready',
              },
            ]}
            onChange={(value) => setFilter(value as PublishFilterValue)}
          />
        }
      >
        {filter !== 'all' ? (
          <Alert
            className={styles.spaceFilterAlert}
            type="info"
            showIcon
            title={`当前只看：发布工作区：${filter === 'blocked' ? '阻断发布' : '待发布'}`}
            action={
              <a
                href={dashboardHref('/rental/workbench/overview')}
                onClick={(event) => {
                  event.preventDefault();
                  setFilter('all');
                  syncWorkbenchFiltersSearch({
                    publishFilter: 'all',
                    workflowFilter: 'all',
                  });
                }}
              >
                查看全部
              </a>
            }
          />
        ) : null}
        <div
          className={styles.spacePublishQueue}
          data-testid="space-publish-queue"
          data-compact={width === 2 || undefined}
          data-wide={width === 3 || undefined}
        >
          {rows.length ? (
            <>
              {visibleRows.map((record) => (
                <div
                  className={styles.spacePublishQueueItem}
                  data-stage={record.stage}
                  key={record.key}
                >
                  <span
                    className={styles.spacePublishStatusBar}
                    aria-hidden="true"
                  />
                  <div className={styles.spacePublishQueueCopy}>
                    <strong>{houseLabel(record.house)}</strong>
                    <Typography.Text type="secondary">
                      {record.actionHint}
                    </Typography.Text>
                    <Space size={[4, 4]} wrap>
                      <Tag
                        color={record.stage === 'blocked' ? 'orange' : 'green'}
                      >
                        {record.stage === 'blocked' ? '阻断发布' : '待发布'}
                      </Tag>
                      {record.issues.map((issue) => (
                        <Tag key={issue}>{issue}</Tag>
                      ))}
                    </Space>
                  </div>
                  <div className={styles.spacePublishQueueActions}>
                    {actions(record)}
                  </div>
                </div>
              ))}
              {remainingCount ? (
                <div className={styles.spacePublishQueueFooter}>
                  <span
                    className={styles.spacePublishQueueFooterIcon}
                    aria-hidden="true"
                  >
                    <UnorderedListOutlined />
                  </span>
                  <span className={styles.spacePublishQueueFooterCopy}>
                    <strong>还有 {remainingCount} 套房源未展开</strong>
                    <small>
                      工作台优先展示队列前部，完整清单可在房源管理中继续处理
                    </small>
                  </span>
                  <Button
                    type="link"
                    icon={<ArrowRightOutlined />}
                    iconPosition="end"
                    onClick={() => history.push('/rental/properties/list')}
                  >
                    查看全部房源
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <Typography.Text type="secondary">
              当前筛选下暂无房源
            </Typography.Text>
          )}
        </div>
      </WorkbenchWidgetFrame>

      <Modal
        open={confirmHouseId !== null}
        title="确认发布房源"
        okText="确认发布"
        cancelText="先取消"
        confirmLoading={data.publishing}
        onCancel={() => setConfirmHouseId(null)}
        onOk={async () => {
          const houseId = confirmHouseId;
          if (houseId === null) return;
          await data.publishHouse(houseId);
          message.success('房源已发布');
          setConfirmHouseId(null);
        }}
      >
        <Typography.Text>
          这套房源已经具备发布条件，确认后会直接切换为招租状态。
        </Typography.Text>
      </Modal>
    </>
  );
}
