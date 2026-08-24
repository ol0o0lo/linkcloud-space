import {
  NotificationOutlined,
  RightOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

export function MineQuickActionsWidget({
  width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const links = [
    {
      key: 'tasks',
      label: '全部任务',
      description: '查看并处理分配给我的工作',
      path: '/rental/workbench/tasks',
      icon: <UnorderedListOutlined />,
    },
    {
      key: 'announcements',
      label: '团队公告',
      description: '阅读需要关注和确认的消息',
      path: '/rental/workbench/announcements',
      icon: <NotificationOutlined />,
    },
  ];

  return (
    <WorkbenchWidgetFrame
      variant="quick-actions"
      title="快捷操作"
      subtitle="常用工作入口"
    >
      <div
        className={styles.widgetQuickActions}
        data-testid="mine-quick-actions"
        data-wide={width > 1 || undefined}
      >
        {links.map((link) => (
          <button
            key={link.key}
            type="button"
            className={styles.widgetQuickAction}
            onClick={() => history.push(link.path)}
          >
            <span className={styles.widgetQuickActionIcon}>{link.icon}</span>
            <span className={styles.widgetQuickActionCopy}>
              <strong>{link.label}</strong>
              <small>{link.description}</small>
            </span>
            <RightOutlined
              className={styles.widgetQuickActionArrow}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </WorkbenchWidgetFrame>
  );
}
