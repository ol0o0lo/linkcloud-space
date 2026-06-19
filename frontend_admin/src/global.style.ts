import { createStyles } from 'antd-style';

const useStyles = createStyles(() => {
  return {
    colorWeak: {
      filter: 'invert(80%)',
    },
    'ant-layout': {
      minHeight: '100vh',
    },
    '.ant-pro-layout-content.ant-layout-content': {
      paddingInline: '24px !important',
    },
    '.ant-pro-sider.ant-layout-sider': {
      borderRight: '1px solid rgba(5, 5, 5, 0.06)',
    },
    '.ant-pro-sider .ant-pro-sider-collapsed-button': {
      right: -12,
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
    },
    '.ant-pro-sider .ant-menu.ant-pro-sider-menu, .ant-pro-sider .ant-pro-sider-link-menu': {
      paddingRight: 8,
    },
    'ant-pro-sider.ant-layout-sider.ant-pro-sider-fixed': {
      left: 'unset',
    },
    '.ant-pro-sider-collapsed .ant-pro-sider-link span:not([role="img"])': {
      display: 'none',
    },
    canvas: {
      display: 'block',
    },
    body: {
      textRendering: 'optimizeLegibility',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    'ul,ol': {
      listStyle: 'none',
    },
    '@media(max-width: 768px)': {
      '.ant-pro-layout-content.ant-layout-content': {
        paddingInline: '16px !important',
      },
      'ant-table': {
        width: '100%',
        overflowX: 'auto',
        '&-thead > tr,    &-tbody > tr': {
          '> th,      > td': {
            whiteSpace: 'pre',
            '> span': {
              display: 'block',
            },
          },
        },
      },
    },
  };
});

export default useStyles;
