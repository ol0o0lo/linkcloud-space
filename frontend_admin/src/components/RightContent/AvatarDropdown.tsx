import {
  BellOutlined,
  LogoutOutlined,
  MessageOutlined,
  SettingOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Badge, Button, Spin } from 'antd';
import React, { startTransition } from 'react';
import NotificationBell from '@/components/NotificationBell';
import { deleteBrowserV1AuthSession } from '@/services/allauth/authSession';
import {
  buildAdminPath,
  isAuthPagePath,
  LOGIN_PATH,
  SPACE_PATHS,
} from '@/utils/adminRouting';
import { NOTIFICATIONS_PATH } from '@/utils/notificationRouting';
import HeaderDropdown from '../HeaderDropdown';
import { Icon } from '../Icon';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({
  children,
}) => {
  const loginOut = async () => {
    try {
      await deleteBrowserV1AuthSession(
        { client: 'browser' },
        { skipErrorHandler: true },
      );
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        throw error;
      }
    }
    const { search, pathname } = window.location;
    const urlParams = new URL(window.location.href).searchParams;
    const searchParams = new URLSearchParams({
      redirect: buildAdminPath(pathname, search),
    });
    const redirect = urlParams.get('redirect');
    if (!isAuthPagePath(window.location.pathname) && !redirect) {
      history.replace({
        pathname: LOGIN_PATH,
        search: searchParams.toString(),
      });
    }
  };
  const { initialState, setInitialState } = useModel('@@initialState');

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
      return;
    }
    if (key === 'theme') {
      setInitialState((s) => ({ ...s, settingDrawerOpen: true }));
      return;
    }
    if (key === 'landlord') {
      history.push('/personal-business/landlord');
      return;
    }
    if (key === 'messaging') {
      history.push(SPACE_PATHS.messaging);
      return;
    }
    if (key === 'notifications') {
      history.push(NOTIFICATIONS_PATH);
      return;
    }
    history.push(`/account/${key}`);
  };

  if (!initialState) {
    return <Spin size="small" />;
  }

  const { currentUser } = initialState;

  if (!currentUser) {
    return <Spin size="small" />;
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'landlord',
      icon: <Icon icon="tabler:home-cog" />,
      label: '房东中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账号设置',
    },
    {
      key: 'theme',
      icon: <SkinOutlined />,
      label: '主题设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  return (
    <NotificationBell>
      {({ unreadCount, chatUnreadCount }) => (
        <HeaderDropdown
          placement="bottomRight"
          menu={{
            selectedKeys: [],
            onClick: onMenuClick,
            items: [
              {
                key: 'messaging',
                icon: <MessageOutlined />,
                label: (
                  <span className="inline-flex items-center gap-3">
                    我的聊天
                    {chatUnreadCount > 0 && <Badge dot title="有未读聊天" />}
                  </span>
                ),
              },
              {
                key: 'notifications',
                icon: <BellOutlined />,
                label: (
                  <span className="inline-flex items-center gap-3">
                    个人通知
                    {unreadCount > 0 && <Badge dot title="有未读通知" />}
                  </span>
                ),
              },
              { type: 'divider' },
              ...menuItems,
            ],
          }}
          arrow
          trigger={['hover', 'click']}
        >
          <Button
            type="text"
            aria-label={
              unreadCount > 0 || chatUnreadCount > 0
                ? '账号菜单，有未读消息'
                : '账号菜单'
            }
            className="h-auto! p-0!"
          >
            <Badge
              dot={unreadCount > 0 || chatUnreadCount > 0}
              offset={[-3, 3]}
            >
              {children}
            </Badge>
          </Button>
        </HeaderDropdown>
      )}
    </NotificationBell>
  );
};
