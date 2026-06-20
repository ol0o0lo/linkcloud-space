import { GridContent } from '@ant-design/pro-components';
import { Menu } from 'antd';
import React, { useLayoutEffect, useRef, useState } from 'react';
import BaseView from '../settings/components/base';
import NotificationView from '../settings/components/notification';
import SecurityOverview from '../settings/components/security-overview';
import useStyles from '../settings/style.style';

type PersonalCenterTab =
  | 'profile'
  | 'security'
  | 'preferences'
  | 'notifications';

type PageState = {
  mode: 'inline' | 'horizontal';
  selectKey: PersonalCenterTab;
};

const menuMap: Record<PersonalCenterTab, string> = {
  profile: '个人资料',
  security: '账号安全',
  preferences: '偏好设置',
  notifications: '通知设置',
};

const isPersonalCenterTab = (
  value: string | null,
): value is PersonalCenterTab => {
  return (
    value === 'profile' ||
    value === 'security' ||
    value === 'preferences' ||
    value === 'notifications'
  );
};

const getInitialSelectKey = (): PersonalCenterTab => {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return isPersonalCenterTab(tab) ? tab : 'profile';
};

const PersonalCenterContent: React.FC<{ selectKey: PersonalCenterTab }> = ({
  selectKey,
}) => {
  switch (selectKey) {
    case 'profile':
      return <BaseView />;
    case 'security':
      return <SecurityOverview />;
    case 'preferences':
      return <div>偏好设置（即将接入）</div>;
    case 'notifications':
      return <NotificationView />;
    default:
      return null;
  }
};

export const PersonalCenterPage: React.FC = () => {
  const { styles } = useStyles();
  const [initConfig, setInitConfig] = useState<PageState>({
    mode: 'inline',
    selectKey: getInitialSelectKey(),
  });
  const dom = useRef<HTMLDivElement>(null);

  const resize = () => {
    requestAnimationFrame(() => {
      if (!dom.current) {
        return;
      }
      let mode: 'inline' | 'horizontal' = 'inline';
      const { offsetWidth } = dom.current;
      if (dom.current.offsetWidth < 641 && offsetWidth > 400) {
        mode = 'horizontal';
      }
      if (window.innerWidth < 768 && offsetWidth > 400) {
        mode = 'horizontal';
      }
      setInitConfig((prev) => ({
        ...prev,
        mode: mode as PageState['mode'],
      }));
    });
  };

  const resizeRef = useRef(resize);
  resizeRef.current = resize;

  useLayoutEffect(() => {
    const handler = () => resizeRef.current();
    window.addEventListener('resize', handler);
    handler();
    return () => {
      window.removeEventListener('resize', handler);
    };
  }, []);

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', initConfig.selectKey);
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [initConfig.selectKey]);

  const getMenu = () => {
    return Object.keys(menuMap).map((key) => ({
      key,
      label: menuMap[key as PersonalCenterTab],
    }));
  };

  return (
    <GridContent>
      <div
        className={styles.main}
        ref={(ref) => {
          if (ref) {
            dom.current = ref;
          }
        }}
      >
        <div className={styles.leftMenu}>
          <Menu
            mode={initConfig.mode}
            selectedKeys={[initConfig.selectKey]}
            onClick={({ key }) => {
              setInitConfig((prev) => ({
                ...prev,
                selectKey: key as PersonalCenterTab,
              }));
            }}
            items={getMenu()}
          />
        </div>
        <div className={styles.right}>
          <div className={styles.title}>{menuMap[initConfig.selectKey]}</div>
          <PersonalCenterContent selectKey={initConfig.selectKey} />
        </div>
      </div>
    </GridContent>
  );
};

export default PersonalCenterPage;
