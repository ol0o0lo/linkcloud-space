import { BgColorsOutlined } from '@ant-design/icons';
import type {
  MenuDataItem,
  Settings as LayoutSettings,
} from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { Button, Tooltip } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';

// Initialize dayjs plugins globally
dayjs.extend(relativeTime);

import {
  AvatarDropdown,
  ErrorBoundary,
  LangDropdown,
  OfflineBanner,
  OrgSwitcher,
} from '@/components';
import {
  getTeamOperationsCapabilities,
  type TeamOperationsCapabilities,
} from '@/services/manual/teamOperations';
import { appsOrganizationsApiSwitchList } from '@/services/openapi/organizations';
import { appsAccountsApiGetMe } from '@/services/openapi/userAccount';
import {
  buildAdminPath,
  isAuthPagePath,
  LOGIN_PATH,
} from '@/utils/adminRouting';
import { resolveSelectedOrgSlug } from '@/utils/orgSelection';
import defaultSettings from '../config/defaultSettings';
import logoUrl from '../public/logo.svg';
import { errorConfig } from './requestErrorConfig';

const SIDER_WIDTH = 216;
const COLLAPSED_SIDER_WIDTH = 74;
const NESTED_MENU_ICON_CLASS_NAME = 'ant-pro-sider-item-icon';

function withNestedMenuIcon(item: MenuDataItem, dom: React.ReactNode) {
  if (
    !item.pro_layout_parentKeys?.length ||
    !item.icon ||
    !React.isValidElement<{ children?: React.ReactNode }>(dom)
  ) {
    return dom;
  }

  return React.cloneElement(
    dom,
    undefined,
    <span aria-hidden className={NESTED_MENU_ICON_CLASS_NAME}>
      {item.icon}
    </span>,
    dom.props.children,
  );
}

type InitialState = {
  settings?: Partial<LayoutSettings>;
  currentUser?: API.MeOut;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.MeOut | undefined>;
  settingDrawerOpen?: boolean;
  organizations?: API.SwitchListItemOut[];
  selectedOrgSlug?: string;
  teamOperationsCapabilities?: TeamOperationsCapabilities;
};

function getUserDisplayName(user?: API.MeOut) {
  if (!user) {
    return '用户';
  }

  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    user.email ||
    '用户'
  );
}

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<InitialState> {
  const fetchUserInfo = async () => {
    try {
      return await appsAccountsApiGetMe({
        skipErrorHandler: true,
      });
    } catch (_error) {
      const { pathname, search, hash } = history.location;
      if (!isAuthPagePath(pathname)) {
        history.replace(
          `${LOGIN_PATH}?redirect=${encodeURIComponent(buildAdminPath(pathname, search, hash))}`,
        );
      }
    }
    return undefined;
  };
  const fetchOrganizations = async () => {
    try {
      return await appsOrganizationsApiSwitchList({
        skipErrorHandler: true,
      });
    } catch (_error) {
      return [];
    }
  };
  const fetchTeamOperationsCapabilities = async () => {
    try {
      return await getTeamOperationsCapabilities();
    } catch (_error) {
      return undefined;
    }
  };
  // 如果不是登录页面，执行
  const { location } = history;
  if (!isAuthPagePath(location.pathname)) {
    const currentUser = await fetchUserInfo();
    const organizations = currentUser ? await fetchOrganizations() : [];
    const selectedOrgSlug = resolveSelectedOrgSlug(organizations);
    const teamOperationsCapabilities = selectedOrgSlug
      ? await fetchTeamOperationsCapabilities()
      : undefined;

    return {
      fetchUserInfo,
      currentUser,
      organizations,
      selectedOrgSlug,
      teamOperationsCapabilities,
      settings: defaultSettings as Partial<LayoutSettings>,
      settingDrawerOpen: false,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
    settingDrawerOpen: false,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const layoutSettings = initialState?.settings;
  const localeEnabled =
    (layoutSettings as { locale?: boolean } | undefined)?.locale !== false;

  return {
    subMenuItemRender: (item, dom) => withNestedMenuIcon(item, dom),
    menuItemRender: (item, dom) => {
      const menuItem = withNestedMenuIcon(item, dom);
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {menuItem}
          </Link>
        );
      }
      return menuItem;
    },
    actionsRender: () => {
      // `locale: false` opts out of the language switcher. ProLayout's own
      // `locale` prop is a locale string, so narrow to the boolean toggle here.
      return [
        <OrgSwitcher key="org-switcher" />,
        <Tooltip key="theme-settings" title="界面设置">
          <Button
            type="text"
            aria-label="界面设置"
            icon={<BgColorsOutlined />}
            onClick={() => {
              setInitialState((s) => ({
                ...s,
                settingDrawerOpen: true,
              }));
            }}
          />
        </Tooltip>,
        localeEnabled && <LangDropdown key="lang" />,
      ].filter(Boolean);
    },
    avatarProps: {
      src:
        initialState?.currentUser?.avatar?.[0]?.thumbnail ||
        initialState?.currentUser?.avatar?.[0]?.url ||
        undefined,
      title: getUserDisplayName(initialState?.currentUser),
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    logo: logoUrl,
    // waterMarkProps: {
    //   content: initialState?.currentUser?.name,
    // },
    footerRender: false,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && !isAuthPagePath(location.pathname)) {
        history.replace(
          `${LOGIN_PATH}?redirect=${encodeURIComponent(buildAdminPath(location.pathname, location.search, location.hash))}`,
        );
      }
    },
    bgLayoutImgList: [],
    links: [],
    // Replace ProLayout's default ErrorBoundary with our offline-aware version,
    // so chunk load errors show friendly messages instead of "Something went wrong."
    ErrorBoundary,
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // if (initialState?.loading) return <PageLoading />;
      return (
        <>
          {children}
          <SettingDrawer
            disableUrlParams
            enableDarkTheme
            collapse={initialState?.settingDrawerOpen}
            onCollapseChange={(open) => {
              setInitialState((s) => ({
                ...s,
                settingDrawerOpen: open,
              }));
            }}
            settings={initialState?.settings}
            onSettingChange={(settings) => {
              setInitialState((s) => ({
                ...s,
                settings,
              }));
            }}
          />
        </>
      );
    },
    ...layoutSettings,
    siderWidth: SIDER_WIDTH,
    menu: {
      locale: localeEnabled,
      collapsedWidth: COLLAPSED_SIDER_WIDTH,
    },
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  baseURL: '',
  withCredentials: true,
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </>
  );
}
