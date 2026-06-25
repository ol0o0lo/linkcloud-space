import { BgColorsOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Button, Tooltip } from 'antd';
import React from 'react';

// Initialize dayjs plugins globally
dayjs.extend(relativeTime);

import {
  AvatarDropdown,
  ErrorBoundary,
  Footer,
  LangDropdown,
  OfflineBanner,
  OrgSwitcher,
} from '@/components';
import { appsAccountsApiGetMe } from '@/services/openapi/userAccount';
import { appsOrganizationsApiSwitchList } from '@/services/openapi/organizations';
import { buildAdminPath, isAuthPagePath, LOGIN_PATH } from '@/utils/adminRouting';
import { resolveSelectedOrgSlug } from '@/utils/orgSelection';
import defaultSettings from '../config/defaultSettings';
import logoUrl from '../public/logo.svg';
import { errorConfig } from './requestErrorConfig';

type InitialState = {
  settings?: Partial<LayoutSettings>;
  currentUser?: API.MeOut;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.MeOut | undefined>;
  settingDrawerOpen?: boolean;
  organizations?: API.SwitchListItemOut[];
  selectedOrgSlug?: string;
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
  // 如果不是登录页面，执行
  const { location } = history;
  if (!isAuthPagePath(location.pathname)) {
    const currentUser = await fetchUserInfo();
    const organizations = currentUser ? await fetchOrganizations() : [];
    const selectedOrgSlug = resolveSelectedOrgSlug(organizations);

    return {
      fetchUserInfo,
      currentUser,
      organizations,
      selectedOrgSlug,
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
  return {
    menuItemRender: (item, dom) => {
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {dom}
          </Link>
        );
      }
      return dom;
    },
    actionsRender: () => {
      // `locale: false` opts out of the language switcher. ProLayout's own
      // `locale` prop is a locale string, so narrow to the boolean toggle here.
      const localeEnabled =
        (initialState?.settings as { locale?: boolean })?.locale !== false;
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
      src: initialState?.currentUser?.avatar?.[0]?.thumbnail || initialState?.currentUser?.avatar?.[0]?.url || undefined,
      title: getUserDisplayName(initialState?.currentUser),
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    logo: logoUrl,
    // waterMarkProps: {
    //   content: initialState?.currentUser?.name,
    // },
    footerRender: () => <Footer />,
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
    ...initialState?.settings,
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
