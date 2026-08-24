import { PlusOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';

type TreeSectionAction = {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
};

export type TreeSectionHeaderProps = {
  className?: string;
  collapseAllAction?: Pick<TreeSectionAction, 'disabled' | 'onClick'>;
  count?: ReactNode;
  createAction?: TreeSectionAction;
  title: ReactNode;
};

const useStyles = createStyles(({ css, token }) => ({
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,
  label: css`
    display: block;
    padding: 12px 8px 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 2px;
  `,
  collapseAction: css`
    padding-inline: 8px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
}));

export const TreeSectionHeader = ({
  className,
  collapseAllAction,
  count,
  createAction,
  title,
}: TreeSectionHeaderProps) => {
  const { styles, cx } = useStyles();

  return (
    <div className={cx(styles.header, className)}>
      <span className={styles.label}>
        {title}
        {count !== undefined ? ` ${count}` : null}
      </span>
      {createAction || collapseAllAction ? (
        <span className={styles.actions}>
          {createAction ? (
            <Tooltip title={createAction.label}>
              <Button
                type="text"
                size="small"
                disabled={createAction.disabled}
                aria-label={createAction.label}
                icon={createAction.icon ?? <PlusOutlined />}
                onClick={createAction.onClick}
              />
            </Tooltip>
          ) : null}
          {collapseAllAction ? (
            <Button
              type="text"
              size="small"
              className={styles.collapseAction}
              disabled={collapseAllAction.disabled}
              aria-label="全部折叠"
              onClick={collapseAllAction.onClick}
            >
              全部折叠
            </Button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
};
