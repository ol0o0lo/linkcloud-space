import {
  BookOutlined,
  CheckOutlined,
  ForkOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  getAllLocales,
  getLocale,
  history,
  setLocale,
  useModel,
} from '@umijs/max';
import type { MenuProps } from 'antd';
import { Button, Select, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { canAccessSpaceWorkbench } from '@/pages/team-operations/workbench/view';
import {
  getTeamOperationsCapabilities,
  type TeamOperationsCapabilities,
} from '@/services/manual/teamOperations';
import {
  appsOrganizationsApiSelectOrg,
  appsOrganizationsApiSwitchList,
} from '@/services/openapi/organizations';
import { RENTAL_PATHS } from '@/utils/adminRouting';
import { setSelectedOrgSlug } from '@/utils/orgSelection';
import HeaderDropdown from '../HeaderDropdown';

export const localeLabelMap: Record<string, { emoji: string; label: string }> =
  {
    'zh-CN': { emoji: '🇨🇳', label: '简体中文' },
    'zh-TW': { emoji: '🇭🇰', label: '繁體中文' },
    'en-US': { emoji: '🇺🇸', label: 'English' },
    'ja-JP': { emoji: '🇯🇵', label: '日本語' },
    'pt-BR': { emoji: '🇧🇷', label: 'Português' },
    'id-ID': { emoji: '🇮🇩', label: 'Bahasa Indonesia' },
    'fa-IR': { emoji: '🇮🇷', label: 'فارسی' },
    'bn-BD': { emoji: '🇧🇩', label: 'বাংলা' },
  };

const useStyles = createStyles(({ token, css }) => ({
  action: css`
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 36px !important;
    min-width: 36px;
    padding-inline: 8px !important;
    padding-block: 0 !important;
    border-radius: ${token.borderRadius}px !important;
  `,
  orgSwitcher: css`
    min-width: 250px;

    @media (max-width: ${token.screenSM - 1}px) {
      width: 112px;
      min-width: 112px;
      max-width: 112px;

      .ant-select-prefix {
        display: none;
      }
    }

    .ant-select-prefix {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: ${token.colorText};
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .ant-select-selector {
      background: ${token.colorBgContainer} !important;
      border-color: ${token.colorPrimaryBorder} !important;
      border-radius: ${token.borderRadius}px !important;
    }

    &:hover .ant-select-selector,
    &.ant-select-focused .ant-select-selector {
      border-color: ${token.colorPrimary} !important;
      box-shadow: 0 0 0 2px ${token.colorPrimaryBg} !important;
    }
  `,
}));

const orgSwitcherPrefix = <span>当前空间</span>;

export const OrgSwitcher: React.FC = () => {
  const { styles } = useStyles();
  const queryClient = useQueryClient();
  const { initialState, setInitialState } = useModel('@@initialState');
  const organizations = initialState?.organizations || [];

  const syncOrganizations = async (slug?: string) => {
    const nextOrganizations = await queryClient.fetchQuery({
      queryKey: ['tenant', 'organizations'],
      queryFn: () => appsOrganizationsApiSwitchList({ skipErrorHandler: true }),
    });
    const storedSlug = setSelectedOrgSlug(slug);
    let teamOperationsCapabilities: TeamOperationsCapabilities | undefined;
    try {
      teamOperationsCapabilities = storedSlug
        ? await getTeamOperationsCapabilities()
        : undefined;
    } catch (_error) {
      teamOperationsCapabilities = undefined;
    }
    setInitialState((state) => ({
      ...state,
      selectedOrgSlug: storedSlug,
      teamOperationsCapabilities,
      organizations: nextOrganizations.map((item) => ({
        ...item,
        is_current: Boolean(storedSlug) && item.slug === storedSlug,
      })),
    }));
    const hasSpaceWorkbenchAccess = canAccessSpaceWorkbench(
      teamOperationsCapabilities,
    );
    if (
      !hasSpaceWorkbenchAccess &&
      history.location.pathname === RENTAL_PATHS.workbenchSpace
    ) {
      history.replace(RENTAL_PATHS.workbenchOverview);
    }
    await queryClient.invalidateQueries({
      queryKey: ['tenant', 'app-context', storedSlug],
    });
    await queryClient.invalidateQueries({
      queryKey: ['tenant', 'organization-detail', storedSlug],
    });
    await queryClient.invalidateQueries({
      queryKey: ['tenant', 'organization-profile', storedSlug],
    });
    await queryClient.invalidateQueries({
      queryKey: ['tenant', 'usage', storedSlug],
    });
    await queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    await queryClient.invalidateQueries({ queryKey: ['tenant', 'invites'] });
    await queryClient.invalidateQueries({ queryKey: ['tenant', 'teams'] });
    await queryClient.invalidateQueries({ queryKey: ['access'] });
    await queryClient.invalidateQueries({ queryKey: ['team-operations'] });
    await queryClient.invalidateQueries({ queryKey: ['settings-management'] });
  };

  const handleChange = async (value: string) => {
    await appsOrganizationsApiSelectOrg(
      { slug: value },
      { skipErrorHandler: true },
    );
    await syncOrganizations(value);
  };

  if (organizations.length === 0) {
    return null;
  }

  return (
    <Select
      aria-label="当前空间"
      className={styles.orgSwitcher}
      options={organizations.map((item) => ({
        label: item.name,
        value: item.slug,
      }))}
      placeholder="选择空间"
      prefix={orgSwitcherPrefix}
      popupMatchSelectWidth={false}
      size="middle"
      suffixIcon={null}
      value={initialState?.selectedOrgSlug}
      onChange={(value) => {
        void handleChange(value);
      }}
    />
  );
};

export const DocLink: React.FC = () => {
  const { styles } = useStyles();
  return (
    <Tooltip title="使用文档">
      <Button
        type="text"
        className={styles.action}
        icon={<BookOutlined />}
        aria-label="使用文档"
        onClick={() => {
          history.push('/welcome');
        }}
      />
    </Tooltip>
  );
};

const versionItems: MenuProps['items'] = [
  { key: 'https://v5.pro.ant.design', label: 'v5' },
  { key: 'https://v4.pro.ant.design', label: 'v4' },
  { key: 'https://v2.pro.ant.design', label: 'v2' },
  { key: 'https://v1.pro.ant.design', label: 'v1' },
];

const onVersionClick: MenuProps['onClick'] = ({ key }) => {
  window.open(key, '_blank', 'noopener,noreferrer');
};

export const VersionDropdown: React.FC = () => {
  const { styles } = useStyles();
  return (
    <HeaderDropdown
      placement="bottomRight"
      arrow
      menu={{
        selectedKeys: [],
        onClick: onVersionClick,
        items: versionItems,
        style: { minWidth: 100 },
      }}
    >
      <Button type="text" className={styles.action} aria-label="历史版本">
        <ForkOutlined />
      </Button>
    </HeaderDropdown>
  );
};

export const LangDropdown: React.FC = () => {
  const { styles } = useStyles();
  const allLocales = useMemo(() => getAllLocales(), []);
  const currentLocale = getLocale();
  const supportLocales = allLocales.filter((l) => l in localeLabelMap);

  if (supportLocales.length <= 1) {
    return null;
  }

  const langItems: MenuProps['items'] = supportLocales.map((locale) => ({
    key: `lang-${locale}`,
    icon:
      locale === currentLocale ? (
        <CheckOutlined style={{ color: '#52c41a' }} />
      ) : (
        <span style={{ display: 'inline-block', width: 14 }} />
      ),
    label: `${localeLabelMap[locale]?.emoji ?? ''} ${localeLabelMap[locale]?.label ?? locale}`,
  }));

  const onLangClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('lang-')) {
      setLocale(key.replace('lang-', ''), false);
    }
  };

  return (
    <HeaderDropdown
      placement="bottomRight"
      arrow
      menu={{
        selectedKeys: [`lang-${currentLocale}`],
        onClick: onLangClick,
        items: langItems,
        style: { minWidth: 180 },
      }}
    >
      <Button type="text" className={styles.action} aria-label="语言切换">
        <GlobalOutlined />
      </Button>
    </HeaderDropdown>
  );
};
