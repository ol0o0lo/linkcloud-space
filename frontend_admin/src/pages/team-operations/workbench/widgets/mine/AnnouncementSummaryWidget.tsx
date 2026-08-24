import { NotificationOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useMineWorkbenchData } from '../../data/MineWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

export function AnnouncementSummaryWidget({
  width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const {
    announcements,
    announcementsLoading,
    announcementsError,
    retryAnnouncements,
  } = useMineWorkbenchData();

  return (
    <WorkbenchWidgetFrame
      variant="announcement"
      title="公告摘要"
      subtitle="需要关注的团队与组织消息"
      extra={
        <Button
          type="link"
          onClick={() => history.push('/rental/workbench/announcements')}
        >
          全部公告
        </Button>
      }
      loading={announcementsLoading}
      error={announcementsError}
      onRetry={retryAnnouncements}
    >
      {announcements.length ? (
        <div
          className={styles.announcementSummaryList}
          data-testid="mine-announcement-note"
        >
          {announcements.map((announcement) => (
            <button
              key={announcement.id}
              type="button"
              className={styles.announcementSummaryItem}
              onClick={() =>
                history.push(
                  `/rental/workbench/announcements?announcement_id=${announcement.id}`,
                )
              }
            >
              <span className={styles.announcementSummaryCopy}>
                <span className={styles.announcementSummaryLabel}>
                  {announcement.require_acknowledgement
                    ? '需要确认'
                    : '团队消息'}
                </span>
                <strong>{announcement.title}</strong>
                {width > 1 && announcement.published_at ? (
                  <Typography.Text type="secondary">
                    {dayjs(announcement.published_at).format('M月D日 HH:mm')}
                  </Typography.Text>
                ) : null}
              </span>
              {!announcement.is_acknowledged &&
              announcement.require_acknowledgement ? (
                <Tag color="blue">待确认</Tag>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div
          className={styles.announcementSummaryEmpty}
          data-testid="mine-announcement-empty"
        >
          <span className={styles.announcementSummaryEmptyIcon} aria-hidden="true">
            <NotificationOutlined />
          </span>
          <span className={styles.announcementSummaryEmptyCopy}>
            <strong>当前没有需要关注的公告</strong>
            <span>新的团队或组织消息发布后会显示在这里</span>
          </span>
        </div>
      )}
    </WorkbenchWidgetFrame>
  );
}
