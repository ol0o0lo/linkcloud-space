import {
  CalendarOutlined,
  FileDoneOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { AppIcon } from '@/components/AppIcon';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

export function SpaceQuickActionsWidget({
  width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const links = [
    {
      key: 'properties',
      label: '房源管理',
      description: '维护房源资料与发布状态',
      path: '/rental/properties/list',
      icon: <AppIcon name="house" />,
    },
    {
      key: 'viewings',
      label: '带看记录',
      description: '处理成交后待补租客记录',
      path: '/rental/viewings',
      icon: <CalendarOutlined />,
    },
    {
      key: 'leases',
      label: '租约管理',
      description: '继续签约与合同维护',
      path: '/rental/leases',
      icon: <FileDoneOutlined />,
    },
  ];

  return (
    <WorkbenchWidgetFrame
      variant="quick-actions"
      title="空间快捷操作"
      subtitle="常用运营入口"
    >
      <div
        className={styles.spaceQuickActions}
        data-testid="space-quick-actions"
        data-wide={width > 1 || undefined}
      >
        {links.map((link) => (
          <button
            key={link.key}
            type="button"
            className={styles.spaceQuickAction}
            onClick={() => history.push(link.path)}
          >
            <span className={styles.spaceQuickActionIcon}>{link.icon}</span>
            <strong>{link.label}</strong>
            <small>{link.description}</small>
            <RightOutlined
              className={styles.spaceQuickActionArrow}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </WorkbenchWidgetFrame>
  );
}
