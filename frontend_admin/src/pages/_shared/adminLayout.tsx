import { Button, Flex, Grid, Space, Typography } from 'antd';
import React from 'react';

export const fullWidthStyle: React.CSSProperties = { width: '100%' };

export const adminTableScroll = { x: 'max-content' };

export function fixedPagePagination(
  current: number,
  pageSize: number,
  total: number,
  onChange: (page: number) => void,
) {
  return {
    current,
    pageSize,
    total,
    showSizeChanger: false,
    onChange,
  };
}

export const drawerWidthSm = 'min(460px, calc(100vw - 24px))';

export const drawerWidthMd = 'min(560px, calc(100vw - 24px))';

export const drawerWidthLg = 'min(720px, calc(100vw - 24px))';

export const drawerWidthXl = 'min(960px, calc(100vw - 24px))';

export const responsiveDescriptionColumns = { xs: 1, md: 2, xl: 4 };

export const twoColumnDescription = { xs: 1, md: 2 };

export const wrapTextStyle: React.CSSProperties = {
  maxWidth: 360,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
};

export const codeWrapStyle: React.CSSProperties = {
  display: 'inline-block',
  maxWidth: '100%',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

export const toolbarControlStyle: React.CSSProperties = {
  width: 'min(260px, 100%)',
};

export const toolbarShortSelectStyle: React.CSSProperties = {
  width: 160,
};

export const toolbarSelectPopupWidth = 160;

export const AdminToolbar: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.sm;

  return (
    <Flex
      gap="small"
      wrap={!isNarrow}
      vertical={isNarrow}
      align={isNarrow ? 'stretch' : 'center'}
      justify="flex-end"
      style={isNarrow ? fullWidthStyle : undefined}
    >
      {children}
    </Flex>
  );
};

function normalizeResponsiveAction(child: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(child)) return child;

  if (child.type === React.Fragment) {
    const fragment = child as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    return React.cloneElement(
      fragment,
      undefined,
      React.Children.map(fragment.props.children, normalizeResponsiveAction),
    );
  }

  const anchor = child as React.ReactElement<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  if (anchor.type !== 'a' || anchor.props.href || !anchor.props.onClick) {
    return child;
  }

  const { children: label, onClick, ...props } = anchor.props;
  return (
    <Button
      key={anchor.key}
      type="link"
      size="small"
      className={props.className}
      style={props.style}
      title={props.title}
      aria-label={props['aria-label']}
      onClick={(event) =>
        onClick(event as unknown as React.MouseEvent<HTMLAnchorElement>)
      }
    >
      {label}
    </Button>
  );
}

export const ResponsiveActions: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Space size="small" wrap={false} style={{ whiteSpace: 'nowrap' }}>
    {React.Children.map(children, normalizeResponsiveAction)}
  </Space>
);

export const SectionHeader: React.FC<{
  actions?: React.ReactNode;
  title: React.ReactNode;
}> = ({ actions, title }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      width: '100%',
      marginBottom: 16,
    }}
  >
    <div>
      <Typography.Text strong>{title}</Typography.Text>
    </div>
    {actions ? <AdminToolbar>{actions}</AdminToolbar> : null}
  </div>
);

export const StatusFlowButtons: React.FC<{
  actionText?: Record<string, string>;
  currentStatus: string;
  flowOptions: Record<string, string[]>;
  label: (status: string) => React.ReactNode;
  onChange: (status: string) => void;
}> = ({ actionText = {}, currentStatus, flowOptions, label, onChange }) => (
  <>
    {(flowOptions[currentStatus] || [])
      .filter((nextStatus) => nextStatus !== currentStatus)
      .map((nextStatus) => (
        <Button
          type="link"
          size="small"
          key={nextStatus}
          onClick={() => onChange(nextStatus)}
        >
          {actionText[nextStatus] || label(nextStatus)}
        </Button>
      ))}
  </>
);

export const WrappedCodeText: React.FC<{ value: unknown }> = ({ value }) => (
  <Typography.Text code style={codeWrapStyle}>
    {typeof value === 'string' ? value : JSON.stringify(value)}
  </Typography.Text>
);
