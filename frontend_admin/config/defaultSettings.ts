import type { ProLayoutProps } from '@ant-design/pro-components';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1677FF',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  colorWeak: false,
  splitMenus: false,
  title: '链云空间',
  iconfontUrl: '',
  token: {
    pageContainer: {
      paddingInlinePageContainerContent: 24,
      paddingBlockPageContainerContent: 24,
    },
  },
};

export default Settings;
